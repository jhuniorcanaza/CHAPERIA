import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('herramientas_taller')
export class HerramientaTaller {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 140 })
  nombre: string;

  @Column({ length: 40, default: 'ACTIVA' })
  estado: 'ACTIVA' | 'DADA_DE_BAJA' | 'COMPRA_SOLICITADA';

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costoCompraUsd: number;

  @Column({ length: 120, nullable: true })
  responsableBaja: string;

  @Column({ length: 40, nullable: true })
  tipoCausaBaja: 'DESGASTE_NORMAL' | 'MAL_USO_COBRAR';

  @Column({ type: 'text', nullable: true })
  detalleBaja: string;

  @Column({ nullable: true })
  fotoHerramientaRotaWebp: string;

  @Column({ type: 'text', nullable: true })
  descripcionFotoBaja: string;

  @CreateDateColumn()
  actualizadoEn: Date;
}

