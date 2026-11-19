import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TecnicoProveedor } from './tecnico-proveedor.entity';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TecnicoProveedor]),
    AuditoriaEdicionesModule,
    NotificacionesModule,
  ],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService],
})
export class PersonalModule {}

