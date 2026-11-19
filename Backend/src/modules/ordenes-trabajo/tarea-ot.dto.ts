import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TIPOS_TAREA_OT = [
  'CHAPERIA',
  'PINTURA',
  'MECANICA',
  'SERVICIO_EXTERNO',
  'CONTROL_FINAL',
] as const;

export const CONTROL_MASILLA_VALORES = ['APROBADA', 'EXCESO_MASILLA'] as const;

export class CreateTareaOtDto {
  @IsUUID()
  vehiculoId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  titulo: string;

  @IsIn(TIPOS_TAREA_OT)
  tipo: (typeof TIPOS_TAREA_OT)[number];

  @IsUUID()
  tecnicoAsignadoId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pagoAcordadoUsd: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD.',
  })
  fechaInicio: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaLimite debe tener formato YYYY-MM-DD.',
  })
  fechaLimite: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class CambiarEstadoTareaDto {
  @IsBoolean()
  completada: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  calificacionEstrellas?: number;

  @IsOptional()
  @IsIn(CONTROL_MASILLA_VALORES)
  controlCalidadMasilla?: (typeof CONTROL_MASILLA_VALORES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionCalidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class DarProrrogaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dias: number;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  causa: string;

  @IsString()
  @MinLength(4)
  @MaxLength(300)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class AplicarMultaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diasMora?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class ReasignarTecnicoDto {
  @IsUUID()
  nuevoTecnicoId: string;

  @IsString()
  @MinLength(4)
  @MaxLength(300)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}
