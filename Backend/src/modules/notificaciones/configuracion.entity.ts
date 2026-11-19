import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('configuraciones')
export class ConfiguracionGlobal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 980 })
  tasaUsdAClp: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 20 })
  multaPorDiaRetrasoUsd: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 2400 })
  gastosFijosMensualesTallerUsd: number;
}

