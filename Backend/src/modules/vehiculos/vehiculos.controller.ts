import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import {
  AddFotoCheckInDto,
  CreateVehiculoCheckInDto,
  UpdateCheckInDto,
} from './vehiculo.dto';

@Controller('api/vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Get()
  findAll() {
    return this.vehiculosService.findAll();
  }

  @Post()
  create(@Body() dto: CreateVehiculoCheckInDto) {
    return this.vehiculosService.crearVehiculoConCheckIn(dto);
  }

  @Patch(':id/checkin')
  updateCheckin(@Param('id') id: string, @Body() dto: UpdateCheckInDto, @Req() req: any) {
    return this.vehiculosService.actualizarChecklistEIngreso(
      id,
      dto,
      req.user?.nombreCompleto,
    );
  }

  @Post(':id/fotos-checkin')
  addFotoCheckIn(@Param('id') id: string, @Body() body: AddFotoCheckInDto) {
    return this.vehiculosService.agregarFotoCheckIn(id, body);
  }
}
