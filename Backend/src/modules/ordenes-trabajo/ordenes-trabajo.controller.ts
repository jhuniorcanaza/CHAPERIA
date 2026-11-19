import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import {
  AplicarMultaDto,
  CambiarEstadoTareaDto,
  CreateTareaOtDto,
  DarProrrogaDto,
  ReasignarTecnicoDto,
} from './tarea-ot.dto';

@Controller('api/tareas')
export class OrdenesTrabajoController {
  constructor(private readonly ordenesService: OrdenesTrabajoService) {}

  @Get()
  findAll(@Query('vehiculoId') vehiculoId?: string) {
    return this.ordenesService.findAll(vehiculoId);
  }

  @Post()
  crear(@Body() dto: CreateTareaOtDto, @Req() req: any) {
    return this.ordenesService.crearTarea(dto, req.user?.nombreCompleto);
  }

  @Post('recalcular-atrasos')
  recalcular() {
    return this.ordenesService.recalcularAtrasos();
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: CambiarEstadoTareaDto,
    @Req() req: any,
  ) {
    return this.ordenesService.cambiarEstadoTarea(id, body, req.user?.nombreCompleto);
  }

  @Patch(':id/prorroga')
  prorroga(@Param('id') id: string, @Body() dto: DarProrrogaDto, @Req() req: any) {
    return this.ordenesService.darProrroga(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/multa')
  multa(@Param('id') id: string, @Body() dto: AplicarMultaDto, @Req() req: any) {
    return this.ordenesService.aplicarMulta(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/reasignar')
  reasignar(
    @Param('id') id: string,
    @Body() dto: ReasignarTecnicoDto,
    @Req() req: any,
  ) {
    return this.ordenesService.reasignarTecnico(id, dto, req.user?.nombreCompleto);
  }
}
