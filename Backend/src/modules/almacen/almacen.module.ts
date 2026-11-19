import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsumoAlmacen } from './insumo-almacen.entity';
import { MovimientoInsumo } from './movimiento-insumo.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { AlmacenService } from './almacen.service';
import { AlmacenController } from './almacen.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsumoAlmacen, MovimientoInsumo, EvidenciaFotografica]),
    NotificacionesModule,
    AuditoriaEdicionesModule,
  ],
  controllers: [AlmacenController],
  providers: [AlmacenService],
  exports: [AlmacenService, TypeOrmModule],
})
export class AlmacenModule {}

