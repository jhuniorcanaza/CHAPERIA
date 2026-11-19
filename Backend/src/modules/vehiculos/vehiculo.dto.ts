import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FotoCheckInItemDto {
  @IsString()
  @MinLength(2)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcionBreve?: string;

  @IsString()
  url: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pesoKb: number;
}

export class CreateVehiculoCheckInDto {
  @IsString()
  @MinLength(4, { message: 'El VIN/Chasis debe tener al menos 4 caracteres.' })
  vinChasis: string;

  @IsOptional()
  @IsString()
  placaOLote?: string;

  @IsString()
  @MinLength(2)
  marca: string;

  @IsString()
  @MinLength(1)
  modelo: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1960)
  @Max(2035)
  anio?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['INTERNO_IMPORTADORA', 'EXTERNO_CALLE'])
  tipoCliente?: 'INTERNO_IMPORTADORA' | 'EXTERNO_CALLE';

  @IsString()
  @MinLength(2)
  nombreCliente: string;

  @IsOptional()
  @IsString()
  telefonoCliente?: string;

  @IsOptional()
  @IsIn(['ALTA_15_DIAS', 'COLA_30_DIAS'])
  prioridadCola?: 'ALTA_15_DIAS' | 'COLA_30_DIAS';

  @IsOptional()
  @IsIn(['EN_PUERTO_NAVIERA', 'EN_GRUA', 'RECEPCIONADO'])
  estado?: 'EN_PUERTO_NAVIERA' | 'EN_GRUA' | 'RECEPCIONADO';

  // Fase 0 Naviera / Grúa
  @IsOptional()
  @IsString()
  navieraNombre?: string;

  @IsOptional()
  @IsString()
  ordenTraspasoPdfUrl?: string;

  @IsOptional()
  @IsBoolean()
  navieraPagada?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoGruaImportadoraUsd?: number;

  // Check-In Accesorios
  @IsOptional()
  @IsBoolean()
  tieneLlantaAuxilio?: boolean;

  @IsOptional()
  @IsBoolean()
  tieneGataYrench?: boolean;

  @IsOptional()
  @IsBoolean()
  tienePisosCompletos?: boolean;

  @IsOptional()
  @IsBoolean()
  tieneRadioOriginal?: boolean;

  @IsOptional()
  @IsString()
  estadoFaroles?: string;

  @IsOptional()
  @IsBoolean()
  airbagsReventados?: boolean;

  @IsOptional()
  @IsString()
  observacionesIngreso?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FotoCheckInItemDto)
  fotosIngresoWebp?: FotoCheckInItemDto[];
}

export class UpdateCheckInDto {
  @IsOptional()
  @IsString()
  placaOLote?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  telefonoCliente?: string;

  @IsOptional()
  @IsIn(['ALTA_15_DIAS', 'COLA_30_DIAS'])
  prioridadCola?: 'ALTA_15_DIAS' | 'COLA_30_DIAS';

  @IsOptional()
  @IsIn([
    'EN_PUERTO_NAVIERA',
    'EN_GRUA',
    'RECEPCIONADO',
    'COTIZADO',
    'EN_TALLER',
    'RETIRADO_SIN_REPARAR',
  ])
  estado?:
    | 'EN_PUERTO_NAVIERA'
    | 'EN_GRUA'
    | 'RECEPCIONADO'
    | 'COTIZADO'
    | 'EN_TALLER'
    | 'RETIRADO_SIN_REPARAR';

  @IsOptional()
  @IsBoolean()
  tieneLlantaAuxilio?: boolean;

  @IsOptional()
  @IsBoolean()
  tieneGataYrench?: boolean;

  @IsOptional()
  @IsBoolean()
  tienePisosCompletos?: boolean;

  @IsOptional()
  @IsBoolean()
  tieneRadioOriginal?: boolean;

  @IsOptional()
  @IsString()
  estadoFaroles?: string;

  @IsOptional()
  @IsBoolean()
  airbagsReventados?: boolean;

  @IsOptional()
  @IsString()
  observacionesIngreso?: string;

  @IsOptional()
  @IsString()
  navieraNombre?: string;

  @IsOptional()
  @IsBoolean()
  navieraPagada?: boolean;

  @IsOptional()
  @IsString()
  ordenTraspasoPdfUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoGruaImportadoraUsd?: number;

  @IsString()
  @MinLength(3, {
    message: 'Debes indicar el motivo de la actualización para la auditoría inmutable.',
  })
  motivoEdicion: string;

  @IsOptional()
  @IsString()
  editadoPor?: string;
}

export class AddFotoCheckInDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcionBreve?: string;

  @IsString()
  url: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pesoKb: number;
}
