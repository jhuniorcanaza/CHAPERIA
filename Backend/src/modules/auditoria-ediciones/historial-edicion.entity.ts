import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ModuloAuditoria =
  | 'RECEPCION'
  | 'COTIZACION'
  | 'ORDEN_TRABAJO'
  | 'REPUESTOS'
  | 'ALMACEN_INSUMOS'
  | 'HERRAMIENTAS'
  | 'CONFIGURACION';

@Entity('historial_ediciones')
export class HistorialEdicion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  modulo: ModuloAuditoria;

  @Column({ length: 140 })
  entidadReferencia: string;

  @Column({ length: 120 })
  tipoAccion: string;

  // Guarda el valor anterior exacto (nunca se sobreescribe ni borra)
  @Column({ type: 'text' })
  valorAnterior: string;

  // Guarda el nuevo valor aplicado
  @Column({ type: 'text' })
  valorNuevo: string;

  // Motivo obligatorio de la edición
  @Column({ type: 'text' })
  motivoEdicion: string;

  @Column({ length: 120 })
  editadoPor: string;

  @Column({ length: 120, nullable: true })
  aprobadoPor: string;

  @Column({ nullable: true })
  evidenciaFotoUrl: string;

  @Column({ length: 160, nullable: true })
  evidenciaDescripcion: string;

  @Column({ default: true })
  bloqueadoContraBorrado: boolean;

  @CreateDateColumn()
  fechaRegistro: Date;
}

