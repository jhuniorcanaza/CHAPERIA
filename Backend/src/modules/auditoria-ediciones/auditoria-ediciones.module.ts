import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialEdicion } from './historial-edicion.entity';
import { AuditoriaEdicionesService } from './auditoria-ediciones.service';
import { AuditoriaEdicionesController } from './auditoria-ediciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HistorialEdicion])],
  controllers: [AuditoriaEdicionesController],
  providers: [AuditoriaEdicionesService],
  exports: [AuditoriaEdicionesService, TypeOrmModule],
})
export class AuditoriaEdicionesModule {}

