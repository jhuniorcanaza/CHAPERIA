import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TIPOS_MOVIMIENTO_INSUMO = [
  'ENTRADA_STOCK',
  'SALIDA_POR_TAREA',
  'COMPRA_PINTURA_COLORISTA',
] as const;

export class CreateInsumoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unidadMedida: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMinimoAlerta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoUnitarioUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class UpdateInsumoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unidadMedida?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMinimoAlerta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoUnitarioUsd?: number;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivoEdicion: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class RegistrarMovimientoAlmacenDto {
  @IsIn(TIPOS_MOVIMIENTO_INSUMO)
  tipo: (typeof TIPOS_MOVIMIENTO_INSUMO)[number];

  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  insumoNombre?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unidad?: string;

  @IsOptional()
  @IsUUID()
  vehiculoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehiculoReferencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tareaReferencia?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoTotalUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoFacturaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionFotoFactura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}
