import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionTiempoReal } from './notificacion.entity';
import { ConfiguracionGlobal } from './configuracion.entity';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificacionTiempoReal, ConfiguracionGlobal]),
    AuditoriaEdicionesModule,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService, TypeOrmModule],
})
export class NotificacionesModule {}
