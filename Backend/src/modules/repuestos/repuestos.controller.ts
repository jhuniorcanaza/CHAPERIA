import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RepuestosService } from './repuestos.service';
import {
  CreateRepuestoDto,
  MarcarRepuestoInstaladoDto,
  RegistrarRecepcionRepuestoDto,
  UpdateRepuestoDto,
} from './repuesto.dto';

@Controller('api/repuestos')
export class RepuestosController {
  constructor(private readonly repuestosService: RepuestosService) {}

  @Get()
  findAll(@Query('vehiculoId') vehiculoId?: string) {
    return this.repuestosService.findAll(vehiculoId);
  }

  @Post()
  solicitar(@Body() dto: CreateRepuestoDto, @Req() req: any) {
    return this.repuestosService.solicitar(dto, req.user?.nombreCompleto);
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: UpdateRepuestoDto, @Req() req: any) {
    return this.repuestosService.editarRepuesto(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/recepcion')
  recepcion(
    @Param('id') id: string,
    @Body() dto: RegistrarRecepcionRepuestoDto,
    @Req() req: any,
  ) {
    return this.repuestosService.registrarRecepcion(id, dto, req.user?.nombreCompleto);
  }

  @Patch(':id/instalado')
  instalado(
    @Param('id') id: string,
    @Body() body: MarcarRepuestoInstaladoDto,
    @Req() req: any,
  ) {
    return this.repuestosService.marcarInstalado(id, body, req.user?.nombreCompleto);
  }
}
