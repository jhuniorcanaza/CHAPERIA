import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tecnicos_proveedores')
export class TecnicoProveedor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 140 })
  nombre: string;

  @Column({ length: 50 })
  especialidad:
    | 'CHAPERO'
    | 'PINTOR'
    | 'MECANICO_PLANTA'
    | 'ELECTRICO_EXTERNO'
    | 'AIRBAG_PLASTICOS_EXTERNO'
    | 'SOLDADOR_EXTERNO';

  @Column({ length: 40 })
  modalidad: 'SUELDO_FIJO' | 'CONTRATO_PIEZA' | 'TERCERO_EXTERNO';

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  sueldoFijoMensualUsd: number;

  @Column({ type: 'numeric', precision: 3, scale: 1, default: 5.0 })
  promedioEstrellas: number;

  @Column({ default: 0 })
  trabajosCompletados: number;

  @Column({ type: 'text', nullable: true })
  observacionDesempeno: string;

  @Column({ default: false })
  bloqueadoPorMalTrabajo: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

