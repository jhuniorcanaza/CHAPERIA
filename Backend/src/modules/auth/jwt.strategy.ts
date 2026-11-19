import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuariosService } from '../usuarios/usuarios.service';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  rol: 'SUPERADMIN_BOLIVIA' | 'ADMIN_BOLIVIA' | 'ENCARGADO_CHILE';
  pais: 'BOLIVIA' | 'CHILE';
  nombreCompleto: string;
  puedeVerReportesEInformeFinal: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usuariosService: UsuariosService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'chaperia_pro_super_secret_key_bolivia_chile_2026',
    });
  }

  async validate(payload: { sub: string }): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token JWT inválido.');
    }

    const user = await this.usuariosService.findById(payload.sub);
    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario inactivo o no autorizado.');
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      rol: user.rol,
      pais: user.pais,
      nombreCompleto: user.nombreCompleto,
      puedeVerReportesEInformeFinal: user.rol !== 'ENCARGADO_CHILE',
    };
  }
}
