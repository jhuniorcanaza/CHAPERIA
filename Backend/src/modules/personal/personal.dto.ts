import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ESPECIALIDADES_TECNICO = [
  'CHAPERO',
  'PINTOR',
  'MECANICO_PLANTA',
  'ELECTRICO_EXTERNO',
  'AIRBAG_PLASTICOS_EXTERNO',
  'SOLDADOR_EXTERNO',
] as const;

export const MODALIDADES_TECNICO = [
  'SUELDO_FIJO',
  'CONTRATO_PIEZA',
  'TERCERO_EXTERNO',
] as const;

export class CreateTecnicoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombre: string;

  @IsIn(ESPECIALIDADES_TECNICO)
  especialidad: (typeof ESPECIALIDADES_TECNICO)[number];

  @IsIn(MODALIDADES_TECNICO)
  modalidad: (typeof MODALIDADES_TECNICO)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sueldoFijoMensualUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionDesempeno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class UpdateTecnicoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombre?: string;

  @IsOptional()
  @IsIn(ESPECIALIDADES_TECNICO)
  especialidad?: (typeof ESPECIALIDADES_TECNICO)[number];

  @IsOptional()
  @IsIn(MODALIDADES_TECNICO)
  modalidad?: (typeof MODALIDADES_TECNICO)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sueldoFijoMensualUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionDesempeno?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivoEdicion: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class ToggleBloqueoTecnicoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}
