import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import {
  AceptarCotizacionDto,
  AgregarAdendaDesarmeDto,
  CreateCotizacionDto,
  EditarCotizacionBoliviaDto,
  RechazarCotizacionDto,
} from './cotizacion.dto';

@Controller('api/cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Get()
  findAll(@Query('vehiculoId') vehiculoId?: string) {
    return this.cotizacionesService.findAll(vehiculoId);
  }

  @Post()
  crear(@Body() dto: CreateCotizacionDto, @Req() req: any) {
    return this.cotizacionesService.crearCotizacion(
      dto,
      req.user?.nombreCompleto,
      req.user?.pais,
    );
  }

  @Post(':id/items-adenda')
  agregarItemAdenda(
    @Param('id') id: string,
    @Body() dto: AgregarAdendaDesarmeDto,
    @Req() req: any,
  ) {
    return this.cotizacionesService.agregarItemAdendaDesarme(
      id,
      dto,
      req.user?.nombreCompleto,
      req.user?.pais,
    );
  }

  @Patch(':id/editar-bolivia')
  editarCotizacion(
    @Param('id') id: string,
    @Body() dto: EditarCotizacionBoliviaDto,
    @Req() req: any,
  ) {
    return this.cotizacionesService.editarCotizacionConHistorial(
      id,
      dto,
      req.user?.nombreCompleto,
      req.user?.pais,
    );
  }

  @Patch(':id/aceptar-chile')
  aceptarChile(
    @Param('id') id: string,
    @Body() body: AceptarCotizacionDto,
    @Req() req: any,
  ) {
    return this.cotizacionesService.aceptarCotizacionPasoAVerde(
      id,
      body,
      req.user?.nombreCompleto,
      req.user?.pais,
    );
  }

  @Patch(':id/rechazar')
  rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarCotizacionDto,
    @Req() req: any,
  ) {
    return this.cotizacionesService.rechazarCotizacion(
      id,
      dto,
      req.user?.nombreCompleto,
      req.user?.pais,
    );
  }
}
