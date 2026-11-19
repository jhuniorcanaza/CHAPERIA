import { Body, Controller, Get, Param, Patch, Query, Req, Sse } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Observable } from 'rxjs';
import { NotificacionesService } from './notificaciones.service';
import { RealtimeService } from '../../common/services/realtime.service';
import { Roles } from '../auth/decorators';

export class UpdateConfiguracionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'La tasa USD a CLP debe ser mayor a 0.' })
  tasaUsdAClp: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'La multa por día no puede ser negativa.' })
  multaPorDiaRetrasoUsd: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Los gastos fijos mensuales no pueden ser negativos.' })
  gastosFijosMensualesTallerUsd: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

@Controller('api')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Sse('realtime/stream')
  streamRealtime(@Req() req: any): Observable<MessageEvent> {
    return this.realtimeService.getStream(
      req.user?.pais,
      req.user?.email,
      req.user?.rol,
    );
  }

  @Get('notificaciones')
  findAll(@Req() req: any, @Query('soloNoLeidas') soloNoLeidas?: string) {
    return this.notificacionesService.findAllRecent(
      req.user?.pais,
      soloNoLeidas === 'true',
      req.user?.email,
    );
  }

  @Patch('notificaciones/:id/leer')
  marcarUnaLeida(@Param('id') id: string, @Req() req: any) {
    return this.notificacionesService.marcarUnaLeida(
      id,
      req.user?.pais,
      req.user?.email,
    );
  }

  @Patch('notificaciones/leer-todas')
  marcarLeidas(@Req() req: any) {
    return this.notificacionesService.marcarTodasLeidas(
      req.user?.pais,
      req.user?.email,
    );
  }

  @Get('configuracion')
  obtenerConfiguracion() {
    return this.notificacionesService.getConfiguracion();
  }

  @Roles('SUPERADMIN_BOLIVIA', 'ADMIN_BOLIVIA')
  @Patch('configuracion')
  actualizarConfiguracion(@Body() dto: UpdateConfiguracionDto, @Req() req: any) {
    return this.notificacionesService.actualizarConfiguracion(
      dto,
      req.user?.nombreCompleto || 'Administración Bolivia',
    );
  }
}
