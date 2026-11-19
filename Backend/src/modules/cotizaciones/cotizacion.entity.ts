import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { CotizacionItem } from './cotizacion-item.entity';

@Entity('cotizaciones')
export class Cotizacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehiculo, (v) => v.cotizaciones, { onDelete: 'CASCADE' })
  vehiculo: Vehiculo;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  montoOriginalUsd: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  montoAcordadoUsd: number;

  @Column({ length: 50, default: 'PENDIENTE_REVISION_BOLIVIA' })
  estadoAprobacion:
    | 'PENDIENTE_REVISION_BOLIVIA'
    | 'AMARILLO_EDITADA_POR_BOLIVIA'
    | 'VERDE_ACEPTADA_POR_CHILE'
    | 'RECHAZADA_CLIENTE';

  @Column({ length: 100, default: 'Alfredo (Chile)' })
  creadoPorChile: string;

  @Column({ length: 100, nullable: true })
  autorizadoEdicionBolivia: string;

  @Column({ type: 'text', nullable: true })
  motivoEdicionAcuerdo: string;

  @Column({ type: 'timestamp', nullable: true })
  fechaAceptacionChile: Date;

  @OneToMany(() => CotizacionItem, (item) => item.cotizacion, { cascade: true, eager: true })
  items: CotizacionItem[];

  @CreateDateColumn()
  creadoEn: Date;
}

