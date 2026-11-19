import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { AlmacenService } from './almacen.service';
import {
  CreateInsumoDto,
  RegistrarMovimientoAlmacenDto,
  UpdateInsumoDto,
} from './almacen.dto';

@Controller('api/almacen')
export class AlmacenController {
  constructor(private readonly almacenService: AlmacenService) {}

  @Get('insumos')
  insumos() {
    return this.almacenService.listarInsumos();
  }

  @Get('movimientos')
  movimientos() {
    return this.almacenService.listarMovimientos();
  }

  @Post('insumos')
  crearInsumo(@Body() dto: CreateInsumoDto, @Req() req: any) {
    return this.almacenService.crearInsumo(dto, req.user?.nombreCompleto);
  }

  @Patch('insumos/:id')
  editarInsumo(
    @Param('id') id: string,
    @Body() dto: UpdateInsumoDto,
    @Req() req: any,
  ) {
    return this.almacenService.editarInsumo(id, dto, req.user?.nombreCompleto);
  }

  @Post('movimientos')
  registrarMovimiento(@Body() dto: RegistrarMovimientoAlmacenDto, @Req() req: any) {
    return this.almacenService.registrarMovimiento(dto, req.user?.nombreCompleto);
  }
}
