import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistorialEdicion, ModuloAuditoria } from './historial-edicion.entity';
import { RealtimeService } from '../../common/services/realtime.service';

export interface RegistrarEdicionInput {
  modulo: ModuloAuditoria;
  entidadReferencia: string;
  tipoAccion: string;
  valorAnterior: string;
  valorNuevo: string;
  motivoEdicion: string;
  editadoPor: string;
  aprobadoPor?: string;
  evidenciaFotoUrl?: string;
  evidenciaDescripcion?: string;
}

@Injectable()
export class AuditoriaEdicionesService {
  constructor(
    @InjectRepository(HistorialEdicion)
    private readonly auditoriaRepo: Repository<HistorialEdicion>,
    private readonly realtimeService: RealtimeService,
  ) {}

  async findAll(modulo?: ModuloAuditoria): Promise<HistorialEdicion[]> {
    if (modulo) {
      return this.auditoriaRepo.find({
        where: { modulo },
        order: { fechaRegistro: 'DESC' },
      });
    }
    return this.auditoriaRepo.find({
      order: { fechaRegistro: 'DESC' },
      take: 100,
    });
  }

  async registrarEdicionInmutable(input: RegistrarEdicionInput): Promise<HistorialEdicion> {
    const motivo = (input.motivoEdicion || '').trim();
    if (!motivo || motivo.length < 4) {
      throw new BadRequestException(
        'REGLA DE AUDITORÍA: Toda edición requiere obligatoriamente un motivo detallado de al menos 4 caracteres.',
      );
    }

    const registro = this.auditoriaRepo.create({
      modulo: input.modulo,
      entidadReferencia: input.entidadReferencia,
      tipoAccion: input.tipoAccion,
      valorAnterior: input.valorAnterior,
      valorNuevo: input.valorNuevo,
      motivoEdicion: motivo,
      editadoPor: input.editadoPor,
      aprobadoPor: input.aprobadoPor || 'Pendiente de Firma / Verificación',
      evidenciaFotoUrl: input.evidenciaFotoUrl || null,
      evidenciaDescripcion: input.evidenciaDescripcion || null,
      bloqueadoContraBorrado: true,
    });

    const saved = await this.auditoriaRepo.save(registro);

    this.realtimeService.emitEvent({
      tipo: 'AUDITORIA_INMUTABLE',
      titulo: `Edición Registrada en Auditoría (${saved.modulo})`,
      mensaje: `${saved.entidadReferencia}: ${saved.valorAnterior} → ${saved.valorNuevo}. Editado por: ${saved.editadoPor}.`,
      destinoRol: 'TODOS',
      moduloDestino: 'dashboard',
      referenciaId: saved.id,
      data: saved,
    });

    return saved;
  }

  intentarBorrarRegistro(_id: string): never {
    throw new ForbiddenException(
      '🔒 BLOQUEO DE SEGURIDAD Y AUDITORÍA: El historial de ediciones es 100% INMUTABLE (Append-Only). Ningún usuario (ni siquiera SuperAdmin) puede borrar o alterar un registro pasado.',
    );
  }
}

