import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';

@Entity('tareas_ot')
export class TareaOrdenTrabajo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehiculo, (v) => v.tareasOt, { onDelete: 'CASCADE' })
  vehiculo: Vehiculo;

  @Column({ type: 'int', default: 1 })
  orden: number;

  @Column({ length: 160 })
  titulo: string;

  @Column({ length: 40 })
  tipo: 'CHAPERIA' | 'PINTURA' | 'MECANICA' | 'SERVICIO_EXTERNO' | 'CONTROL_FINAL';

  @Column({ length: 120 })
  tecnicoAsignadoNombre: string;

  @Column({ nullable: true })
  tecnicoAsignadoId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  pagoAcordadoUsd: number;

  @Column({ type: 'date', nullable: true })
  fechaInicio: string;

  @Column({ type: 'date', nullable: true })
  fechaLimite: string;

  @Column({ type: 'int', default: 0 })
  diasAtraso: number;

  @Column({ type: 'int', default: 0 })
  diasProrrogaOtorgados: number;

  @Column({ length: 160, nullable: true })
  motivoProrroga: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuentoMultaUsd: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  pagoLiquidoFinalUsd: number;

  @Column({ default: false })
  completada: boolean;

  @Column({ type: 'timestamp', nullable: true })
  fechaCompletada: Date;

  @Column({ type: 'int', nullable: true })
  calificacionEstrellas: number;

  @Column({ length: 200, nullable: true })
  notaReasignacion: string;

  // Control de calidad del pintor sobre el trabajo de chapería (exceso de masilla)
  @Column({ length: 30, nullable: true })
  controlCalidadMasilla: 'APROBADA' | 'EXCESO_MASILLA';

  @Column({ type: 'text', nullable: true })
  observacionCalidad: string;
}

