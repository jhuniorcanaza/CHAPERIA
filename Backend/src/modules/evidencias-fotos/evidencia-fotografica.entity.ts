import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ModuloEvidencia =
  | 'CHECKIN_RECEPCION'
  | 'DESARME_COTIZACION'
  | 'REPUESTOS_CUENTAGOTAS'
  | 'FACTURA_INSUMO_COLORISTA'
  | 'BAJA_HERRAMIENTA'
  | 'TRASPASO_NAVIERA'
  | 'ENTREGA_FINAL';

@Entity('evidencias_fotograficas')
export class EvidenciaFotografica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  moduloOrigen: ModuloEvidencia;

  @Column({ length: 120, nullable: true })
  referenciaId: string;

  @Column({ length: 120, nullable: true })
  vehiculoReferencia: string;

  // Regla obligatoria de reunión: Cada foto debe tener su título/detalle y breve descripción
  @Column({ length: 160 })
  tituloDetalle: string;

  @Column({ type: 'text' })
  descripcionBreve: string;

  @Column()
  archivoWebpUrl: string;

  @Column({ length: 160 })
  nombreArchivo: string;

  @Column({ type: 'int', default: 0 })
  pesoOriginalKb: number;

  @Column({ type: 'int', default: 0 })
  pesoWebpKb: number;

  @Column({ length: 120 })
  subidoPor: string;

  @Column({ length: 20, default: 'CHILE' })
  paisOrigen: 'BOLIVIA' | 'CHILE';

  @CreateDateColumn()
  creadoEn: Date;
}
