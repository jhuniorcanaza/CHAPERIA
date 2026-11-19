import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TareaOrdenTrabajo } from './tarea-ot.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import { RealtimeService } from '../../common/services/realtime.service';
import {
  AplicarMultaDto,
  CambiarEstadoTareaDto,
  CreateTareaOtDto,
  DarProrrogaDto,
  ReasignarTecnicoDto,
} from './tarea-ot.dto';

type TipoTarea = TareaOrdenTrabajo['tipo'];

// Qué especialidad puede ejecutar cada tipo de tarea.
// Regla de reunión: chapero y pintor son personas distintas (el pintor controla la calidad del chapeado).
const ESPECIALIDADES_POR_TIPO: Record<TipoTarea, string[]> = {
  CHAPERIA: ['CHAPERO'],
  PINTURA: ['PINTOR'],
  MECANICA: ['MECANICO_PLANTA'],
  SERVICIO_EXTERNO: ['AIRBAG_PLASTICOS_EXTERNO', 'ELECTRICO_EXTERNO', 'SOLDADOR_EXTERNO'],
  CONTROL_FINAL: [
    'CHAPERO',
    'PINTOR',
    'MECANICO_PLANTA',
    'AIRBAG_PLASTICOS_EXTERNO',
    'ELECTRICO_EXTERNO',
    'SOLDADOR_EXTERNO',
  ],
};

