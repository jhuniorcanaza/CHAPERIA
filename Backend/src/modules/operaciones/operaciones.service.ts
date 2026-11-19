import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { InsumoAlmacen } from '../almacen/insumo-almacen.entity';
import { MovimientoInsumo } from '../almacen/movimiento-insumo.entity';
import { HerramientaTaller } from '../herramientas/herramienta-taller.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EvidenciasFotosService } from '../evidencias-fotos/evidencias-fotos.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';

// Servicio de consolidación: carga inicial del sistema, herramientas e informe final.
// Las reglas de cada módulo (vehículos, cotizaciones, OT, repuestos, almacén) viven en su propio módulo.
@Injectable()
export class OperacionesService {
  constructor(
    @InjectRepository(Vehiculo) private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(InsumoAlmacen) private readonly insumoRepo: Repository<InsumoAlmacen>,
    @InjectRepository(MovimientoInsumo) private readonly movInsumoRepo: Repository<MovimientoInsumo>,
    @InjectRepository(HerramientaTaller) private readonly herramientaRepo: Repository<HerramientaTaller>,
    @InjectRepository(TecnicoProveedor) private readonly tecnicoRepo: Repository<TecnicoProveedor>,
    private readonly notificacionesService: NotificacionesService,
    private readonly evidenciasService: EvidenciasFotosService,
    private readonly auditoriaService: AuditoriaEdicionesService,
  ) {}

  async getBootstrapData(
    paisUsuario?: 'BOLIVIA' | 'CHILE',
    userEmail?: string,
  ) {
    const [
      vehiculos,
      tecnicos,
      insumos,
      movimientosInsumo,
      herramientas,
      configuracion,
      notificaciones,
      evidenciasFotograficas,
      historialEdiciones,
    ] = await Promise.all([
      this.vehiculoRepo.find({
        order: { fechaIngreso: 'DESC' },
        relationLoadStrategy: 'query',
      }),
      this.tecnicoRepo.find({ order: { promedioEstrellas: 'DESC' } }),
      this.insumoRepo.find({ order: { nombre: 'ASC' } }),
      this.movInsumoRepo.find({ order: { fecha: 'DESC' }, take: 200 }),
      this.herramientaRepo.find({ order: { actualizadoEn: 'DESC' } }),
      this.notificacionesService.getConfiguracion(),
      this.notificacionesService.findAllRecent(paisUsuario, false, userEmail),
      this.evidenciasService.findAll(),
      this.auditoriaService.findAll(),
    ]);

    return {
      vehiculos,
      tecnicos,
      insumos,
      movimientosInsumo,
      herramientas,
      configuracion,
      notificaciones,
      evidenciasFotograficas,
      historialEdiciones,
    };
  }

  async registrarHerramienta(dto: any, usuarioActor?: string) {
    const h = new HerramientaTaller();
    h.nombre = dto.nombre;
    h.estado = dto.estado;
    h.costoCompraUsd = Number(dto.costoCompraUsd || 0);
    h.responsableBaja = dto.responsableBaja || null;
    h.tipoCausaBaja = dto.tipoCausaBaja || null;
    h.detalleBaja = dto.detalleBaja || null;
    h.fotoHerramientaRotaWebp = dto.fotoHerramientaRotaWebp || null;
    h.descripcionFotoBaja = dto.descripcionFotoBaja || dto.detalleBaja || null;
    const saved = await this.herramientaRepo.save(h);
    const actor =
      (usuarioActor || '').trim() ||
      (dto.responsableBaja || '').trim() ||
      'Usuario Autenticado';

    if (h.estado === 'DADA_DE_BAJA') {
      await this.auditoriaService.registrarEdicionInmutable({
        modulo: 'HERRAMIENTAS',
        entidadReferencia: h.nombre,
        tipoAccion: 'BAJA_DE_HERRAMIENTA',
        valorAnterior: 'Activa en taller',
        valorNuevo: `DADA_DE_BAJA (${h.tipoCausaBaja}) - Responsable: ${h.responsableBaja}`,
        motivoEdicion: h.detalleBaja || 'Baja reportada con foto en taller.',
        editadoPor: actor,
        aprobadoPor: 'Registrado con respaldo fotográfico',
        evidenciaFotoUrl: h.fotoHerramientaRotaWebp,
        evidenciaDescripcion: h.descripcionFotoBaja,
      });
    }

    await this.notificacionesService.crearYEmitir(
      h.estado === 'DADA_DE_BAJA' ? 'BAJA_HERRAMIENTA' : 'SOLICITUD_HERRAMIENTA',
      `Herramienta (${h.estado}): ${h.nombre}`,
      h.estado === 'DADA_DE_BAJA'
        ? `Dada de baja por ${h.responsableBaja} (${h.tipoCausaBaja}). Detalle: ${h.detalleBaja}`
        : `Solicitud de compra registrada (USD ${h.costoCompraUsd}).`,
      'TODOS',
      {
        moduloDestino: 'herramientas',
        referenciaId: saved.id,
        subTabDestino: 'herramientas',
      },
    );
    return saved;
  }

  async obtenerInformeFinalBolivia(rolSolicitante: string) {
    if (rolSolicitante === 'ENCARGADO_CHILE') {
      throw new ForbiddenException(
        'ACCESO RESTRINGIDO: El módulo de Reportes Financieros e Informe Final del Vehículo es exclusivo para los usuarios de Administración y Gerencia en Bolivia.',
      );
    }
    const vehiculos = await this.vehiculoRepo.find({ order: { fechaIngreso: 'DESC' } });
    return {
      autorizadoPara: rolSolicitante,
      generadoEn: new Date().toISOString(),
      vehiculos,
    };
  }
}
