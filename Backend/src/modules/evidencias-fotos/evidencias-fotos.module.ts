import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenciaFotografica } from './evidencia-fotografica.entity';
import { EvidenciasFotosService } from './evidencias-fotos.service';
import { EvidenciasFotosController } from './evidencias-fotos.controller';
import { RecepcionCheckIn } from '../vehiculos/recepcion-checkin.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenciaFotografica, RecepcionCheckIn, Vehiculo])],
  controllers: [EvidenciasFotosController],
  providers: [EvidenciasFotosService],
  exports: [EvidenciasFotosService, TypeOrmModule],
})
export class EvidenciasFotosModule {}