const MS_DIA = 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class OrdenesTrabajoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdenesTrabajoService.name);
  private intervalo: NodeJS.Timeout | null = null;
  private arranque: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(TareaOrdenTrabajo)
    private readonly tareaRepo: Repository<TareaOrdenTrabajo>,
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(TecnicoProveedor)
    private readonly tecnicoRepo: Repository<TecnicoProveedor>,
    private readonly notificacionesService: NotificacionesService,
    private readonly auditoriaService: AuditoriaEdicionesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  onModuleInit() {
    this.arranque = setTimeout(() => {
      this.recalcularAtrasos().catch((e) => this.logger.error(e));
    }, 8000);
    this.intervalo = setInterval(
      () => {
        this.recalcularAtrasos().catch((e) => this.logger.error(e));
      },
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.arranque) clearTimeout(this.arranque);
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async findAll(vehiculoId?: string): Promise<TareaOrdenTrabajo[]> {
    const where = vehiculoId ? { vehiculo: { id: vehiculoId } } : {};
    return this.tareaRepo.find({
      where,
      relations: ['vehiculo'],
      order: { orden: 'ASC' },
    });
  }

  private hoySinHora(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private parseFecha(valor: string): Date {
    const [y, m, d] = String(valor).split('-').map((n) => Number(n));
    return new Date(y, m - 1, d);
  }

  private calcularDiasAtraso(tarea: TareaOrdenTrabajo): number {
    if (!tarea.fechaLimite || tarea.completada) return 0;
    const limite = this.parseFecha(tarea.fechaLimite).getTime();
    const efectivo = limite + Number(tarea.diasProrrogaOtorgados || 0) * MS_DIA;
    const dias = Math.floor((this.hoySinHora().getTime() - efectivo) / MS_DIA);
    return Math.max(0, dias);
  }

  async recalcularAtrasos(): Promise<{ revisadas: number; conAtraso: number; nuevasAlertas: number }> {
    const pendientes = await this.tareaRepo.find({
      where: { completada: false },
      relations: ['vehiculo'],
    });

    let conAtraso = 0;
    let nuevasAlertas = 0;

    for (const tarea of pendientes) {
      const nuevo = this.calcularDiasAtraso(tarea);
      const previo = Number(tarea.diasAtraso || 0);
      if (nuevo > 0) conAtraso++;
      if (nuevo === previo) continue;

      tarea.diasAtraso = nuevo;
      await this.tareaRepo.save(tarea);

      if (nuevo > 0 && previo === 0) {
        nuevasAlertas++;
        await this.notificacionesService.crearYEmitir(
          'ATRASO_TAREA',
          `Tarea vencida: ${tarea.vehiculo?.marca || ''} ${tarea.vehiculo?.modelo || ''}`,
          `"${tarea.titulo}" (${tarea.tecnicoAsignadoNombre}) superó su fecha límite por ${nuevo} día(s). Definir prórroga justificada, multa o reasignación.`,
          'TODOS',
          {
            moduloDestino: 'ordenes',
            vehiculoId: tarea.vehiculo?.id || null,
            referenciaId: tarea.id,
          },
        );
      }
    }

    if (nuevasAlertas > 0) {
      this.realtimeService.emitEvent({
        tipo: 'REVISION_ATRASOS',
        titulo: 'Revisión de plazos actualizada',
        mensaje: `${pendientes.length} tarea(s) revisadas, ${conAtraso} con atraso (${nuevasAlertas} alerta nueva).`,
      });
    }

    return { revisadas: pendientes.length, conAtraso, nuevasAlertas };
  }

  private async obtenerTarea(id: string): Promise<TareaOrdenTrabajo> {
    const tarea = await this.tareaRepo.findOne({ where: { id }, relations: ['vehiculo'] });
    if (!tarea) throw new NotFoundException('Tarea de orden de trabajo no encontrada.');
    return tarea;
  }

  private referencia(tarea: TareaOrdenTrabajo): string {
    return `${tarea.vehiculo?.marca || ''} ${tarea.vehiculo?.modelo || ''} (${tarea.vehiculo?.vinChasis || ''}) - ${tarea.titulo}`;
  }

  private async validarTecnico(
    tipo: TipoTarea,
    tecnicoId: string,
    vehiculoId?: string,
  ): Promise<TecnicoProveedor> {
    const tecnico = await this.tecnicoRepo.findOne({ where: { id: tecnicoId } });
    if (!tecnico) throw new BadRequestException('El técnico seleccionado no existe.');
    if (tecnico.bloqueadoPorMalTrabajo) {
      throw new BadRequestException(
        `${tecnico.nombre} está bloqueado por mal desempeño y no puede recibir nuevas tareas.`,
      );
    }
    const permitidas = ESPECIALIDADES_POR_TIPO[tipo] || [];
    if (!permitidas.includes(tecnico.especialidad)) {
      throw new BadRequestException(
        `${tecnico.nombre} (${tecnico.especialidad}) no corresponde a una tarea de tipo ${tipo}. El chapero y el pintor deben ser personas distintas.`,
      );
    }

    if (vehiculoId && (tipo === 'PINTURA' || tipo === 'CHAPERIA')) {
      const otroTipo: TipoTarea = tipo === 'PINTURA' ? 'CHAPERIA' : 'PINTURA';
      const conflicto = await this.tareaRepo.findOne({
        where: {
          vehiculo: { id: vehiculoId },
          tipo: otroTipo,
          tecnicoAsignadoId: tecnico.id,
        },
      });
      if (conflicto) {
        throw new BadRequestException(
          `Separación de control de calidad: ${tecnico.nombre} ya ejecuta ${otroTipo} en este vehículo; chapero y pintor deben ser personas distintas.`,
        );
      }
    }

    return tecnico;
  }

  private async recalcularAvanceVehiculo(vehiculoId: string) {
    const vehiculo = await this.vehiculoRepo.findOne({ where: { id: vehiculoId } });
    if (!vehiculo) return;
    const tareas = await this.tareaRepo.find({ where: { vehiculo: { id: vehiculoId } } });
    const total = tareas.length;
    const hechas = tareas.filter((t) => t.completada).length;
    const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

    if (total > 0 && pct === 100 && vehiculo.estado !== 'FINALIZADO') {
      vehiculo.estado = 'FINALIZADO';
      vehiculo.fechaFinalizado = new Date();
      await this.vehiculoRepo.save(vehiculo);
      await this.notificacionesService.crearYEmitir(
        'VEHICULO_FINALIZADO',
        `Vehículo al 100%: ${vehiculo.marca} ${vehiculo.modelo}`,
        `La unidad ${vehiculo.vinChasis} completó todas sus tareas. Recuerda subir la foto de Entrega Final y revisar el informe en Bolivia.`,
        'BOLIVIA',
        {
          moduloDestino: 'reportes',
          vehiculoId: vehiculo.id,
          referenciaId: vehiculo.id,
        },
      );
    } else if (pct < 100 && vehiculo.estado === 'FINALIZADO') {
      vehiculo.estado = 'EN_TALLER';
      vehiculo.fechaFinalizado = null;
      await this.vehiculoRepo.save(vehiculo);
    } else {
      this.realtimeService.emitEvent({
        tipo: 'AVANCE_OT',
        titulo: `Avance actualizado (${pct}%): ${vehiculo.marca} ${vehiculo.modelo}`,
        mensaje: `${hechas} de ${total} tareas completadas.`,
      });
    }
  }

  async crearTarea(dto: CreateTareaOtDto, usuarioActor?: string): Promise<TareaOrdenTrabajo> {
    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: dto.vehiculoId },
      relations: ['tareasOt'],
    });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado.');
    if (!dto.titulo || String(dto.titulo).trim().length < 3) {
      throw new BadRequestException('La tarea requiere un título descriptivo.');
    }
    if (!dto.fechaInicio || !dto.fechaLimite) {
      throw new BadRequestException('Indica la fecha de inicio y la fecha límite de la tarea.');
    }
    if (this.parseFecha(dto.fechaLimite) < this.parseFecha(dto.fechaInicio)) {
      throw new BadRequestException('La fecha límite no puede ser anterior a la fecha de inicio.');
    }

    const tecnico = await this.validarTecnico(dto.tipo, dto.tecnicoAsignadoId, vehiculo.id);
    const pago = round2(dto.pagoAcordadoUsd);

    const tarea = new TareaOrdenTrabajo();
    tarea.vehiculo = vehiculo;
    tarea.orden = (vehiculo.tareasOt?.length || 0) + 1;
    tarea.titulo = String(dto.titulo).trim();
    tarea.tipo = dto.tipo;
    tarea.tecnicoAsignadoId = tecnico.id;
    tarea.tecnicoAsignadoNombre = tecnico.nombre;
    tarea.pagoAcordadoUsd = pago;
    tarea.pagoLiquidoFinalUsd = pago;
    tarea.fechaInicio = dto.fechaInicio;
    tarea.fechaLimite = dto.fechaLimite;
    tarea.completada = false;
    tarea.diasAtraso = this.calcularDiasAtraso(tarea);

    const saved = await this.tareaRepo.save(tarea);

    if (
      vehiculo.estado === 'FINALIZADO' ||
      vehiculo.estado === 'COTIZADO' ||
      vehiculo.estado === 'RECEPCIONADO'
    ) {
      vehiculo.estado = 'EN_TALLER';
      vehiculo.fechaFinalizado = null;
      await this.vehiculoRepo.save(vehiculo);
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ORDEN_TRABAJO',
      entidadReferencia: `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis}) - ${saved.titulo}`,
      tipoAccion: 'TAREA_AGREGADA_A_OT',
      valorAnterior: 'Tarea inexistente',
      valorNuevo: `${saved.tipo} asignada a ${tecnico.nombre}, límite ${saved.fechaLimite}, pago USD $${saved.pagoAcordadoUsd}`,
      motivoEdicion: 'Tarea agregada manualmente a la orden de trabajo.',
      editadoPor: actor,
      aprobadoPor: 'Registro de Orden de Trabajo',
    });

    await this.notificacionesService.crearYEmitir(
      'TAREA_OT',
      `Nueva tarea en OT: ${vehiculo.marca} ${vehiculo.modelo}`,
      `"${saved.titulo}" asignada a ${tecnico.nombre}. Fecha límite: ${saved.fechaLimite}.`,
      'TODOS',
      {
        moduloDestino: 'ordenes',
        vehiculoId: vehiculo.id,
        referenciaId: saved.id,
      },
    );

    return saved;
  }

  async cambiarEstadoTarea(
    id: string,
    body: CambiarEstadoTareaDto,
    usuarioActor?: string,
  ): Promise<TareaOrdenTrabajo> {
    const tarea = await this.obtenerTarea(id);
    const usuario = (body.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    if (!body.completada) {
      if (!tarea.completada) return tarea;
      if (!body.motivo || body.motivo.trim().length < 4) {
        throw new BadRequestException(
          'Para reabrir una tarea completada debes indicar el motivo (mínimo 4 caracteres).',
        );
      }

      const estrellasPrevias = Number(tarea.calificacionEstrellas || 0);
      if (tarea.tecnicoAsignadoId && estrellasPrevias >= 1) {
        const tecnico = await this.tecnicoRepo.findOne({ where: { id: tarea.tecnicoAsignadoId } });
        if (tecnico && Number(tecnico.trabajosCompletados || 0) > 0) {
          const total = Number(tecnico.trabajosCompletados);
          const promedio = Number(tecnico.promedioEstrellas || 0);
          if (total <= 1) {
            tecnico.trabajosCompletados = 0;
            tecnico.promedioEstrellas = 0;
          } else {
            const nuevoProm = (promedio * total - estrellasPrevias) / (total - 1);
            tecnico.trabajosCompletados = total - 1;
            tecnico.promedioEstrellas = Math.max(0, Math.min(5, Math.round(nuevoProm * 10) / 10));
          }
          await this.tecnicoRepo.save(tecnico);
        }
      }

      tarea.completada = false;
      tarea.fechaCompletada = null;
      tarea.calificacionEstrellas = null;
      tarea.diasAtraso = this.calcularDiasAtraso(tarea);
      await this.tareaRepo.save(tarea);

      await this.auditoriaService.registrarEdicionInmutable({
        modulo: 'ORDEN_TRABAJO',
        entidadReferencia: this.referencia(tarea),
        tipoAccion: 'TAREA_REABIERTA',
        valorAnterior: 'Tarea completada',
        valorNuevo: 'Tarea pendiente (reabierta)',
        motivoEdicion: body.motivo.trim(),
        editadoPor: usuario,
        aprobadoPor: 'Jefatura de Taller',
      });

      await this.notificacionesService.crearYEmitir(
        'TAREA_OT',
        `Tarea reabierta: ${tarea.vehiculo?.marca || ''} ${tarea.vehiculo?.modelo || ''}`,
        `"${tarea.titulo}" fue reabierta por ${usuario}. Motivo: ${body.motivo.trim()}`,
        'TODOS',
        {
          moduloDestino: 'ordenes',
          vehiculoId: tarea.vehiculo?.id || null,
          referenciaId: tarea.id,
        },
      );

      await this.recalcularAvanceVehiculo(tarea.vehiculo.id);
      return tarea;
    }

    if (tarea.completada) return tarea;

    const estrellas = Number(body.calificacionEstrellas || 0);
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
      throw new BadRequestException(
        'Califica el trabajo con un valor entero de 1 a 5 estrellas para completar la tarea.',
      );
    }

    if (tarea.tipo === 'PINTURA') {
      if (!body.controlCalidadMasilla) {
        throw new BadRequestException(
          'Para completar una tarea de pintura debes registrar el control de calidad de masilla sobre el trabajo de chapería.',
        );
      }
      if (
        body.controlCalidadMasilla === 'EXCESO_MASILLA' &&
        (!body.observacionCalidad || body.observacionCalidad.trim().length < 5)
      ) {
        throw new BadRequestException(
          'Si reportas exceso de masilla debes describir la observación (mínimo 5 caracteres).',
        );
      }
      tarea.controlCalidadMasilla = body.controlCalidadMasilla;
      tarea.observacionCalidad = body.observacionCalidad?.trim() || null;
    }

    tarea.completada = true;
    tarea.fechaCompletada = new Date();
    tarea.calificacionEstrellas = estrellas;
    tarea.diasAtraso = 0;
    await this.tareaRepo.save(tarea);

    if (tarea.tecnicoAsignadoId) {
      const tecnico = await this.tecnicoRepo.findOne({ where: { id: tarea.tecnicoAsignadoId } });
      if (tecnico) {
        const total = Number(tecnico.trabajosCompletados || 0);
        const promedio = Number(tecnico.promedioEstrellas || 0);
        const nuevoPromedio = (promedio * total + estrellas) / (total + 1);
        tecnico.trabajosCompletados = total + 1;
        tecnico.promedioEstrellas = Math.round(nuevoPromedio * 10) / 10;
        await this.tecnicoRepo.save(tecnico);
      }
    }

    if (tarea.controlCalidadMasilla === 'EXCESO_MASILLA') {
      await this.auditoriaService.registrarEdicionInmutable({
        modulo: 'ORDEN_TRABAJO',
        entidadReferencia: this.referencia(tarea),
        tipoAccion: 'CONTROL_CALIDAD_EXCESO_MASILLA',
        valorAnterior: 'Chapería entregada para pintura',
        valorNuevo: 'Exceso de masilla reportado por el pintor',
        motivoEdicion: tarea.observacionCalidad,
        editadoPor: usuario,
        aprobadoPor: 'Control de calidad del pintor',
      });
      await this.notificacionesService.crearYEmitir(
        'CALIDAD_MASILLA',
        `Exceso de masilla reportado: ${tarea.vehiculo?.marca} ${tarea.vehiculo?.modelo}`,
        `${tarea.observacionCalidad}`,
        'TODOS',
        {
          moduloDestino: 'ordenes',
          vehiculoId: tarea.vehiculo?.id || null,
          referenciaId: tarea.id,
        },
      );
    }

    await this.recalcularAvanceVehiculo(tarea.vehiculo.id);
    return tarea;
  }

  async darProrroga(
    id: string,
    dto: DarProrrogaDto,
    usuarioActor?: string,
  ): Promise<TareaOrdenTrabajo> {
    const tarea = await this.obtenerTarea(id);
    const dias = Number(dto.dias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
      throw new BadRequestException('Los días de prórroga deben estar entre 1 y 30.');
    }
    if (!dto.motivo || dto.motivo.trim().length < 4) {
      throw new BadRequestException('La prórroga exige un motivo justificado.');
    }
    if (tarea.completada) {
      throw new BadRequestException('No se puede dar prórroga a una tarea ya completada.');
    }

    const previoProrroga = Number(tarea.diasProrrogaOtorgados || 0);
    const previoAtraso = Number(tarea.diasAtraso || 0);

    tarea.diasProrrogaOtorgados = previoProrroga + dias;
    tarea.motivoProrroga = `${dto.causa.trim()}: ${dto.motivo.trim()}`.slice(0, 160);
    tarea.diasAtraso = this.calcularDiasAtraso(tarea);

    // Si la prórroga reduce o elimina la mora, ajusta proporcionalmente la multa aplicada
    const config = await this.notificacionesService.getConfiguracion();
    const tarifa = Number(config.multaPorDiaRetrasoUsd || 20);
    if (tarea.diasAtraso === 0) {
      tarea.descuentoMultaUsd = 0;
      tarea.pagoLiquidoFinalUsd = round2(tarea.pagoAcordadoUsd);
    } else if (Number(tarea.descuentoMultaUsd || 0) > 0) {
      const topeMulta = Math.min(tarea.diasAtraso * tarifa, Number(tarea.pagoAcordadoUsd));
      if (Number(tarea.descuentoMultaUsd) > topeMulta) {
        tarea.descuentoMultaUsd = round2(topeMulta);
        tarea.pagoLiquidoFinalUsd = round2(Number(tarea.pagoAcordadoUsd) - tarea.descuentoMultaUsd);
      }
    }

    await this.tareaRepo.save(tarea);

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ORDEN_TRABAJO',
      entidadReferencia: this.referencia(tarea),
      tipoAccion: 'PRORROGA_JUSTIFICADA',
      valorAnterior: `Prórroga acumulada: ${previoProrroga} día(s), atraso: ${previoAtraso} día(s)`,
      valorNuevo: `Prórroga acumulada: ${tarea.diasProrrogaOtorgados} día(s), atraso: ${tarea.diasAtraso} día(s)`,
      motivoEdicion: `${dto.causa.trim()}: ${dto.motivo.trim()}`,
      editadoPor: actor,
      aprobadoPor: 'Autorizado sin penalización',
    });

    await this.notificacionesService.crearYEmitir(
      'ATRASO_TAREA',
      `Prórroga otorgada (+${dias} día/s)`,
      `"${tarea.titulo}": ${dto.causa.trim()}. ${dto.motivo.trim()}`,
      'TODOS',
      {
        moduloDestino: 'ordenes',
        vehiculoId: tarea.vehiculo?.id || null,
        referenciaId: tarea.id,
      },
    );
    return tarea;
  }

  async aplicarMulta(
    id: string,
    dto: AplicarMultaDto,
    usuarioActor?: string,
  ): Promise<TareaOrdenTrabajo> {
    const tarea = await this.obtenerTarea(id);
    if (tarea.completada) {
      throw new BadRequestException('No se puede multar una tarea ya completada.');
    }
    const config = await this.notificacionesService.getConfiguracion();
    const tarifa = Number(config.multaPorDiaRetrasoUsd || 20);
    const dias = Number(dto.diasMora ?? tarea.diasAtraso);
    if (!Number.isInteger(dias) || dias < 1) {
      throw new BadRequestException('La multa requiere al menos 1 día de mora.');
    }
    if (Number(tarea.pagoAcordadoUsd) <= 0) {
      throw new BadRequestException(
        'Esta tarea no tiene pago a contratista (personal fijo), por lo que no admite multa.',
      );
    }

    const pagoPrevio = Number(tarea.pagoLiquidoFinalUsd);
    const descuento = round2(Math.min(dias * tarifa, Number(tarea.pagoAcordadoUsd)));
    tarea.descuentoMultaUsd = descuento;
    tarea.pagoLiquidoFinalUsd = round2(Number(tarea.pagoAcordadoUsd) - descuento);
    await this.tareaRepo.save(tarea);

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Administración';
    const motivoTexto = (dto.motivo || '').trim()
      ? `${dto.motivo!.trim()} (${dias} día/s de retraso - ${tarea.tecnicoAsignadoNombre})`
      : `Incumplimiento de fecha límite por ${dias} día(s) de retraso (${tarea.tecnicoAsignadoNombre}).`;

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ORDEN_TRABAJO',
      entidadReferencia: this.referencia(tarea),
      tipoAccion: 'MULTA_POR_MORA',
      valorAnterior: `Pago líquido: USD $${pagoPrevio}`,
      valorNuevo: `Multa USD $${descuento} (${dias} día/s x USD $${tarifa}). Pago líquido: USD $${tarea.pagoLiquidoFinalUsd}`,
      motivoEdicion: motivoTexto,
      editadoPor: actor,
      aprobadoPor: 'Regla contractual del taller',
    });

    await this.notificacionesService.crearYEmitir(
      'ATRASO_TAREA',
      `Multa aplicada (USD $${descuento})`,
      `${tarea.tecnicoAsignadoNombre}: de USD $${tarea.pagoAcordadoUsd} acordados se liquidará USD $${tarea.pagoLiquidoFinalUsd}.`,
      'TODOS',
      {
        moduloDestino: 'ordenes',
        vehiculoId: tarea.vehiculo?.id || null,
        referenciaId: tarea.id,
      },
    );
    return tarea;
  }

  async reasignarTecnico(
    id: string,
    dto: ReasignarTecnicoDto,
    usuarioActor?: string,
  ): Promise<TareaOrdenTrabajo> {
    const tarea = await this.obtenerTarea(id);
    if (tarea.completada) {
      throw new BadRequestException('No se puede reasignar una tarea ya completada.');
    }
    if (!dto.motivo || dto.motivo.trim().length < 4) {
      throw new BadRequestException('La reasignación exige un motivo (mínimo 4 caracteres).');
    }
    if (dto.nuevoTecnicoId === tarea.tecnicoAsignadoId) {
      throw new BadRequestException('La tarea ya se encuentra asignada a este técnico.');
    }
    const nuevo = await this.validarTecnico(
      tarea.tipo,
      dto.nuevoTecnicoId,
      tarea.vehiculo?.id,
    );
    const anterior = tarea.tecnicoAsignadoNombre;

    tarea.tecnicoAsignadoId = nuevo.id;
    tarea.tecnicoAsignadoNombre = nuevo.nombre;
    tarea.notaReasignacion = `Antes: ${anterior}. Motivo: ${dto.motivo.trim()}`.slice(0, 200);
    await this.tareaRepo.save(tarea);

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ORDEN_TRABAJO',
      entidadReferencia: this.referencia(tarea),
      tipoAccion: 'REASIGNACION_DE_TECNICO',
      valorAnterior: `Técnico: ${anterior}`,
      valorNuevo: `Técnico: ${nuevo.nombre}`,
      motivoEdicion: dto.motivo.trim(),
      editadoPor: actor,
      aprobadoPor: 'Jefatura de Taller',
    });

    await this.notificacionesService.crearYEmitir(
      'TAREA_OT',
      'Reasignación de personal en tarea',
      `"${tarea.titulo}": se retiró a ${anterior} y se asignó a ${nuevo.nombre}. Motivo: ${dto.motivo.trim()}`,
      'TODOS',
      {
        moduloDestino: 'ordenes',
        vehiculoId: tarea.vehiculo?.id || null,
        referenciaId: tarea.id,
      },
    );
    return tarea;
  }
}
