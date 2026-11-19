import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepuestoVehiculo } from './repuesto-vehiculo.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import {
  CreateRepuestoDto,
  MarcarRepuestoInstaladoDto,
  RegistrarRecepcionRepuestoDto,
  UpdateRepuestoDto,
} from './repuesto.dto';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class RepuestosService {
  constructor(
    @InjectRepository(RepuestoVehiculo)
    private readonly repuestoRepo: Repository<RepuestoVehiculo>,
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    private readonly notificacionesService: NotificacionesService,
    private readonly auditoriaService: AuditoriaEdicionesService,
  ) {}

  findAll(vehiculoId?: string) {
    const where = vehiculoId ? { vehiculo: { id: vehiculoId } } : {};
    return this.repuestoRepo.find({
      where,
      relations: ['vehiculo'],
      order: { fechaRegistro: 'DESC' },
    });
  }

  private async obtener(id: string): Promise<RepuestoVehiculo> {
    const rep = await this.repuestoRepo.findOne({ where: { id }, relations: ['vehiculo'] });
    if (!rep) throw new NotFoundException('Repuesto no encontrado.');
    return rep;
  }

  private referencia(rep: RepuestoVehiculo): string {
    return `${rep.vehiculo?.marca || ''} ${rep.vehiculo?.modelo || ''} (${rep.vehiculo?.vinChasis || ''}) - ${rep.nombreRepuesto}`;
  }

  private async vincularEvidenciaRepuesto(
    url: string | null | undefined,
    vehiculo: Vehiculo | null | undefined,
  ) {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl || !vehiculo) return;
    const ev = await this.evidenciaRepo.findOne({ where: { archivoWebpUrl: cleanUrl } });
    if (!ev) return;
    ev.referenciaId = vehiculo.id;
    ev.vehiculoReferencia = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis})`;
    await this.evidenciaRepo.save(ev);
  }

  // Los repuestos se piden "en cuentagotas": uno a uno según avanza el desarme
  async solicitar(dto: CreateRepuestoDto, usuarioActor?: string): Promise<RepuestoVehiculo> {
    const vehiculo = await this.vehiculoRepo.findOne({ where: { id: dto.vehiculoId } });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado.');
    if (!dto.nombreRepuesto || dto.nombreRepuesto.trim().length < 3) {
      throw new BadRequestException('Indica el nombre del repuesto solicitado (mín. 3 caracteres).');
    }

    const rep = new RepuestoVehiculo();
    rep.vehiculo = vehiculo;
    rep.nombreRepuesto = dto.nombreRepuesto.trim();
    rep.estado = 'SOLICITADO';
    rep.proveedorOrigen = dto.proveedorOrigen?.trim() || null;
    rep.costoRepuestoUsd = round2(dto.costoRepuestoUsd || 0);
    rep.observacion = dto.observacion?.trim() || null;
    rep.solicitadoPor =
      (dto.usuarioNombre || '').trim() ||
      (dto.solicitadoPor || '').trim() ||
      usuarioActor ||
      'Encargado Taller';
    const saved = await this.repuestoRepo.save(rep);

    await this.notificacionesService.crearYEmitir(
      'REPUESTO_SOLICITADO',
      `Repuesto solicitado: ${saved.nombreRepuesto}`,
      `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis}). Solicitado por ${saved.solicitadoPor}.`,
      'TODOS',
      {
        moduloDestino: 'repuestos',
        vehiculoId: vehiculo.id,
        referenciaId: saved.id,
      },
    );
    return saved;
  }

  // Al recibir el repuesto: código de serie + foto .webp con título y descripción (obligatorios)
  async registrarRecepcion(
    id: string,
    dto: RegistrarRecepcionRepuestoDto,
    usuarioActor?: string,
  ): Promise<RepuestoVehiculo> {
    const rep = await this.obtener(id);
    if (rep.estado === 'INSTALADO' || rep.estado === 'RECIBIDO_OK') {
      throw new BadRequestException(
        'Este repuesto ya fue recibido conforme; no admite una nueva recepción.',
      );
    }
    if (!dto.fotoUrl) {
      throw new BadRequestException('La recepción del repuesto exige una fotografía de respaldo.');
    }
    if (!dto.descripcionFoto || dto.descripcionFoto.trim().length < 5) {
      throw new BadRequestException(
        'La fotografía del repuesto debe llevar una descripción breve (mín. 5 caracteres).',
      );
    }
    if (
      dto.resultado === 'RECIBIDO_OK' &&
      (!dto.codigoSerie || dto.codigoSerie.trim().length < 3)
    ) {
      throw new BadRequestException(
        'Registra el código de serie del repuesto recibido (mín. 3 caracteres).',
      );
    }
    if (
      dto.resultado === 'OBSERVADO_NO_COMPATIBLE' &&
      (!dto.observacion || dto.observacion.trim().length < 5)
    ) {
      throw new BadRequestException(
        'Describe por qué el repuesto no es compatible (mín. 5 caracteres).',
      );
    }

    const estadoPrevio = rep.estado;
    rep.estado = dto.resultado;
    rep.codigoSerie = dto.codigoSerie?.trim() || rep.codigoSerie;
    rep.fotoRecepcionWebp = dto.fotoUrl.trim();
    rep.descripcionFotoRecepcion = dto.descripcionFoto.trim();
    if (dto.costoRepuestoUsd !== undefined && dto.costoRepuestoUsd !== null) {
      rep.costoRepuestoUsd = round2(dto.costoRepuestoUsd);
    }
    if (dto.proveedorOrigen !== undefined && dto.proveedorOrigen.trim()) {
      rep.proveedorOrigen = dto.proveedorOrigen.trim();
    }
    if (dto.observacion !== undefined) {
      rep.observacion = dto.observacion.trim() || null;
    }
    rep.fechaRecepcion = new Date();
    const saved = await this.repuestoRepo.save(rep);

    await this.vincularEvidenciaRepuesto(saved.fotoRecepcionWebp, saved.vehiculo);

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'REPUESTOS',
      entidadReferencia: this.referencia(saved),
      tipoAccion:
        dto.resultado === 'OBSERVADO_NO_COMPATIBLE'
          ? 'REPUESTO_OBSERVADO_NO_COMPATIBLE'
          : 'REPUESTO_RECIBIDO_CONFORME',
      valorAnterior: `Estado: ${estadoPrevio}`,
      valorNuevo: `Estado: ${dto.resultado} (serie ${saved.codigoSerie || 'S/N'}, USD $${saved.costoRepuestoUsd})`,
      motivoEdicion:
        dto.observacion?.trim() || dto.descripcionFoto.trim(),
      editadoPor: actor,
      aprobadoPor: 'Registrado con respaldo fotográfico',
      evidenciaFotoUrl: saved.fotoRecepcionWebp,
      evidenciaDescripcion: saved.descripcionFotoRecepcion,
    });

    await this.notificacionesService.crearYEmitir(
      dto.resultado === 'RECIBIDO_OK' ? 'REPUESTO_RECIBIDO' : 'REPUESTO_OBSERVADO',
      dto.resultado === 'RECIBIDO_OK'
        ? `Repuesto recibido: ${saved.nombreRepuesto}`
        : `Repuesto observado: ${saved.nombreRepuesto}`,
      dto.resultado === 'RECIBIDO_OK'
        ? `Serie ${saved.codigoSerie}. ${saved.descripcionFotoRecepcion}`
        : `No compatible: ${dto.observacion?.trim() || saved.descripcionFotoRecepcion}`,
      'TODOS',
      {
        moduloDestino: 'repuestos',
        vehiculoId: saved.vehiculo?.id || null,
        referenciaId: saved.id,
      },
    );
    return saved;
  }

  async editarRepuesto(
    id: string,
    dto: UpdateRepuestoDto,
    usuarioActor?: string,
  ): Promise<RepuestoVehiculo> {
    const rep = await this.obtener(id);
    const motivo = (dto.motivoEdicion || '').trim();
    if (motivo.length < 4) {
      throw new BadRequestException(
        'Toda edición de repuesto exige un motivo (mínimo 4 caracteres) para auditoría.',
      );
    }

    const resumenAnterior = `Nombre: ${rep.nombreRepuesto} | Costo: USD $${rep.costoRepuestoUsd} | Prov: ${rep.proveedorOrigen || 'N/A'} | Serie: ${rep.codigoSerie || 'N/A'}`;

    if (dto.nombreRepuesto?.trim()) rep.nombreRepuesto = dto.nombreRepuesto.trim();
    if (dto.proveedorOrigen !== undefined) {
      rep.proveedorOrigen = dto.proveedorOrigen.trim() || null;
    }
    if (dto.costoRepuestoUsd !== undefined && dto.costoRepuestoUsd !== null) {
      rep.costoRepuestoUsd = round2(dto.costoRepuestoUsd);
    }
    if (dto.codigoSerie !== undefined) {
      rep.codigoSerie = dto.codigoSerie.trim() || null;
    }
    if (dto.observacion !== undefined) {
      rep.observacion = dto.observacion.trim() || null;
    }

    const saved = await this.repuestoRepo.save(rep);
    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'REPUESTOS',
      entidadReferencia: this.referencia(saved),
      tipoAccion: 'EDICION_DATOS_REPUESTO',
      valorAnterior: resumenAnterior,
      valorNuevo: `Nombre: ${saved.nombreRepuesto} | Costo: USD $${saved.costoRepuestoUsd} | Prov: ${saved.proveedorOrigen || 'N/A'} | Serie: ${saved.codigoSerie || 'N/A'}`,
      motivoEdicion: motivo,
      editadoPor: actor,
      aprobadoPor: 'Control Administrativo Taller',
    });

    return saved;
  }

  async marcarInstalado(
    id: string,
    dto?: MarcarRepuestoInstaladoDto,
    usuarioActor?: string,
  ): Promise<RepuestoVehiculo> {
    const rep = await this.obtener(id);
    if (rep.estado !== 'RECIBIDO_OK') {
      throw new BadRequestException(
        'Solo un repuesto recibido y conforme puede marcarse como instalado.',
      );
    }
    rep.estado = 'INSTALADO';
    if (dto?.observacion?.trim()) {
      rep.observacion = dto.observacion.trim();
    }
    const saved = await this.repuestoRepo.save(rep);
    const actor = (dto?.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'REPUESTOS',
      entidadReferencia: this.referencia(saved),
      tipoAccion: 'REPUESTO_INSTALADO_EN_VEHICULO',
      valorAnterior: 'Estado: RECIBIDO_OK',
      valorNuevo: `Estado: INSTALADO (Serie: ${saved.codigoSerie || 'S/N'})`,
      motivoEdicion: dto?.observacion?.trim() || 'Pieza montada y verificada en vehículo.',
      editadoPor: actor,
      aprobadoPor: 'Jefatura de Taller',
    });

    await this.notificacionesService.crearYEmitir(
      'REPUESTO_RECIBIDO',
      `Repuesto instalado: ${saved.nombreRepuesto}`,
      `${saved.vehiculo?.marca} ${saved.vehiculo?.modelo}. Registrado por ${actor}.`,
      'TODOS',
      {
        moduloDestino: 'repuestos',
        vehiculoId: saved.vehiculo?.id || null,
        referenciaId: saved.id,
      },
    );
    return saved;
  }
}
