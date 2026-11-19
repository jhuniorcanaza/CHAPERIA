import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cotizacion } from './cotizacion.entity';
import { CotizacionItem } from './cotizacion-item.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { TareaOrdenTrabajo } from '../ordenes-trabajo/tarea-ot.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cotizacion,
      CotizacionItem,
      Vehiculo,
      TareaOrdenTrabajo,
      TecnicoProveedor,
      EvidenciaFotografica,
    ]),
    AuditoriaEdicionesModule,
    NotificacionesModule,
  ],
  controllers: [CotizacionesController],
  providers: [CotizacionesService],
  exports: [CotizacionesService, TypeOrmModule],
})
export class CotizacionesModule {}

