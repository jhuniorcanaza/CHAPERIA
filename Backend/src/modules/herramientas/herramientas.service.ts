import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HerramientaTaller } from './herramienta-taller.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  ActivarHerramientaDto,
  CreateHerramientaDto,
  DarDeBajaHerramientaDto,
  UpdateHerramientaDto,
} from './herramienta.dto';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class HerramientasService {
  constructor(
    @InjectRepository(HerramientaTaller)
    private readonly herramientaRepo: Repository<HerramientaTaller>,
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    private readonly auditoriaService: AuditoriaEdicionesService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  findAll() {
    return this.herramientaRepo.find({ order: { actualizadoEn: 'DESC' } });
  }

  async findOne(id: string): Promise<HerramientaTaller> {
    const h = await this.herramientaRepo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Herramienta no encontrada.');
    return h;
  }

  private async vincularEvidenciaBaja(url: string | null | undefined, her: HerramientaTaller) {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl) return;
    const ev = await this.evidenciaRepo.findOne({ where: { archivoWebpUrl: cleanUrl } });
    if (!ev) return;
    ev.referenciaId = her.id;
    ev.vehiculoReferencia = `Herramienta Taller: ${her.nombre}`;
    await this.evidenciaRepo.save(ev);
  }

  async crearOComprar(
    dto: CreateHerramientaDto,
    usuarioActor?: string,
  ): Promise<HerramientaTaller> {
    const nombre = (dto.nombre || '').trim();
    if (nombre.length < 3) {
      throw new BadRequestException('Indica el nombre descriptivo de la herramienta o equipo.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const estado = dto.estado || 'ACTIVA';
    const costo = round2(dto.costoCompraUsd || 0);

    const h = this.herramientaRepo.create({
      nombre,
      estado,
      costoCompraUsd: costo,
      detalleBaja: dto.detalleBaja?.trim() || null,
    });

    const saved = await this.herramientaRepo.save(h);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'HERRAMIENTAS',
      entidadReferencia: saved.nombre,
      tipoAccion:
        saved.estado === 'COMPRA_SOLICITADA'
          ? 'SOLICITUD_COMPRA_HERRAMIENTA'
          : 'ALTA_HERRAMIENTA',
      valorAnterior: 'No inventariada',
      valorNuevo: `Estado: ${saved.estado}, Costo: USD ${saved.costoCompraUsd}`,
      motivoEdicion:
        saved.detalleBaja ||
        (saved.estado === 'COMPRA_SOLICITADA'
          ? 'Solicitud de compra / reposición de equipo en taller.'
          : 'Alta de herramienta en inventario activo del taller.'),
      editadoPor: actor,
      aprobadoPor: 'Registro de Herramientas',
    });

    await this.notificacionesService.crearYEmitir(
      'SOLICITUD_HERRAMIENTA',
      saved.estado === 'COMPRA_SOLICITADA'
        ? `Solicitud de compra de herramienta: ${saved.nombre}`
        : `Herramienta ingresada al taller: ${saved.nombre}`,
      `Estado: ${saved.estado}. Costo: USD ${saved.costoCompraUsd}.${saved.detalleBaja ? ` Detalle: ${saved.detalleBaja}` : ''}`,
      'TODOS',
      {
        moduloDestino: 'herramientas',
        referenciaId: saved.id,
        subTabDestino: 'herramientas',
      },
    );

    return saved;
  }

  async editar(
    id: string,
    dto: UpdateHerramientaDto,
    usuarioActor?: string,
  ): Promise<HerramientaTaller> {
    const h = await this.findOne(id);
    const motivo = (dto.motivoEdicion || '').trim();
    if (motivo.length < 4) {
      throw new BadRequestException('Debes ingresar el motivo de edición (mín. 4 caracteres).');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const anteriores: string[] = [];
    const nuevos: string[] = [];

    if (dto.nombre !== undefined) {
      const nuevoNombre = dto.nombre.trim();
      if (nuevoNombre.length < 3) {
        throw new BadRequestException('El nombre debe tener al menos 3 caracteres.');
      }
      if (nuevoNombre !== h.nombre) {
        anteriores.push(`Nombre: ${h.nombre}`);
        nuevos.push(`Nombre: ${nuevoNombre}`);
        h.nombre = nuevoNombre;
      }
    }

    if (
      dto.costoCompraUsd !== undefined &&
      round2(dto.costoCompraUsd) !== round2(h.costoCompraUsd)
    ) {
      anteriores.push(`Costo: USD ${round2(h.costoCompraUsd)}`);
      nuevos.push(`Costo: USD ${round2(dto.costoCompraUsd)}`);
      h.costoCompraUsd = round2(dto.costoCompraUsd);
    }

    if (anteriores.length === 0) {
      throw new BadRequestException('No se detectaron cambios en la herramienta.');
    }

    const saved = await this.herramientaRepo.save(h);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'HERRAMIENTAS',
      entidadReferencia: saved.nombre,
      tipoAccion: 'EDICION_DE_HERRAMIENTA',
      valorAnterior: anteriores.join(' | '),
      valorNuevo: nuevos.join(' | '),
      motivoEdicion: motivo,
      editadoPor: actor,
      aprobadoPor: 'Inventario de Herramientas',
    });

    return saved;
  }

  async activarCompraSolicitada(
    id: string,
    dto: ActivarHerramientaDto,
    usuarioActor?: string,
  ): Promise<HerramientaTaller> {
    const h = await this.findOne(id);
    if (h.estado !== 'COMPRA_SOLICITADA') {
      throw new BadRequestException('Solo se puede confirmar el ingreso de herramientas en estado COMPRA_SOLICITADA.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const costoPrevio = round2(h.costoCompraUsd);
    const nuevoCosto =
      dto.costoCompraUsd !== undefined ? round2(dto.costoCompraUsd) : costoPrevio;

    h.estado = 'ACTIVA';
    h.costoCompraUsd = nuevoCosto;

    const saved = await this.herramientaRepo.save(h);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'HERRAMIENTAS',
      entidadReferencia: saved.nombre,
      tipoAccion: 'RECEPCION_COMPRA_HERRAMIENTA',
      valorAnterior: `COMPRA_SOLICITADA (Est. USD ${costoPrevio})`,
      valorNuevo: `ACTIVA en taller (Costo USD ${nuevoCosto})`,
      motivoEdicion: dto.motivo?.trim() || 'Compra aprobada e ingresada físicamente al inventario del taller.',
      editadoPor: actor,
      aprobadoPor: 'Control de Herramientas',
    });

    await this.notificacionesService.crearYEmitir(
      'SOLICITUD_HERRAMIENTA',
      `Herramienta recibida y activa: ${saved.nombre}`,
      `Ingresó al inventario operativo con costo USD ${saved.costoCompraUsd}.`,
      'TODOS',
      {
        moduloDestino: 'herramientas',
        referenciaId: saved.id,
        subTabDestino: 'herramientas',
      },
    );

    return saved;
  }

  async darDeBaja(
    id: string,
    dto: DarDeBajaHerramientaDto,
    usuarioActor?: string,
  ): Promise<HerramientaTaller> {
    const h = await this.findOne(id);
    if (h.estado === 'DADA_DE_BAJA') {
      throw new BadRequestException('Esta herramienta ya fue dada de baja anteriormente.');
    }

    if (!dto.responsableBaja || dto.responsableBaja.trim().length < 3) {
      throw new BadRequestException('Indica la persona o técnico responsable de la herramienta.');
    }
    if (!dto.detalleBaja || dto.detalleBaja.trim().length < 5) {
      throw new BadRequestException('Detalla el motivo o circunstancia en que se dañó la herramienta.');
    }
    if (!dto.fotoHerramientaRotaWebp) {
      throw new BadRequestException('La baja de una herramienta exige fotografía de evidencia obligatoria.');
    }
    if (!dto.descripcionFotoBaja || dto.descripcionFotoBaja.trim().length < 5) {
      throw new BadRequestException('Indica una descripción breve para la fotografía de respaldo.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const estadoPrevio = h.estado;

    h.estado = 'DADA_DE_BAJA';
    h.tipoCausaBaja = dto.tipoCausaBaja;
    h.responsableBaja = dto.responsableBaja.trim();
    h.detalleBaja = dto.detalleBaja.trim();
    h.fotoHerramientaRotaWebp = dto.fotoHerramientaRotaWebp.trim();
    h.descripcionFotoBaja = dto.descripcionFotoBaja.trim();

    const saved = await this.herramientaRepo.save(h);
    await this.vincularEvidenciaBaja(saved.fotoHerramientaRotaWebp, saved);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'HERRAMIENTAS',
      entidadReferencia: saved.nombre,
      tipoAccion: 'BAJA_DE_HERRAMIENTA',
      valorAnterior: estadoPrevio,
      valorNuevo: `DADA_DE_BAJA (${saved.tipoCausaBaja}) - Responsable: ${saved.responsableBaja}`,
      motivoEdicion: saved.detalleBaja,
      editadoPor: actor,
      aprobadoPor: 'Auditoría de Herramientas (Bolivia / Chile)',
      evidenciaFotoUrl: saved.fotoHerramientaRotaWebp,
      evidenciaDescripcion: saved.descripcionFotoBaja,
    });

    await this.notificacionesService.crearYEmitir(
      'BAJA_HERRAMIENTA',
      `Baja de herramienta: ${saved.nombre} (${saved.tipoCausaBaja})`,
      `Responsable: ${saved.responsableBaja}. Motivo: ${saved.detalleBaja}`,
      'TODOS',
      {
        moduloDestino: 'herramientas',
        referenciaId: saved.id,
        subTabDestino: 'herramientas',
      },
    );

    return saved;
  }
}
