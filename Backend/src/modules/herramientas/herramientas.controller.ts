import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { HerramientasService } from './herramientas.service';
import {
  ActivarHerramientaDto,
  CreateHerramientaDto,
  DarDeBajaHerramientaDto,
  UpdateHerramientaDto,
} from './herramienta.dto';

@Controller('api/herramientas')
export class HerramientasController {
  constructor(private readonly herramientasService: HerramientasService) {}

  @Get()
  findAll() {
    return this.herramientasService.findAll();
  }

  @Post()
  crearOComprar(@Body() dto: CreateHerramientaDto, @Req() req: any) {
    return this.herramientasService.crearOComprar(dto, req.user?.nombreCompleto);
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() dto: UpdateHerramientaDto,
    @Req() req: any,
  ) {
    return this.herramientasService.editar(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/activar')
  activarCompra(
    @Param('id') id: string,
    @Body() dto: ActivarHerramientaDto,
    @Req() req: any,
  ) {
    return this.herramientasService.activarCompraSolicitada(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/baja')
  darDeBaja(
    @Param('id') id: string,
    @Body() dto: DarDeBajaHerramientaDto,
    @Req() req: any,
  ) {
    return this.herramientasService.darDeBaja(id, dto, req.user?.nombreCompleto);
  }
}
