import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';
import { RecepcionCheckIn } from './recepcion-checkin.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import {
  AddFotoCheckInDto,
  CreateVehiculoCheckInDto,
  UpdateCheckInDto,
} from './vehiculo.dto';

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(RecepcionCheckIn)
    private readonly checkinRepo: Repository<RecepcionCheckIn>,
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    private readonly notificacionesService: NotificacionesService,
    private readonly auditoriaService: AuditoriaEdicionesService,
  ) {}

  async findAll(): Promise<Vehiculo[]> {
    return this.vehiculoRepo.find({
      order: { fechaIngreso: 'DESC' },
    });
  }

  async crearVehiculoConCheckIn(dto: CreateVehiculoCheckInDto): Promise<Vehiculo> {
    const vinNormalizado = String(dto.vinChasis || '').trim().toUpperCase();
    if (!vinNormalizado || !dto.marca || !dto.modelo || !dto.nombreCliente) {
      throw new BadRequestException(
        'Los campos VIN/Chasis, Marca, Modelo y Nombre del Cliente son obligatorios.',
      );
    }

    const existente = await this.vehiculoRepo.findOne({ where: { vinChasis: vinNormalizado } });
    if (existente) {
      throw new BadRequestException(
        `Ya existe un vehículo registrado con el VIN ${vinNormalizado} (${existente.marca} ${existente.modelo}).`,
      );
    }

    const v = new Vehiculo();
    v.vinChasis = vinNormalizado;
    v.placaOLote = String(dto.placaOLote || 'SIN-LOTE').trim().toUpperCase();
    v.marca = String(dto.marca).trim();
    v.modelo = String(dto.modelo).trim();
    v.anio = Number(dto.anio || 2023);
    v.color = String(dto.color || 'Blanco').trim();
    v.tipoCliente = dto.tipoCliente || 'INTERNO_IMPORTADORA';
    v.nombreCliente = String(dto.nombreCliente).trim();
    v.telefonoCliente = String(dto.telefonoCliente || '').trim();
    v.prioridadCola = dto.prioridadCola || 'ALTA_15_DIAS';

    // Datos exclusivos de Fase 0 (Unidades Internas de la Importadora desde Naviera)
    if (v.tipoCliente === 'INTERNO_IMPORTADORA') {
      v.estado = dto.estado || 'RECEPCIONADO';
      v.navieraNombre = dto.navieraNombre || 'MSC Mediterranean Shipping';
      v.ordenTraspasoPdfUrl = dto.ordenTraspasoPdfUrl || null;
      v.navieraPagada = Boolean(dto.navieraPagada);
      v.costoGruaImportadoraUsd = Number(dto.costoGruaImportadoraUsd || 0);
    } else {
      v.estado = 'RECEPCIONADO';
      v.navieraNombre = null;
      v.ordenTraspasoPdfUrl = null;
      v.navieraPagada = false;
      v.costoGruaImportadoraUsd = 0;
    }

    const checkin = new RecepcionCheckIn();
    checkin.tieneLlantaAuxilio = Boolean(dto.tieneLlantaAuxilio);
    checkin.tieneGataYrench = Boolean(dto.tieneGataYrench);
    checkin.tienePisosCompletos = Boolean(dto.tienePisosCompletos);
    checkin.tieneRadioOriginal = Boolean(dto.tieneRadioOriginal);
    checkin.estadoFaroles = String(dto.estadoFaroles || 'Verificado en recepción').trim();
    checkin.airbagsReventados = Boolean(dto.airbagsReventados);
    checkin.observacionesIngreso = String(dto.observacionesIngreso || '').trim();
    checkin.fotosIngresoWebp = Array.isArray(dto.fotosIngresoWebp) ? dto.fotosIngresoWebp : [];

    v.checkIn = checkin;
    v.cotizaciones = [];
    v.tareasOt = [];
    v.repuestos = [];

    const saved = await this.vehiculoRepo.save(v);

    await this.vincularEvidenciasConVehiculo(saved);

    await this.notificacionesService.crearYEmitir(
      'RECEPCION_VEHICULO',
      `Vehículo en Recepción: ${saved.marca} ${saved.modelo} (${saved.anio})`,
      `VIN: ${saved.vinChasis} • Estado: ${saved.estado} • Modalidad: ${saved.tipoCliente === 'INTERNO_IMPORTADORA' ? 'Importadora (Naviera/Grúa)' : 'Cliente Externo'}.`,
      'TODOS',
      {
        moduloDestino: 'recepcion',
        vehiculoId: saved.id,
        referenciaId: saved.id,
      },
    );

    return saved;
  }

  async actualizarChecklistEIngreso(
    vehiculoId: string,
    dto: UpdateCheckInDto,
    usuarioActor?: string,
  ): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: vehiculoId },
      relations: ['checkIn'],
    });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado.');
    }

    const motivo = (dto.motivoEdicion || '').trim();
    if (motivo.length < 3) {
      throw new BadRequestException(
        'Debes indicar el motivo de actualización en Recepción / Traspaso.',
      );
    }

    const resumenAnterior = [
      `Estado: ${vehiculo.estado}`,
      `Prioridad: ${vehiculo.prioridadCola}`,
      vehiculo.tipoCliente === 'INTERNO_IMPORTADORA'
        ? `Naviera Pagada: ${vehiculo.navieraPagada ? 'Sí' : 'No'}, Grúa: USD $${vehiculo.costoGruaImportadoraUsd}, PDF: ${vehiculo.ordenTraspasoPdfUrl ? 'Cargado' : 'Pendiente'}`
        : null,
      `Faroles: ${vehiculo.checkIn?.estadoFaroles || 'S/D'}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const estadoPrevio = vehiculo.estado;

    if (dto.placaOLote !== undefined) vehiculo.placaOLote = dto.placaOLote.trim().toUpperCase();
    if (dto.color !== undefined) vehiculo.color = dto.color.trim();
    if (dto.telefonoCliente !== undefined) vehiculo.telefonoCliente = dto.telefonoCliente.trim();
    if (dto.prioridadCola !== undefined) vehiculo.prioridadCola = dto.prioridadCola;
    if (dto.estado !== undefined) vehiculo.estado = dto.estado;

    if (vehiculo.tipoCliente === 'INTERNO_IMPORTADORA') {
      if (dto.navieraNombre !== undefined) vehiculo.navieraNombre = dto.navieraNombre.trim();
      if (dto.navieraPagada !== undefined) vehiculo.navieraPagada = Boolean(dto.navieraPagada);
      if (dto.ordenTraspasoPdfUrl !== undefined) {
        vehiculo.ordenTraspasoPdfUrl = dto.ordenTraspasoPdfUrl || null;
      }
      if (dto.costoGruaImportadoraUsd !== undefined) {
        vehiculo.costoGruaImportadoraUsd = Number(dto.costoGruaImportadoraUsd);
      }
    }

    if (vehiculo.checkIn) {
      if (dto.tieneLlantaAuxilio !== undefined) {
        vehiculo.checkIn.tieneLlantaAuxilio = Boolean(dto.tieneLlantaAuxilio);
      }
      if (dto.tieneGataYrench !== undefined) {
        vehiculo.checkIn.tieneGataYrench = Boolean(dto.tieneGataYrench);
      }
      if (dto.tienePisosCompletos !== undefined) {
        vehiculo.checkIn.tienePisosCompletos = Boolean(dto.tienePisosCompletos);
      }
      if (dto.tieneRadioOriginal !== undefined) {
        vehiculo.checkIn.tieneRadioOriginal = Boolean(dto.tieneRadioOriginal);
      }
      if (dto.estadoFaroles !== undefined) {
        vehiculo.checkIn.estadoFaroles = dto.estadoFaroles.trim();
      }
      if (dto.airbagsReventados !== undefined) {
        vehiculo.checkIn.airbagsReventados = Boolean(dto.airbagsReventados);
      }
      if (dto.observacionesIngreso !== undefined) {
        vehiculo.checkIn.observacionesIngreso = dto.observacionesIngreso.trim();
      }
      await this.checkinRepo.save(vehiculo.checkIn);
    }

    const saved = await this.vehiculoRepo.save(vehiculo);
    await this.vincularEvidenciasConVehiculo(saved);

    const resumenNuevo = [
      `Estado: ${saved.estado}`,
      `Prioridad: ${saved.prioridadCola}`,
      saved.tipoCliente === 'INTERNO_IMPORTADORA'
        ? `Naviera Pagada: ${saved.navieraPagada ? 'Sí' : 'No'}, Grúa: USD $${saved.costoGruaImportadoraUsd}, PDF: ${saved.ordenTraspasoPdfUrl ? 'Cargado' : 'Pendiente'}`
        : null,
      `Faroles: ${saved.checkIn?.estadoFaroles || 'S/D'}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const autor = usuarioActor || dto.editadoPor || 'Encargado Taller';

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'RECEPCION',
      entidadReferencia: `${saved.marca} ${saved.modelo} (${saved.vinChasis})`,
      tipoAccion:
        estadoPrevio !== saved.estado
          ? `CAMBIO_ESTADO_RECEPCION (${estadoPrevio} -> ${saved.estado})`
          : 'ACTUALIZACION_RECEPCION_Y_CHECKIN',
      valorAnterior: resumenAnterior,
      valorNuevo: resumenNuevo,
      motivoEdicion: motivo,
      editadoPor: autor,
      aprobadoPor: autor,
    });

    await this.notificacionesService.crearYEmitir(
      'RECEPCION_VEHICULO',
      `Recepción Actualizada: ${saved.marca} ${saved.modelo} (${saved.placaOLote})`,
      `${motivo} • Estado actual: ${saved.estado}.`,
      'TODOS',
      {
        moduloDestino: 'recepcion',
        vehiculoId: saved.id,
        referenciaId: saved.id,
      },
    );

    return saved;
  }

  async agregarFotoCheckIn(vehiculoId: string, foto: AddFotoCheckInDto): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: vehiculoId },
      relations: ['checkIn'],
    });
    if (!vehiculo || !vehiculo.checkIn) {
      throw new NotFoundException('Vehículo o registro de Check-In no encontrado.');
    }

    const actuales = Array.isArray(vehiculo.checkIn.fotosIngresoWebp)
      ? vehiculo.checkIn.fotosIngresoWebp
      : [];

    if (!actuales.some((item) => item.url === foto.url)) {
      vehiculo.checkIn.fotosIngresoWebp = [
        ...actuales,
        {
          titulo: foto.titulo.trim(),
          descripcionBreve: foto.descripcionBreve?.trim(),
          url: foto.url,
          pesoKb: Number(foto.pesoKb || 0),
        },
      ];
      await this.checkinRepo.save(vehiculo.checkIn);
    }

    await this.vincularEvidenciasConVehiculo(vehiculo);

    return this.vehiculoRepo.findOne({ where: { id: vehiculoId } });
  }

  /**
   * Asocia las evidencias subidas durante la creación o edición (PDF Traspaso y fotos Check-In)
   * con el ID real y nombre legible del vehículo para trazabilidad e Informe Final PDF.
   */
  private async vincularEvidenciasConVehiculo(vehiculo: Vehiculo): Promise<void> {
    const urls: string[] = [];
    if (vehiculo.ordenTraspasoPdfUrl) {
      urls.push(vehiculo.ordenTraspasoPdfUrl);
    }
    if (Array.isArray(vehiculo.checkIn?.fotosIngresoWebp)) {
      for (const f of vehiculo.checkIn.fotosIngresoWebp) {
        if (f.url) urls.push(f.url);
      }
    }
    if (urls.length === 0) return;

    const evidencias = await this.evidenciaRepo.find({
      where: { archivoWebpUrl: In(urls) },
    });
    const etiquetaVehiculo = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio} (${vehiculo.placaOLote})`;
    for (const ev of evidencias) {
      let dirty = false;
      if (ev.referenciaId !== vehiculo.id) {
        ev.referenciaId = vehiculo.id;
        dirty = true;
      }
      if (ev.vehiculoReferencia !== etiquetaVehiculo) {
        ev.vehiculoReferencia = etiquetaVehiculo;
        dirty = true;
      }
      if (dirty) {
        await this.evidenciaRepo.save(ev);
      }
    }
  }
}
