import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { RecepcionCheckIn } from './recepcion-checkin.entity';
import { Cotizacion } from '../cotizaciones/cotizacion.entity';
import { TareaOrdenTrabajo } from '../ordenes-trabajo/tarea-ot.entity';
import { RepuestoVehiculo } from '../repuestos/repuesto-vehiculo.entity';

@Entity('vehiculos')
export class Vehiculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60 })
  vinChasis: string;

  @Column({ length: 60 })
  placaOLote: string;

  @Column({ length: 80 })
  marca: string;

  @Column({ length: 80 })
  modelo: string;

  @Column({ type: 'int', default: 2023 })
  anio: number;

  @Column({ length: 40 })
  color: string;

  @Column({ length: 40, default: 'INTERNO_IMPORTADORA' })
  tipoCliente: 'INTERNO_IMPORTADORA' | 'EXTERNO_CALLE';

  @Column({ length: 120 })
  nombreCliente: string;

  @Column({ length: 40, nullable: true })
  telefonoCliente: string;

  @Column({ length: 40, default: 'ALTA_15_DIAS' })
  prioridadCola: 'ALTA_15_DIAS' | 'COLA_30_DIAS';

  @Column({ length: 40, default: 'EN_TALLER' })
  estado:
    | 'EN_PUERTO_NAVIERA'
    | 'EN_GRUA'
    | 'RECEPCIONADO'
    | 'COTIZADO'
    | 'EN_TALLER'
    | 'RETIRADO_SIN_REPARAR'
    | 'FINALIZADO';

  @Column({ length: 100, nullable: true })
  navieraNombre: string;

  @Column({ nullable: true })
  ordenTraspasoPdfUrl: string;

  @Column({ default: false })
  navieraPagada: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoGruaImportadoraUsd: number;

  @OneToOne(() => RecepcionCheckIn, (c) => c.vehiculo, { cascade: true, eager: true })
  checkIn: RecepcionCheckIn;

  @OneToMany(() => Cotizacion, (cot) => cot.vehiculo, { cascade: true, eager: true })
  cotizaciones: Cotizacion[];

  @OneToMany(() => TareaOrdenTrabajo, (t) => t.vehiculo, { cascade: true, eager: true })
  tareasOt: TareaOrdenTrabajo[];

  @OneToMany(() => RepuestoVehiculo, (r) => r.vehiculo, { cascade: true, eager: true })
  repuestos: RepuestoVehiculo[];

  @CreateDateColumn()
  fechaIngreso: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaFinalizado: Date;
}

