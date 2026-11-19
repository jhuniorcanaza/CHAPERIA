import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type RolUsuarioSistema = 'SUPERADMIN_BOLIVIA' | 'ADMIN_BOLIVIA' | 'ENCARGADO_CHILE';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  nombreCompleto: string;

  @Column({ unique: true, length: 120 })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ length: 40, default: 'ADMIN_BOLIVIA' })
  rol: RolUsuarioSistema;

  @Column({ length: 20, default: 'BOLIVIA' })
  pais: 'BOLIVIA' | 'CHILE';

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

