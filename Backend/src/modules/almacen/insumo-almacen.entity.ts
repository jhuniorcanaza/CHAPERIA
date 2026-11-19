import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('insumos_almacen')
export class InsumoAlmacen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 40 })
  unidadMedida: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  stockActual: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 5 })
  stockMinimoAlerta: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoUnitarioUsd: number;
}

