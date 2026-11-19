import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Cotizacion } from './cotizacion.entity';

@Entity('cotizacion_items')
export class CotizacionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cotizacion, (c) => c.items, { onDelete: 'CASCADE' })
  cotizacion: Cotizacion;

  @Column({ length: 40 })
  categoria: 'CHAPERIA' | 'PINTURA' | 'MECANICA_INTERNA' | 'SERVICIO_TERCERO';

  @Column({ length: 100 })
  piezaZona: string;

  @Column({ length: 30, default: 'NO_APLICA' })
  gradoDanio: 'NO_APLICA' | 'LEVE' | 'FUERTE';

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoInternoOTerceroUsd: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  precioCotizadoOriginalUsd: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  precioAcordadoClienteUsd: number;

  @Column({ nullable: true })
  fotoDesarmeAdendaWebp: string;

  @Column({ type: 'text', nullable: true })
  descripcionFotoAdenda: string;
}

