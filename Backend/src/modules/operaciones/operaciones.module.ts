import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { InsumoAlmacen } from '../almacen/insumo-almacen.entity';
import { MovimientoInsumo } from '../almacen/movimiento-insumo.entity';
import { HerramientaTaller } from '../herramientas/herramienta-taller.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EvidenciasFotosModule } from '../evidencias-fotos/evidencias-fotos.module';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';
import { OperacionesService } from './operaciones.service';
import { OperacionesController } from './operaciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehiculo,
      InsumoAlmacen,
      MovimientoInsumo,
      HerramientaTaller,
      TecnicoProveedor,
    ]),
    NotificacionesModule,
    EvidenciasFotosModule,
    AuditoriaEdicionesModule,
  ],
  controllers: [OperacionesController],
  providers: [OperacionesService],
  exports: [OperacionesService],
})
export class OperacionesModule {}
