import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';

@Entity('repuestos_vehiculo')
export class RepuestoVehiculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehiculo, (v) => v.repuestos, { onDelete: 'CASCADE' })
  vehiculo: Vehiculo;

  @Column({ length: 140 })
  nombreRepuesto: string;

  @Column({ length: 40, default: 'SOLICITADO' })
  estado: 'SOLICITADO' | 'RECIBIDO_OK' | 'OBSERVADO_NO_COMPATIBLE' | 'INSTALADO';

  @Column({ length: 80, nullable: true })
  codigoSerie: string;

  @Column({ nullable: true })
  fotoRecepcionWebp: string;

  @Column({ type: 'text', nullable: true })
  descripcionFotoRecepcion: string;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @Column({ length: 120, nullable: true })
  solicitadoPor: string;

  @Column({ length: 140, nullable: true })
  proveedorOrigen: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoRepuestoUsd: number;

  @Column({ type: 'timestamp', nullable: true })
  fechaRecepcion: Date;

  @CreateDateColumn()
  fechaRegistro: Date;
}

