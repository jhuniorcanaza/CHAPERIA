import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RolUsuarioSistema, Usuario } from './usuario.entity';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly auditoriaService: AuditoriaEdicionesService,
  ) {}

  async findByEmail(email: string): Promise<Usuario | null> {
    const cleanEmail = String(email || '').trim().toLowerCase();
    return this.usuarioRepo.findOne({ where: { email: cleanEmail } });
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarioRepo.findOne({ where: { id } });
  }

  async actualizarPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usuarioRepo.update({ id }, { passwordHash });
  }

  async findAllPublic() {
    const users = await this.usuarioRepo.find({ order: { creadoEn: 'ASC' } });
    return users.map((u) => ({
      id: u.id,
      nombreCompleto: u.nombreCompleto,
      email: u.email,
      rol: u.rol,
      pais: u.pais,
      activo: u.activo,
      creadoEn: u.creadoEn,
      permisos: {
        accesoOperativoCompleto: true,
        puedeVerReportesEInformeFinal: u.rol !== 'ENCARGADO_CHILE',
      },
    }));
  }

  async crearUsuario(
    dto: {
      nombreCompleto: string;
      email: string;
      password: string;
      rol: RolUsuarioSistema;
    },
    creadoPor: string,
  ) {
    const cleanEmail = String(dto.email || '').trim().toLowerCase();
    const existente = await this.findByEmail(cleanEmail);
    if (existente) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo electrónico.');
    }

    const pais: 'BOLIVIA' | 'CHILE' =
      dto.rol === 'ENCARGADO_CHILE' ? 'CHILE' : 'BOLIVIA';
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const saved = await this.usuarioRepo.save({
      nombreCompleto: dto.nombreCompleto.trim(),
      email: cleanEmail,
      passwordHash,
      rol: dto.rol,
      pais,
      activo: true,
    });

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: `Usuario: ${saved.nombreCompleto} (${saved.email})`,
      tipoAccion: 'ALTA_USUARIO_SISTEMA',
      valorAnterior: 'No existía',
      valorNuevo: `Rol: ${saved.rol} (${saved.pais})`,
      motivoEdicion: 'Creación de cuenta de acceso desde Administración Bolivia.',
      editadoPor: creadoPor,
      aprobadoPor: 'Gerencia General (Bolivia)',
    });

    return {
      id: saved.id,
      nombreCompleto: saved.nombreCompleto,
      email: saved.email,
      rol: saved.rol,
      pais: saved.pais,
      activo: saved.activo,
      creadoEn: saved.creadoEn,
    };
  }

  async toggleActivo(id: string, actorId: string, actorNombre: string) {
    if (id === actorId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta mientras tienes la sesión iniciada.');
    }
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    const anterior = user.activo ? 'ACTIVO' : 'INACTIVO';
    user.activo = !user.activo;
    await this.usuarioRepo.save(user);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: `Usuario: ${user.nombreCompleto} (${user.email})`,
      tipoAccion: user.activo ? 'REACTIVACION_USUARIO' : 'DESACTIVACION_USUARIO',
      valorAnterior: anterior,
      valorNuevo: user.activo ? 'ACTIVO' : 'INACTIVO',
      motivoEdicion: `Cambio de estado de acceso ejecutado por ${actorNombre}.`,
      editadoPor: actorNombre,
      aprobadoPor: 'Gerencia General (Bolivia)',
    });

    return {
      id: user.id,
      activo: user.activo,
    };
  }
}
