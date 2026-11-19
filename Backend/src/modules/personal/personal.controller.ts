import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { PersonalService } from './personal.service';
import {
  CreateTecnicoDto,
  ToggleBloqueoTecnicoDto,
  UpdateTecnicoDto,
} from './personal.dto';

@Controller('api/personal')
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  @Get('tecnicos')
  findAll() {
    return this.personalService.findAll();
  }

  @Post('tecnicos')
  crear(@Body() dto: CreateTecnicoDto, @Req() req: any) {
    return this.personalService.crear(dto, req.user?.nombreCompleto);
  }

  @Patch('tecnicos/:id')
  editar(
    @Param('id') id: string,
    @Body() dto: UpdateTecnicoDto,
    @Req() req: any,
  ) {
    return this.personalService.editar(id, dto, req.user?.nombreCompleto);
  }

  @Patch('tecnicos/:id/toggle-bloqueo')
  toggleBloqueo(
    @Param('id') id: string,
    @Body() dto: ToggleBloqueoTecnicoDto,
    @Req() req: any,
  ) {
    return this.personalService.toggleBloqueo(id, dto, req.user?.nombreCompleto);
  }
}
