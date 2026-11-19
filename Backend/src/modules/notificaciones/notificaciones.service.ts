import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionTiempoReal, TipoNotificacion } from './notificacion.entity';
import { ConfiguracionGlobal } from './configuracion.entity';
import { ModuloDestinoTab, RealtimeService } from '../../common/services/realtime.service';
import { RequestContextService } from '../../common/services/request-context.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';

export interface NotificacionMetadata {
  moduloDestino?: ModuloDestinoTab;
  vehiculoId?: string | null;
  referenciaId?: string | null;
  subTabDestino?: string | null;
  actorEmail?: string | null;
  actorNombre?: string | null;
}

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(NotificacionTiempoReal)
    private readonly notifRepo: Repository<NotificacionTiempoReal>,
    @InjectRepository(ConfiguracionGlobal)
    private readonly configRepo: Repository<ConfiguracionGlobal>,
    private readonly realtimeService: RealtimeService,
    private readonly auditoriaService: AuditoriaEdicionesService,
    @Optional() private readonly requestContext?: RequestContextService,
  ) {}

  private mapearParaUsuario(n: NotificacionTiempoReal, emailKey: string | null) {
    const leidaMap =
      n.leidaPor && typeof n.leidaPor === 'object' ? n.leidaPor : {};
    const rawReadTs = emailKey ? leidaMap[emailKey] : null;
    const legacyRead = Boolean(
      n.leida && Object.keys(leidaMap).length === 0 && !n.actorEmail,
    );
    const isRead = Boolean(rawReadTs) || legacyRead;
    return {
      ...n,
      leida: isRead,
      leidaEn: rawReadTs ? new Date(rawReadTs) : legacyRead ? n.leidaEn : null,
    };
  }

  private inferirModuloDestino(tipo: string): ModuloDestinoTab {
    switch (tipo) {
      case 'RECEPCION_VEHICULO':
        return 'recepcion';
      case 'COTIZACION_EDITADA':
      case 'COTIZACION_APROBADA':
        return 'cotizacion';
      case 'ATRASO_TAREA':
      case 'TAREA_OT':
      case 'CALIDAD_MASILLA':
        return 'ordenes';
      case 'REPUESTO_SOLICITADO':
      case 'REPUESTO_RECIBIDO':
      case 'REPUESTO_OBSERVADO':
        return 'repuestos';
      case 'COMPRA_INSUMO':
      case 'STOCK_BAJO':
        return 'almacen';
      case 'SOLICITUD_HERRAMIENTA':
      case 'BAJA_HERRAMIENTA':
      case 'BLOQUEO_PERSONAL':
        return 'herramientas';
      case 'VEHICULO_FINALIZADO':
        return 'reportes';
      default:
        return 'dashboard';
    }
  }

  async findAllRecent(
    paisUsuario?: 'BOLIVIA' | 'CHILE',
    soloNoLeidas = false,
    userEmail?: string,
  ) {
    const emailKey = userEmail ? userEmail.trim().toLowerCase() : null;
    const qb = this.notifRepo
      .createQueryBuilder('n')
      .orderBy('n.creadoEn', 'DESC')
      .take(100);

    if (paisUsuario) {
      qb.andWhere('n.destinoRol IN (:...destinos)', {
        destinos: ['TODOS', paisUsuario],
      });
    }
    if (paisUsuario === 'CHILE') {
      qb.andWhere('n.moduloDestino != :rep', { rep: 'reportes' });
    }
    if (emailKey) {
      qb.andWhere('(n.actorEmail IS NULL OR LOWER(n.actorEmail) != :emailKey)', {
        emailKey,
      });
    }

    const rawList = await qb.getMany();
    const mapped = rawList.map((n) => this.mapearParaUsuario(n, emailKey));
    const filtered = soloNoLeidas ? mapped.filter((n) => !n.leida) : mapped;
    return filtered.slice(0, 40);
  }

  async getConfiguracion() {
    const list = await this.configRepo.find();
    return (
      list[0] || {
        tasaUsdAClp: 980,
        multaPorDiaRetrasoUsd: 20,
        gastosFijosMensualesTallerUsd: 2400,
      }
    );
  }

  async actualizarConfiguracion(
    dto: {
      tasaUsdAClp: number;
      multaPorDiaRetrasoUsd: number;
      gastosFijosMensualesTallerUsd: number;
      motivo?: string;
    },
    usuarioNombre: string,
  ) {
    const existentes = await this.configRepo.find();
    let config = existentes[0];
    const valorAnterior = config
      ? `USD/CLP: ${config.tasaUsdAClp}, Multa/día: USD $${config.multaPorDiaRetrasoUsd}, Gastos fijos/mes: USD $${config.gastosFijosMensualesTallerUsd}`
      : 'Valores por defecto';

    if (!config) {
      config = this.configRepo.create({
        tasaUsdAClp: dto.tasaUsdAClp,
        multaPorDiaRetrasoUsd: dto.multaPorDiaRetrasoUsd,
        gastosFijosMensualesTallerUsd: dto.gastosFijosMensualesTallerUsd,
      });
    } else {
      config.tasaUsdAClp = dto.tasaUsdAClp;
      config.multaPorDiaRetrasoUsd = dto.multaPorDiaRetrasoUsd;
      config.gastosFijosMensualesTallerUsd = dto.gastosFijosMensualesTallerUsd;
    }

    const saved = await this.configRepo.save(config);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: 'Parámetros Globales del Taller',
      tipoAccion: 'ACTUALIZACION_PARAMETROS_ECONOMICOS',
      valorAnterior,
      valorNuevo: `USD/CLP: ${saved.tasaUsdAClp}, Multa/día: USD $${saved.multaPorDiaRetrasoUsd}, Gastos fijos/mes: USD $${saved.gastosFijosMensualesTallerUsd}`,
      motivoEdicion:
        dto.motivo?.trim() || 'Actualización de tipo de cambio, multa diaria y gastos fijos mensuales.',
      editadoPor: usuarioNombre,
      aprobadoPor: 'Administración / Gerencia Bolivia',
    });

    await this.crearYEmitir(
      'CONFIGURACION_ACTUALIZADA',
      'Parámetros Globales Actualizados',
      `Tasa 1 USD = ${saved.tasaUsdAClp} CLP · Multa retraso: USD $${saved.multaPorDiaRetrasoUsd}/día · Gastos fijos: USD $${saved.gastosFijosMensualesTallerUsd}/mes.`,
      'TODOS',
      { moduloDestino: 'dashboard' },
    );

    return saved;
  }

  async crearYEmitir(
    tipo: TipoNotificacion | string,
    titulo: string,
    mensaje: string,
    destinoRol: 'TODOS' | 'BOLIVIA' | 'CHILE' = 'TODOS',
    meta?: NotificacionMetadata,
  ) {
    const moduloDestino = meta?.moduloDestino || this.inferirModuloDestino(tipo);
    const actor = this.requestContext?.getUser();
    const actorEmail =
      meta?.actorEmail !== undefined
        ? meta.actorEmail?.trim().toLowerCase() || null
        : actor?.email || null;
    const actorNombre =
      meta?.actorNombre !== undefined
        ? meta.actorNombre || null
        : actor?.nombreCompleto || null;

    const notif = await this.notifRepo.save({
      tipo: String(tipo).slice(0, 40),
      titulo: titulo.slice(0, 158),
      mensaje,
      destinoRol,
      moduloDestino,
      vehiculoId: meta?.vehiculoId || null,
      referenciaId: meta?.referenciaId || null,
      subTabDestino: meta?.subTabDestino || null,
      actorEmail,
      actorNombre,
      leidaPor: {},
      leida: false,
      leidaEn: null,
    });

    this.realtimeService.emitEvent({
      id: notif.id,
      tipo,
      titulo: notif.titulo,
      mensaje: notif.mensaje,
      destinoRol,
      moduloDestino: notif.moduloDestino,
      vehiculoId: notif.vehiculoId,
      referenciaId: notif.referenciaId,
      subTabDestino: notif.subTabDestino,
      actorEmail: notif.actorEmail,
      actorNombre: notif.actorNombre,
      data: notif,
    });

    return notif;
  }

  async marcarUnaLeida(
    id: string,
    paisUsuario?: 'BOLIVIA' | 'CHILE',
    userEmail?: string,
  ) {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) {
      throw new NotFoundException('Notificación no encontrada.');
    }

    if (
      (paisUsuario &&
        notif.destinoRol !== 'TODOS' &&
        notif.destinoRol !== paisUsuario) ||
      (paisUsuario === 'CHILE' && notif.moduloDestino === 'reportes')
    ) {
      throw new ForbiddenException('No tienes permiso para modificar esta notificación.');
    }

    const emailKey = userEmail ? userEmail.trim().toLowerCase() : null;
    if (emailKey) {
      const currentMap =
        notif.leidaPor && typeof notif.leidaPor === 'object' ? notif.leidaPor : {};
      if (!currentMap[emailKey]) {
        notif.leidaPor = {
          ...currentMap,
          [emailKey]: new Date().toISOString(),
        };
        await this.notifRepo.save(notif);
      }
      return this.mapearParaUsuario(notif, emailKey);
    }

    if (!notif.leida) {
      notif.leida = true;
      notif.leidaEn = new Date();
      await this.notifRepo.save(notif);
    }

    return notif;
  }

  async marcarTodasLeidas(
    paisUsuario?: 'BOLIVIA' | 'CHILE',
    userEmail?: string,
  ) {
    const emailKey = userEmail ? userEmail.trim().toLowerCase() : null;
    const qb = this.notifRepo.createQueryBuilder('n');
    if (paisUsuario) {
      qb.andWhere('n.destinoRol IN (:...destinos)', {
        destinos: ['TODOS', paisUsuario],
      });
    }
    if (paisUsuario === 'CHILE') {
      qb.andWhere('n.moduloDestino != :rep', { rep: 'reportes' });
    }
    if (emailKey) {
      qb.andWhere('(n.actorEmail IS NULL OR LOWER(n.actorEmail) != :emailKey)', {
        emailKey,
      });
    }

    const visibles = await qb.getMany();
    const nowIso = new Date().toISOString();
    const nowDate = new Date();
    const toUpdate: NotificacionTiempoReal[] = [];

    for (const notif of visibles) {
      if (emailKey) {
        const currentMap =
          notif.leidaPor && typeof notif.leidaPor === 'object' ? notif.leidaPor : {};
        if (!currentMap[emailKey]) {
          notif.leidaPor = {
            ...currentMap,
            [emailKey]: nowIso,
          };
          toUpdate.push(notif);
        }
      } else if (!notif.leida) {
        notif.leida = true;
        notif.leidaEn = nowDate;
        toUpdate.push(notif);
      }
    }

    if (toUpdate.length > 0) {
      await this.notifRepo.save(toUpdate);
    }
    return { ok: true, marcadas: toUpdate.length };
  }
}
