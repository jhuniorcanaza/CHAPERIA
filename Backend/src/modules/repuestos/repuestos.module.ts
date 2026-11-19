import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepuestoVehiculo } from './repuesto-vehiculo.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { RepuestosService } from './repuestos.service';
import { RepuestosController } from './repuestos.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RepuestoVehiculo, Vehiculo, EvidenciaFotografica]),
    NotificacionesModule,
    AuditoriaEdicionesModule,
  ],
  controllers: [RepuestosController],
  providers: [RepuestosService],
  exports: [RepuestosService, TypeOrmModule],
})
export class RepuestosModule {}

