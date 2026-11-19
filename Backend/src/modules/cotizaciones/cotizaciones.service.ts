import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cotizacion } from './cotizacion.entity';
import { CotizacionItem } from './cotizacion-item.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { TareaOrdenTrabajo } from '../ordenes-trabajo/tarea-ot.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  AceptarCotizacionDto,
  AgregarAdendaDesarmeDto,
  CreateCotizacionDto,
  EditarCotizacionBoliviaDto,
  RechazarCotizacionDto,
} from './cotizacion.dto';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class CotizacionesService {
  constructor(
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionItem)
    private readonly cotItemRepo: Repository<CotizacionItem>,
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(TareaOrdenTrabajo)
    private readonly tareaRepo: Repository<TareaOrdenTrabajo>,
    @InjectRepository(TecnicoProveedor)
    private readonly tecnicoRepo: Repository<TecnicoProveedor>,
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    private readonly auditoriaService: AuditoriaEdicionesService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async findAll(vehiculoId?: string): Promise<Cotizacion[]> {
    const where = vehiculoId ? { vehiculo: { id: vehiculoId } } : {};
    return this.cotizacionRepo.find({
      where,
      relations: ['vehiculo', 'items'],
      order: { creadoEn: 'DESC' },
    });
  }

  private async vincularEvidenciasCotizacion(
    cot: Cotizacion,
    vehiculo: Vehiculo | null | undefined,
    urls: Array<string | null | undefined>,
  ) {
    const urlsLimpias = urls
      .map((u) => (u || '').trim())
      .filter((u): u is string => Boolean(u));
    if (!urlsLimpias.length || !vehiculo) return;

    const evidencias = await this.evidenciaRepo.find({
      where: { archivoWebpUrl: In(urlsLimpias) },
    });
    if (!evidencias.length) return;

    const vehiculoRef = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis})`;
    for (const ev of evidencias) {
      ev.referenciaId = cot.id;
      ev.vehiculoReferencia = vehiculoRef;
    }
    await this.evidenciaRepo.save(evidencias);
  }

  private getDestinoContraparte(_paisActor?: 'BOLIVIA' | 'CHILE'): 'BOLIVIA' | 'CHILE' | 'TODOS' {
    // Las notificaciones llegan a todos los usuarios restantes excepto al autor (filtrado por actorEmail)
    return 'TODOS';
  }

  async crearCotizacion(
    dto: CreateCotizacionDto,
    usuarioActor?: string,
    paisActor?: 'BOLIVIA' | 'CHILE',
  ): Promise<Cotizacion> {
    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: dto.vehiculoId },
      relations: ['cotizaciones'],
    });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado para cotizar.');
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Debes agregar al menos un ítem a la cotización.');
    }

    const cot = new Cotizacion();
    cot.vehiculo = vehiculo;
    cot.version = (vehiculo.cotizaciones?.length || 0) + 1;
    cot.creadoPorChile =
      (dto.creadoPor || '').trim() || usuarioActor || 'Alfredo Rojas (Encargado Chile)';
    cot.motivoEdicionAcuerdo =
      (dto.observacionInicial || '').trim() || 'Cotización inicial elaborada en taller';
    cot.estadoAprobacion = 'PENDIENTE_REVISION_BOLIVIA';

    let sumaOriginal = 0;
    let sumaAcordada = 0;

    cot.items = dto.items.map((raw) => {
      const item = new CotizacionItem();
      item.categoria = raw.categoria;
      item.piezaZona = String(raw.piezaZona).trim();
      item.gradoDanio =
        raw.categoria === 'CHAPERIA' ? raw.gradoDanio || 'LEVE' : 'NO_APLICA';
      item.costoInternoOTerceroUsd = round2(raw.costoInternoOTerceroUsd);
      item.precioCotizadoOriginalUsd = round2(raw.precioClienteUsd);
      item.precioAcordadoClienteUsd = round2(raw.precioClienteUsd);
      item.fotoDesarmeAdendaWebp = raw.fotoDesarmeAdendaWebp?.trim() || null;
      item.descripcionFotoAdenda = raw.descripcionFotoAdenda?.trim() || null;

      sumaOriginal += item.precioCotizadoOriginalUsd;
      sumaAcordada += item.precioAcordadoClienteUsd;
      return item;
    });

    cot.montoOriginalUsd = round2(sumaOriginal);
    cot.montoAcordadoUsd = round2(sumaAcordada);

    const saved = await this.cotizacionRepo.save(cot);

    if (
      ['EN_PUERTO_NAVIERA', 'EN_GRUA', 'RECEPCIONADO', 'RETIRADO_SIN_REPARAR'].includes(
        vehiculo.estado,
      )
    ) {
      vehiculo.estado = 'COTIZADO';
      await this.vehiculoRepo.save(vehiculo);
    }

    await this.vincularEvidenciasCotizacion(
      saved,
      vehiculo,
      saved.items.map((it) => it.fotoDesarmeAdendaWebp),
    );

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'COTIZACION',
      entidadReferencia: `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis}) - Cotización v${saved.version}`,
      tipoAccion: 'CREACION_COTIZACION_INICIAL',
      valorAnterior: 'Sin cotización previa',
      valorNuevo: `Monto Inicial: USD $${saved.montoOriginalUsd} (${saved.items.length} ítems)`,
      motivoEdicion: cot.motivoEdicionAcuerdo,
      editadoPor: cot.creadoPorChile,
      aprobadoPor: 'Pendiente Revisión Bolivia',
    });

    await this.notificacionesService.crearYEmitir(
      'COTIZACION_EDITADA',
      `Nueva Cotización Creada: ${vehiculo.marca} ${vehiculo.modelo}`,
      `Elaborada por ${cot.creadoPorChile} por USD $${saved.montoOriginalUsd} (${saved.items.length} piezas/trabajos).`,
      this.getDestinoContraparte(paisActor),
      {
        moduloDestino: 'cotizacion',
        vehiculoId: vehiculo.id,
        referenciaId: saved.id,
      },
    );

    return saved;
  }

  async agregarItemAdendaDesarme(
    cotizacionId: string,
    dto: AgregarAdendaDesarmeDto,
    usuarioActor?: string,
    paisActor?: 'BOLIVIA' | 'CHILE',
  ): Promise<Cotizacion> {
    const cot = await this.cotizacionRepo.findOne({
      where: { id: cotizacionId },
      relations: ['vehiculo', 'items'],
    });
    if (!cot) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    if (cot.estadoAprobacion === 'RECHAZADA_CLIENTE') {
      throw new BadRequestException(
        'No se puede agregar adenda a una cotización rechazada por el cliente.',
      );
    }

    const motivoLimpio = (dto.motivoAdenda || '').trim();
    if (motivoLimpio.length < 4) {
      throw new BadRequestException(
        'Debes describir el motivo del hallazgo en desarme (mínimo 4 caracteres).',
      );
    }

    const actorNombre =
      (dto.usuarioNombre || '').trim() || usuarioActor || 'Alfredo Rojas (Encargado Chile)';
    const montoPrevio = Number(cot.montoAcordadoUsd);

    const nuevoItem = new CotizacionItem();
    nuevoItem.cotizacion = cot;
    nuevoItem.categoria = dto.categoria;
    nuevoItem.piezaZona = String(dto.piezaZona).trim();
    nuevoItem.gradoDanio =
      dto.categoria === 'CHAPERIA' ? dto.gradoDanio || 'FUERTE' : 'NO_APLICA';
    nuevoItem.costoInternoOTerceroUsd = round2(dto.costoInternoOTerceroUsd);
    nuevoItem.precioCotizadoOriginalUsd = round2(dto.precioClienteUsd);
    nuevoItem.precioAcordadoClienteUsd = round2(dto.precioClienteUsd);
    nuevoItem.fotoDesarmeAdendaWebp = dto.fotoDesarmeAdendaWebp?.trim() || null;
    nuevoItem.descripcionFotoAdenda =
      dto.descripcionFotoAdenda?.trim() || motivoLimpio;

    await this.cotItemRepo.save(nuevoItem);

    cot.version += 1;
    cot.montoAcordadoUsd = round2(montoPrevio + nuevoItem.precioAcordadoClienteUsd);
    cot.estadoAprobacion = 'AMARILLO_EDITADA_POR_BOLIVIA';
    cot.autorizadoEdicionBolivia = actorNombre;
    cot.motivoEdicionAcuerdo = motivoLimpio;
    await this.cotizacionRepo.save(cot);

    await this.vincularEvidenciasCotizacion(cot, cot.vehiculo, [
      nuevoItem.fotoDesarmeAdendaWebp,
    ]);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'COTIZACION',
      entidadReferencia: `${cot.vehiculo?.marca || ''} ${cot.vehiculo?.modelo || ''} (${cot.vehiculo?.vinChasis || ''}) - Adenda v${cot.version}`,
      tipoAccion: 'ADENDA_DESARME_NUEVA_PIEZA',
      valorAnterior: `Total previo: USD $${montoPrevio}`,
      valorNuevo: `Total con adenda: USD $${cot.montoAcordadoUsd} (+$${nuevoItem.precioAcordadoClienteUsd} por ${nuevoItem.piezaZona})`,
      motivoEdicion: motivoLimpio,
      editadoPor: actorNombre,
      aprobadoPor: 'En estado AMARILLO (Por confirmar)',
      evidenciaFotoUrl: nuevoItem.fotoDesarmeAdendaWebp,
      evidenciaDescripcion: nuevoItem.descripcionFotoAdenda,
    });

    await this.notificacionesService.crearYEmitir(
      'COTIZACION_EDITADA',
      `Adenda por Desarme en Cotización v${cot.version}`,
      `Se agregó "${nuevoItem.piezaZona}" (+USD $${nuevoItem.precioAcordadoClienteUsd}). Nuevo total: USD $${cot.montoAcordadoUsd}. Estado: AMARILLO.`,
      this.getDestinoContraparte(paisActor),
      {
        moduloDestino: 'cotizacion',
        vehiculoId: cot.vehiculo?.id || null,
        referenciaId: cot.id,
      },
    );

    return this.cotizacionRepo.findOne({
      where: { id: cotizacionId },
      relations: ['vehiculo', 'items'],
    });
  }

  async editarCotizacionConHistorial(
    id: string,
    dto: EditarCotizacionBoliviaDto,
    usuarioActor?: string,
    paisActor?: 'BOLIVIA' | 'CHILE',
  ): Promise<Cotizacion> {
    const cot = await this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
    if (!cot) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    const motivoLimpio = String(dto.motivo || '').trim();
    if (motivoLimpio.length < 4) {
      throw new BadRequestException(
        'Toda edición de cotización exige obligatoriamente un motivo detallado para el historial inmutable.',
      );
    }

    const montoAnterior = Number(cot.montoAcordadoUsd);
    const detallesCambiosItems: string[] = [];

    if (Array.isArray(dto.itemsActualizados) && dto.itemsActualizados.length > 0) {
      let sumaRecalculada = 0;
      for (const item of cot.items || []) {
        const cambio = dto.itemsActualizados.find((u) => u.id === item.id);
        if (cambio) {
          const precioPrevioItem = Number(item.precioAcordadoClienteUsd);
          const nuevoPrecioItem = round2(cambio.precioAcordadoClienteUsd);
          const gradoCambio =
            cambio.gradoDanio &&
            item.categoria === 'CHAPERIA' &&
            cambio.gradoDanio !== item.gradoDanio;

          if (precioPrevioItem !== nuevoPrecioItem || gradoCambio) {
            const notaGrado = gradoCambio ? ` [${item.gradoDanio} -> ${cambio.gradoDanio}]` : '';
            detallesCambiosItems.push(
              `${item.piezaZona}: $${precioPrevioItem} -> $${nuevoPrecioItem}${notaGrado}`,
            );
          }

          if (cambio.piezaZona && cambio.piezaZona.trim().length >= 2) {
            item.piezaZona = cambio.piezaZona.trim();
          }
          item.precioAcordadoClienteUsd = nuevoPrecioItem;
          if (cambio.costoInternoOTerceroUsd !== undefined) {
            item.costoInternoOTerceroUsd = round2(cambio.costoInternoOTerceroUsd);
          }
          if (cambio.gradoDanio && item.categoria === 'CHAPERIA') {
            item.gradoDanio = cambio.gradoDanio;
          }
          await this.cotItemRepo.save(item);
        }
        sumaRecalculada += Number(item.precioAcordadoClienteUsd);
      }
      cot.montoAcordadoUsd =
        dto.montoAcordadoUsd !== undefined && dto.montoAcordadoUsd !== null
          ? round2(dto.montoAcordadoUsd)
          : round2(sumaRecalculada);
    } else if (dto.montoAcordadoUsd !== undefined && dto.montoAcordadoUsd !== null) {
      cot.montoAcordadoUsd = round2(dto.montoAcordadoUsd);
    } else {
      throw new BadRequestException(
        'Debes enviar el nuevo monto acordado o los ítems actualizados.',
      );
    }

    const actorNombre =
      (dto.autorizadoPor || '').trim() || usuarioActor || 'Administración Bolivia';

    cot.version += 1;
    cot.autorizadoEdicionBolivia = actorNombre;
    cot.motivoEdicionAcuerdo = motivoLimpio;
    cot.estadoAprobacion = 'AMARILLO_EDITADA_POR_BOLIVIA';
    await this.cotizacionRepo.save(cot);

    let cambioColaTexto = '';
    if (cot.vehiculo) {
      const prioridadSolicitada =
        dto.prioridadCola || (dto.pasarACola30Dias ? 'COLA_30_DIAS' : undefined);
      if (prioridadSolicitada && prioridadSolicitada !== cot.vehiculo.prioridadCola) {
        const previa = cot.vehiculo.prioridadCola;
        cot.vehiculo.prioridadCola = prioridadSolicitada;
        cambioColaTexto = ` • Cola: ${previa} -> ${prioridadSolicitada}`;
      }
      if (cot.vehiculo.estado === 'RETIRADO_SIN_REPARAR') {
        cot.vehiculo.estado = 'COTIZADO';
      }
      await this.vehiculoRepo.save(cot.vehiculo);
    }

    const detalleTexto =
      detallesCambiosItems.length > 0 ? ` [${detallesCambiosItems.join(' | ')}]` : '';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'COTIZACION',
      entidadReferencia: `${cot.vehiculo?.marca || ''} ${cot.vehiculo?.modelo || ''} (${cot.vehiculo?.vinChasis || ''}) - Cotización v${cot.version}`,
      tipoAccion: 'EDICION_PRECIO_COTIZACION_AMARILLO',
      valorAnterior: `USD $${montoAnterior} (Original inmutable: $${cot.montoOriginalUsd})`,
      valorNuevo: `USD $${cot.montoAcordadoUsd}${detalleTexto}${cambioColaTexto} — Estado: AMARILLO`,
      motivoEdicion: cot.motivoEdicionAcuerdo,
      editadoPor: cot.autorizadoEdicionBolivia,
      aprobadoPor: 'Pendiente Verificación Contraparte',
    });

    await this.notificacionesService.crearYEmitir(
      'COTIZACION_EDITADA',
      `Cotización v${cot.version} en Estado AMARILLO (${cot.vehiculo?.marca} ${cot.vehiculo?.modelo})`,
      `Editada por ${cot.autorizadoEdicionBolivia}: de USD $${montoAnterior} a USD $${cot.montoAcordadoUsd}. Motivo: ${cot.motivoEdicionAcuerdo}`,
      this.getDestinoContraparte(paisActor),
      {
        moduloDestino: 'cotizacion',
        vehiculoId: cot.vehiculo?.id || null,
        referenciaId: cot.id,
      },
    );

    return this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
  }

  async aceptarCotizacionPasoAVerde(
    id: string,
    dto?: AceptarCotizacionDto,
    usuarioActor?: string,
    paisActor?: 'BOLIVIA' | 'CHILE',
  ): Promise<Cotizacion> {
    const cot = await this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
    if (!cot) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    if (cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') {
      throw new BadRequestException('Esta cotización ya se encuentra aprobada en estado VERDE.');
    }
    if (cot.estadoAprobacion === 'RECHAZADA_CLIENTE') {
      throw new BadRequestException(
        'No se puede aprobar en VERDE una cotización rechazada; primero reactívala mediante edición auditada.',
      );
    }

    const aprobadoPor =
      (dto?.aprobadoPor || '').trim() || usuarioActor || 'Alfredo Rojas (Encargado Chile)';
    const estadoPrevio = cot.estadoAprobacion;
    cot.estadoAprobacion = 'VERDE_ACEPTADA_POR_CHILE';
    cot.fechaAceptacionChile = new Date();
    await this.cotizacionRepo.save(cot);

    let tareasCreadas = 0;
    if (cot.vehiculo) {
      if (
        [
          'EN_PUERTO_NAVIERA',
          'EN_GRUA',
          'RECEPCIONADO',
          'COTIZADO',
          'RETIRADO_SIN_REPARAR',
        ].includes(cot.vehiculo.estado)
      ) {
        cot.vehiculo.estado = 'EN_TALLER';
        await this.vehiculoRepo.save(cot.vehiculo);
      }

      if (cot.items?.length) {
        const existingTasks = await this.tareaRepo.find({
          where: { vehiculo: { id: cot.vehiculo.id } },
        });
        const titulosExistentes = new Set(
          existingTasks.map((t) => (t.titulo || '').trim().toLowerCase()),
        );

        const tecnicos = await this.tecnicoRepo.find({
          where: { bloqueadoPorMalTrabajo: false },
          order: { promedioEstrellas: 'DESC' },
        });
        const elegir = (especialidades: string[]) =>
          tecnicos.find((t) => especialidades.includes(t.especialidad));

        const fechaTxt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hoy = new Date();
        const limite = new Date();
        limite.setDate(
          limite.getDate() + (cot.vehiculo.prioridadCola === 'ALTA_15_DIAS' ? 5 : 8),
        );

        let idx = existingTasks.length + 1;
        for (const item of cot.items) {
          const tituloEsperado = `${item.piezaZona}${item.gradoDanio !== 'NO_APLICA' ? ` (Grado ${item.gradoDanio})` : ''}`;
          const tituloNorm = tituloEsperado.trim().toLowerCase();
          const piezaNorm = (item.piezaZona || '').trim().toLowerCase();

          // Evita duplicar tareas al aprobar una adenda posterior sobre un vehículo ya en taller
          if (
            titulosExistentes.has(tituloNorm) ||
            (existingTasks.length > 0 &&
              Array.from(titulosExistentes).some(
                (t) => piezaNorm.length >= 6 && t.includes(piezaNorm),
              ))
          ) {
            continue;
          }

          const t = new TareaOrdenTrabajo();
          t.vehiculo = cot.vehiculo;
          t.orden = idx++;
          t.titulo = tituloEsperado;
          t.tipo =
            item.categoria === 'CHAPERIA'
              ? 'CHAPERIA'
              : item.categoria === 'PINTURA'
                ? 'PINTURA'
                : item.categoria === 'MECANICA_INTERNA'
                  ? 'MECANICA'
                  : 'SERVICIO_EXTERNO';

          const especialidades: Record<string, string[]> = {
            CHAPERIA: ['CHAPERO'],
            PINTURA: ['PINTOR'],
            MECANICA: ['MECANICO_PLANTA'],
            SERVICIO_EXTERNO: [
              'AIRBAG_PLASTICOS_EXTERNO',
              'ELECTRICO_EXTERNO',
              'SOLDADOR_EXTERNO',
            ],
          };
          const tecnico = elegir(especialidades[t.tipo]);
          t.tecnicoAsignadoId = tecnico ? tecnico.id : null;
          t.tecnicoAsignadoNombre = tecnico ? tecnico.nombre : 'Por asignar';
          t.pagoAcordadoUsd = item.costoInternoOTerceroUsd;
          t.pagoLiquidoFinalUsd = item.costoInternoOTerceroUsd;
          t.fechaInicio = fechaTxt(hoy);
          t.fechaLimite = fechaTxt(limite);
          t.completada = false;
          await this.tareaRepo.save(t);
          titulosExistentes.add(tituloNorm);
          tareasCreadas += 1;
        }
      }
    }

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'COTIZACION',
      entidadReferencia: `${cot.vehiculo?.marca || ''} ${cot.vehiculo?.modelo || ''} (${cot.vehiculo?.vinChasis || ''}) - Cotización v${cot.version}`,
      tipoAccion: 'ACEPTACION_FINAL_PASO_A_VERDE',
      valorAnterior: `Estado previo: ${estadoPrevio}`,
      valorNuevo: `VERDE_ACEPTADA_POR_CHILE (Monto Acordado: USD $${cot.montoAcordadoUsd}${tareasCreadas > 0 ? ` • +${tareasCreadas} tarea(s) OT` : ''})`,
      motivoEdicion: 'Conformidad bilateral confirmada. Unidad habilitada para Orden de Trabajo activa.',
      editadoPor: cot.autorizadoEdicionBolivia || cot.creadoPorChile,
      aprobadoPor,
    });

    await this.notificacionesService.crearYEmitir(
      'COTIZACION_APROBADA',
      `Cotización Aprobada en VERDE (${cot.vehiculo?.marca} ${cot.vehiculo?.modelo})`,
      `Confirmada por ${aprobadoPor} por USD $${cot.montoAcordadoUsd}. Orden de Trabajo actualizada.`,
      this.getDestinoContraparte(paisActor),
      {
        moduloDestino: 'cotizacion',
        vehiculoId: cot.vehiculo?.id || null,
        referenciaId: cot.id,
      },
    );

    return this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
  }

  async rechazarCotizacion(
    id: string,
    dto: RechazarCotizacionDto,
    usuarioActor?: string,
    paisActor?: 'BOLIVIA' | 'CHILE',
  ): Promise<Cotizacion> {
    const cot = await this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
    if (!cot) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    const motivoLimpio = (dto.motivo || '').trim();
    if (motivoLimpio.length < 4) {
      throw new BadRequestException('Debes indicar el motivo del rechazo (mínimo 4 caracteres).');
    }

    const actor =
      (dto.rechazadoPor || '').trim() || usuarioActor || 'Taller / Administración';
    const estadoPrevio = cot.estadoAprobacion;

    cot.estadoAprobacion = 'RECHAZADA_CLIENTE';
    cot.autorizadoEdicionBolivia = actor;
    cot.motivoEdicionAcuerdo = motivoLimpio;
    await this.cotizacionRepo.save(cot);

    if (dto.retirarSinReparar && cot.vehiculo) {
      cot.vehiculo.estado = 'RETIRADO_SIN_REPARAR';
      await this.vehiculoRepo.save(cot.vehiculo);
    }

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'COTIZACION',
      entidadReferencia: `${cot.vehiculo?.marca || ''} ${cot.vehiculo?.modelo || ''} (${cot.vehiculo?.vinChasis || ''}) - Cotización v${cot.version}`,
      tipoAccion: 'RECHAZO_COTIZACION_CLIENTE',
      valorAnterior: `Estado previo: ${estadoPrevio} (USD $${cot.montoAcordadoUsd})`,
      valorNuevo: `RECHAZADA_CLIENTE${dto.retirarSinReparar ? ' • Vehículo RETIRADO_SIN_REPARAR' : ''}`,
      motivoEdicion: motivoLimpio,
      editadoPor: actor,
      aprobadoPor: 'Cierre sin ejecución',
    });

    await this.notificacionesService.crearYEmitir(
      'COTIZACION_EDITADA',
      `Cotización Rechazada (${cot.vehiculo?.marca} ${cot.vehiculo?.modelo})`,
      `Registrado por ${actor}. Motivo: ${motivoLimpio}${dto.retirarSinReparar ? ' (Vehículo retirado sin reparar)' : ''}`,
      this.getDestinoContraparte(paisActor),
      {
        moduloDestino: 'cotizacion',
        vehiculoId: cot.vehiculo?.id || null,
        referenciaId: cot.id,
      },
    );

    return this.cotizacionRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'items'],
    });
  }
}
