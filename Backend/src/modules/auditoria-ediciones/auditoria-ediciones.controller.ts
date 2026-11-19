import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  AuditoriaEdicionesService,
  RegistrarEdicionInput,
} from './auditoria-ediciones.service';
import { ModuloAuditoria } from './historial-edicion.entity';

@Controller('api/auditoria-ediciones')
export class AuditoriaEdicionesController {
  constructor(private readonly auditoriaService: AuditoriaEdicionesService) {}

  @Get()
  findAll(@Query('modulo') modulo?: ModuloAuditoria) {
    return this.auditoriaService.findAll(modulo);
  }

  @Post()
  registrar(@Body() body: RegistrarEdicionInput, @Req() req: any) {
    return this.auditoriaService.registrarEdicionInmutable({
      ...body,
      editadoPor: req.user?.nombreCompleto || body.editadoPor,
    });
  }

  @Delete(':id')
  eliminarProhibido(@Param('id') id: string) {
    return this.auditoriaService.intentarBorrarRegistro(id);
  }
}

