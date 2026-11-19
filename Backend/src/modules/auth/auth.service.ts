import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ChangePasswordDto, LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usuariosService.findByEmail(dto.email);
    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Contraseña incorrecta.');
    }

    const puedeVerReportesEInformeFinal = user.rol !== 'ENCARGADO_CHILE';

    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      pais: user.pais,
      nombreCompleto: user.nombreCompleto,
      puedeVerReportesEInformeFinal,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombreCompleto: user.nombreCompleto,
        email: user.email,
        rol: user.rol,
        pais: user.pais,
        permisos: {
          accesoOperativoCompleto: true,
          puedeVerReportesEInformeFinal,
        },
      },
    };
  }

  async cambiarPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usuariosService.findById(userId);
    if (!user || !user.activo) {
      throw new UnauthorizedException('Cuenta no encontrada o inactiva.');
    }

    const currentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new BadRequestException('La contraseña actual no coincide.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usuariosService.actualizarPasswordHash(user.id, newHash);

    return {
      ok: true,
      mensaje: 'Contraseña actualizada correctamente.',
    };
  }
}
