import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';
import { Roles } from '../auth/decorators';

@Controller('api')
export class OperacionesController {
  constructor(private readonly operacionesService: OperacionesService) {}

  @Get('bootstrap')
  getBootstrap(@Req() req: any) {
    return this.operacionesService.getBootstrapData(
      req.user?.pais,
      req.user?.email,
    );
  }

  @Post('herramientas/baja-o-compra')
  registrarHerramienta(@Body() dto: any, @Req() req: any) {
    return this.operacionesService.registrarHerramienta(
      dto,
      req.user?.nombreCompleto,
    );
  }

  @Roles('SUPERADMIN_BOLIVIA', 'ADMIN_BOLIVIA')
  @Get('reportes/informe-final')
  obtenerInformeFinal(@Req() req: any) {
    return this.operacionesService.obtenerInformeFinalBolivia(req.user?.rol);
  }
}
