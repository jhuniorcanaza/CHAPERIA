import { Controller, Get, Headers, Param, Req } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { Roles } from '../auth/decorators';

@Roles('SUPERADMIN_BOLIVIA', 'ADMIN_BOLIVIA')
@Controller('api/reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('financiero')
  obtenerFinanciero(@Req() req: any, @Headers('x-user-role') _headerRol?: string) {
    return this.reportesService.obtenerResumenFinancieroGlobal(req.user?.rol);
  }

  @Get('informe-final-pdf-data/:id')
  obtenerInformeFinal(@Param('id') id: string, @Req() req: any) {
    return this.reportesService.obtenerDatosInformeFinalPdf(id, req.user?.rol);
  }
}
