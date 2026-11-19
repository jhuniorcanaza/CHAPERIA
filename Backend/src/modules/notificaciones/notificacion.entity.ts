import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ModuloDestinoTab } from '../../common/services/realtime.service';

export type TipoNotificacion =
  | 'RECEPCION_VEHICULO'
  | 'COTIZACION_EDITADA'
  | 'COTIZACION_APROBADA'
  | 'ATRASO_TAREA'
  | 'TAREA_OT'
  | 'CALIDAD_MASILLA'
  | 'REPUESTO_SOLICITADO'
  | 'REPUESTO_RECIBIDO'
  | 'REPUESTO_OBSERVADO'
  | 'COMPRA_INSUMO'
  | 'STOCK_BAJO'
  | 'SOLICITUD_HERRAMIENTA'
  | 'BAJA_HERRAMIENTA'
  | 'VEHICULO_FINALIZADO'
  | 'EVIDENCIA_FOTOGRAFICA'
  | 'BLOQUEO_PERSONAL'
  | 'CONFIGURACION_ACTUALIZADA';

@Entity('notificaciones')
export class NotificacionTiempoReal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  tipo: TipoNotificacion | string;

  @Column({ length: 160 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ length: 30, default: 'TODOS' })
  destinoRol: 'TODOS' | 'BOLIVIA' | 'CHILE';

  @Column({ length: 40, default: 'dashboard' })
  moduloDestino: ModuloDestinoTab;

  @Column({ length: 80, nullable: true })
  vehiculoId: string | null;

  @Column({ length: 120, nullable: true })
  referenciaId: string | null;

  @Column({ length: 60, nullable: true })
  subTabDestino: string | null;

  @Column({ length: 160, nullable: true })
  actorEmail: string | null;

  @Column({ length: 160, nullable: true })
  actorNombre: string | null;

  @Column({ type: 'jsonb', default: {} })
  leidaPor: Record<string, string>;

  @Column({ default: false })
  leida: boolean;

  @Column({ type: 'timestamp', nullable: true })
  leidaEn: Date | null;

  @CreateDateColumn()
  creadoEn: Date;
}
