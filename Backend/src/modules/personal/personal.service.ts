import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TecnicoProveedor } from './tecnico-proveedor.entity';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  CreateTecnicoDto,
  ToggleBloqueoTecnicoDto,
  UpdateTecnicoDto,
} from './personal.dto';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class PersonalService {
  constructor(
    @InjectRepository(TecnicoProveedor)
    private readonly tecnicoRepo: Repository<TecnicoProveedor>,
    private readonly auditoriaService: AuditoriaEdicionesService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  findAll() {
    return this.tecnicoRepo.find({ order: { promedioEstrellas: 'DESC', nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<TecnicoProveedor> {
    const t = await this.tecnicoRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Técnico o contratista no encontrado.');
    return t;
  }

  async crear(dto: CreateTecnicoDto, usuarioActor?: string): Promise<TecnicoProveedor> {
    const nombre = (dto.nombre || '').trim();
    if (nombre.length < 3) {
      throw new BadRequestException('Indica el nombre completo del técnico o taller.');
    }

    const existente = await this.tecnicoRepo
      .createQueryBuilder('t')
      .where('LOWER(t.nombre) = LOWER(:nombre)', { nombre })
      .getOne();
    if (existente) {
      throw new BadRequestException('Ya existe un especialista o contratista con ese nombre.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const sueldo = dto.modalidad === 'SUELDO_FIJO' ? round2(dto.sueldoFijoMensualUsd || 0) : 0;

    const t = this.tecnicoRepo.create({
      nombre,
      especialidad: dto.especialidad,
      modalidad: dto.modalidad,
      sueldoFijoMensualUsd: sueldo,
      observacionDesempeno: dto.observacionDesempeno?.trim() || null,
      promedioEstrellas: 5.0,
      trabajosCompletados: 0,
      bloqueadoPorMalTrabajo: false,
    });

    const saved = await this.tecnicoRepo.save(t);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: saved.nombre,
      tipoAccion: 'ALTA_DE_TECNICO',
      valorAnterior: 'No registrado',
      valorNuevo: `Especialidad: ${saved.especialidad}, Modalidad: ${saved.modalidad}${sueldo > 0 ? `, Sueldo USD ${sueldo}` : ''}`,
      motivoEdicion: 'Alta en el directorio de técnicos y especialistas de taller.',
      editadoPor: actor,
      aprobadoPor: 'Registro de Personal',
    });

    return saved;
  }

  async editar(
    id: string,
    dto: UpdateTecnicoDto,
    usuarioActor?: string,
  ): Promise<TecnicoProveedor> {
    const t = await this.findOne(id);
    const motivo = (dto.motivoEdicion || '').trim();
    if (motivo.length < 4) {
      throw new BadRequestException('Debes ingresar el motivo de edición (mín. 4 caracteres).');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Administración';
    const anteriores: string[] = [];
    const nuevos: string[] = [];

    if (dto.nombre !== undefined) {
      const nuevoNombre = dto.nombre.trim();
      if (nuevoNombre.length < 3) {
        throw new BadRequestException('El nombre completo debe tener al menos 3 caracteres.');
      }
      if (nuevoNombre.toLowerCase() !== t.nombre.toLowerCase()) {
        const dup = await this.tecnicoRepo
          .createQueryBuilder('x')
          .where('LOWER(x.nombre) = LOWER(:nombre) AND x.id != :id', { nombre: nuevoNombre, id })
          .getOne();
        if (dup) throw new BadRequestException('Ya existe otro especialista con ese nombre.');
        anteriores.push(`Nombre: ${t.nombre}`);
        nuevos.push(`Nombre: ${nuevoNombre}`);
        t.nombre = nuevoNombre;
      }
    }

    if (dto.especialidad !== undefined && dto.especialidad !== t.especialidad) {
      anteriores.push(`Especialidad: ${t.especialidad}`);
      nuevos.push(`Especialidad: ${dto.especialidad}`);
      t.especialidad = dto.especialidad;
    }

    if (dto.modalidad !== undefined && dto.modalidad !== t.modalidad) {
      anteriores.push(`Modalidad: ${t.modalidad}`);
      nuevos.push(`Modalidad: ${dto.modalidad}`);
      t.modalidad = dto.modalidad;
    }

    const sueldoDeseado =
      t.modalidad === 'SUELDO_FIJO'
        ? dto.sueldoFijoMensualUsd !== undefined
          ? round2(dto.sueldoFijoMensualUsd)
          : round2(t.sueldoFijoMensualUsd)
        : 0;
    if (round2(t.sueldoFijoMensualUsd) !== sueldoDeseado) {
      anteriores.push(`Sueldo fijo: USD ${round2(t.sueldoFijoMensualUsd)}`);
      nuevos.push(`Sueldo fijo: USD ${sueldoDeseado}`);
      t.sueldoFijoMensualUsd = sueldoDeseado;
    }

    if (dto.observacionDesempeno !== undefined) {
      const nuevaObs = dto.observacionDesempeno.trim() || null;
      if ((t.observacionDesempeno || null) !== nuevaObs) {
        anteriores.push(`Obs: ${t.observacionDesempeno || 'Sin obs.'}`);
        nuevos.push(`Obs: ${nuevaObs || 'Sin obs.'}`);
        t.observacionDesempeno = nuevaObs;
      }
    }

    if (anteriores.length === 0) {
      throw new BadRequestException('No se detectaron cambios para guardar.');
    }

    const saved = await this.tecnicoRepo.save(t);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: saved.nombre,
      tipoAccion: 'EDICION_DE_TECNICO',
      valorAnterior: anteriores.join(' | '),
      valorNuevo: nuevos.join(' | '),
      motivoEdicion: motivo,
      editadoPor: actor,
      aprobadoPor: 'Jefatura de Personal',
    });

    return saved;
  }

  async toggleBloqueo(
    id: string,
    dto: ToggleBloqueoTecnicoDto,
    usuarioActor?: string,
  ): Promise<TecnicoProveedor> {
    const t = await this.findOne(id);
    if (!dto.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException('Debes justificar el motivo del cambio de estado.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Administración';
    const estadoAnterior = t.bloqueadoPorMalTrabajo;
    t.bloqueadoPorMalTrabajo = !estadoAnterior;
    const saved = await this.tecnicoRepo.save(t);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'CONFIGURACION',
      entidadReferencia: t.nombre,
      tipoAccion: t.bloqueadoPorMalTrabajo ? 'BLOQUEO_TECNICO' : 'DESBLOQUEO_TECNICO',
      valorAnterior: estadoAnterior ? 'BLOQUEADO' : 'HABILITADO',
      valorNuevo: t.bloqueadoPorMalTrabajo ? 'BLOQUEADO' : 'HABILITADO',
      motivoEdicion: dto.motivo.trim(),
      editadoPor: actor,
      aprobadoPor: 'Jefatura Operativa',
    });

    await this.notificacionesService.crearYEmitir(
      'BLOQUEO_PERSONAL',
      t.bloqueadoPorMalTrabajo ? `Técnico bloqueado: ${t.nombre}` : `Técnico habilitado: ${t.nombre}`,
      `Motivo: ${dto.motivo.trim()}`,
      'TODOS',
      {
        moduloDestino: 'herramientas',
        referenciaId: saved.id,
        subTabDestino: 'tecnicos',
      },
    );

    return saved;
  }
}
