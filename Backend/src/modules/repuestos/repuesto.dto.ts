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

export const RESULTADOS_RECEPCION_REPUESTO = [
  'RECIBIDO_OK',
  'OBSERVADO_NO_COMPATIBLE',
] as const;

export class CreateRepuestoDto {
  @IsUUID()
  vehiculoId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombreRepuesto: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  proveedorOrigen?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoRepuestoUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  solicitadoPor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class RegistrarRecepcionRepuestoDto {
  @IsIn(RESULTADOS_RECEPCION_REPUESTO)
  resultado: (typeof RESULTADOS_RECEPCION_REPUESTO)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigoSerie?: string;

  @IsString()
  @MinLength(5)
  fotoUrl: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  descripcionFoto: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoRepuestoUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  proveedorOrigen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}

export class MarcarRepuestoInstaladoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class UpdateRepuestoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  nombreRepuesto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  proveedorOrigen?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoRepuestoUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigoSerie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(300)
  motivoEdicion: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;
}
