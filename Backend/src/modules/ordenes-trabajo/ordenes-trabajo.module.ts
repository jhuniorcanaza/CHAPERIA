import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TareaOrdenTrabajo } from './tarea-ot.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TareaOrdenTrabajo, Vehiculo, TecnicoProveedor]),
    NotificacionesModule,
    AuditoriaEdicionesModule,
  ],
  controllers: [OrdenesTrabajoController],
  providers: [OrdenesTrabajoService],
  exports: [OrdenesTrabajoService, TypeOrmModule],
})
export class OrdenesTrabajoModule {}

