import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './login.dto';
import { Public } from './decorators';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('perfil')
  perfil(@Req() req: any) {
    return {
      user: {
        id: req.user.id,
        nombreCompleto: req.user.nombreCompleto,
        email: req.user.email,
        rol: req.user.rol,
        pais: req.user.pais,
        permisos: {
          accesoOperativoCompleto: true,
          puedeVerReportesEInformeFinal: req.user.puedeVerReportesEInformeFinal,
        },
      },
    };
  }

  @Patch('cambiar-password')
  cambiarPassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.cambiarPassword(req.user.id, dto);
  }
}
