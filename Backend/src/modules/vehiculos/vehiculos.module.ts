import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from './vehiculo.entity';
import { RecepcionCheckIn } from './recepcion-checkin.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehiculo, RecepcionCheckIn, EvidenciaFotografica]),
    NotificacionesModule,
    AuditoriaEdicionesModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService],
  exports: [VehiculosService, TypeOrmModule],
})
export class VehiculosModule {}

