import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Vehiculo } from './vehiculo.entity';

export interface FotoCheckInDetalle {
  titulo: string;
  descripcionBreve?: string;
  url: string;
  pesoKb: number;
}

@Entity('recepciones_checkin')
export class RecepcionCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Vehiculo, (v) => v.checkIn, { onDelete: 'CASCADE' })
  @JoinColumn()
  vehiculo: Vehiculo;

  @Column({ default: true })
  tieneLlantaAuxilio: boolean;

  @Column({ default: true })
  tieneGataYrench: boolean;

  @Column({ default: true })
  tienePisosCompletos: boolean;

  @Column({ default: true })
  tieneRadioOriginal: boolean;

  @Column({ length: 120, default: 'Farol derecho roto en puerto' })
  estadoFaroles: string;

  @Column({ default: false })
  airbagsReventados: boolean;

  @Column({ type: 'text', nullable: true })
  observacionesIngreso: string;

  @Column({ type: 'jsonb', default: [] })
  fotosIngresoWebp: FotoCheckInDetalle[];
}

