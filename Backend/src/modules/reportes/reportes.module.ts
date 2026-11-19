import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { MovimientoInsumo } from '../almacen/movimiento-insumo.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EvidenciasFotosModule } from '../evidencias-fotos/evidencias-fotos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehiculo, MovimientoInsumo, TecnicoProveedor]),
    NotificacionesModule,
    EvidenciasFotosModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}

