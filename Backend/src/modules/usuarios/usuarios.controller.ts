import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UsuariosService } from './usuarios.service';
import { Roles } from '../auth/decorators';
import { RolUsuarioSistema } from './usuario.entity';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  nombreCompleto: string;

  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña inicial debe tener mínimo 6 caracteres.' })
  password: string;

  @IsIn(['SUPERADMIN_BOLIVIA', 'ADMIN_BOLIVIA', 'ENCARGADO_CHILE'], {
    message: 'Rol inválido.',
  })
  rol: RolUsuarioSistema;
}

@Controller('api/usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Roles('SUPERADMIN_BOLIVIA', 'ADMIN_BOLIVIA')
  @Get()
  findAll() {
    return this.usuariosService.findAllPublic();
  }

  @Roles('SUPERADMIN_BOLIVIA')
  @Post()
  crear(@Body() dto: CreateUsuarioDto, @Req() req: any) {
    return this.usuariosService.crearUsuario(dto, req.user?.nombreCompleto || 'SuperAdmin Bolivia');
  }

  @Roles('SUPERADMIN_BOLIVIA')
  @Patch(':id/toggle-activo')
  toggleActivo(@Param('id') id: string, @Req() req: any) {
    return this.usuariosService.toggleActivo(
      id,
      req.user?.id,
      req.user?.nombreCompleto || 'SuperAdmin Bolivia',
    );
  }
}
