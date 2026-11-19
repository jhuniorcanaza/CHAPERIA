import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const CATEGORIAS_COTIZACION = [
  'CHAPERIA',
  'PINTURA',
  'MECANICA_INTERNA',
  'SERVICIO_TERCERO',
] as const;

export const GRADOS_DANIO = ['NO_APLICA', 'LEVE', 'FUERTE'] as const;

export const PRIORIDADES_COLA = ['ALTA_15_DIAS', 'COLA_30_DIAS'] as const;

export class CreateCotizacionItemDto {
  @IsIn(CATEGORIAS_COTIZACION)
  categoria: (typeof CATEGORIAS_COTIZACION)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  piezaZona: string;

  @IsOptional()
  @IsIn(GRADOS_DANIO)
  gradoDanio?: (typeof GRADOS_DANIO)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoInternoOTerceroUsd: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioClienteUsd: number;

  @IsOptional()
  @IsString()
  fotoDesarmeAdendaWebp?: string;

  @IsOptional()
  @IsString()
  descripcionFotoAdenda?: string;
}

export class CreateCotizacionDto {
  @IsUUID()
  vehiculoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  creadoPor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionInicial?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCotizacionItemDto)
  items: CreateCotizacionItemDto[];
}

export class AgregarAdendaDesarmeDto {
  @IsIn(CATEGORIAS_COTIZACION)
  categoria: (typeof CATEGORIAS_COTIZACION)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  piezaZona: string;

  @IsOptional()
  @IsIn(GRADOS_DANIO)
  gradoDanio?: (typeof GRADOS_DANIO)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoInternoOTerceroUsd: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioClienteUsd: number;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivoAdenda: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  usuarioNombre?: string;

  @IsOptional()
  @IsString()
  fotoDesarmeAdendaWebp?: string;

  @IsOptional()
  @IsString()
  descripcionFotoAdenda?: string;
}

export class UpdateCotizacionItemDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  piezaZona?: string;

  @IsOptional()
  @IsIn(GRADOS_DANIO)
  gradoDanio?: (typeof GRADOS_DANIO)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoInternoOTerceroUsd?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioAcordadoClienteUsd: number;
}

export class EditarCotizacionBoliviaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoAcordadoUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  autorizadoPor?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pasarACola30Dias?: boolean;

  @IsOptional()
  @IsIn(PRIORIDADES_COLA)
  prioridadCola?: (typeof PRIORIDADES_COLA)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCotizacionItemDto)
  itemsActualizados?: UpdateCotizacionItemDto[];
}

export class AceptarCotizacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  aprobadoPor?: string;
}

export class RechazarCotizacionDto {
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rechazadoPor?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  retirarSinReparar?: boolean;
}
