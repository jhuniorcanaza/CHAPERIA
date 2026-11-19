import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('movimientos_insumo')
export class MovimientoInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  tipo: 'ENTRADA_STOCK' | 'SALIDA_POR_TAREA' | 'COMPRA_PINTURA_COLORISTA';

  @Column({ length: 140 })
  insumoNombre: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  cantidad: number;

  @Column({ length: 30 })
  unidad: string;

  @Column({ length: 120, nullable: true })
  vehiculoReferencia: string;

  @Column({ length: 120, nullable: true })
  tareaReferencia: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoTotalUsd: number;

  @Column({ nullable: true })
  fotoFacturaWebp: string;

  @Column({ type: 'text', nullable: true })
  descripcionFotoFactura: string;

  @CreateDateColumn()
  fecha: Date;
}

