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

export const ESTADOS_ALTA_HERRAMIENTA = ['ACTIVA', 'COMPRA_SOLICITADA'] as const;
export const CAUSAS_BAJA_HERRAMIENTA = [
  'DESGASTE_NORMAL',
  'MAL_USO_COBRAR',
] as const;

export class CreateHerramientaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombre: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoCompraUsd?: number;

  @IsOptional()
  @IsIn(ESTADOS_ALTA_HERRAMIENTA)
  estado?: (typeof ESTADOS_ALTA_HERRAMIENTA)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detalleBaja?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class UpdateHerramientaDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoCompraUsd?: number;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivoEdicion: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class ActivarHerramientaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoCompraUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class DarDeBajaHerramientaDto {
  @IsIn(CAUSAS_BAJA_HERRAMIENTA)
  tipoCausaBaja: (typeof CAUSAS_BAJA_HERRAMIENTA)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  responsableBaja: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  detalleBaja: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  fotoHerramientaRotaWebp: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  descripcionFotoBaja: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}
