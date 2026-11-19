import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HerramientaTaller } from './herramienta-taller.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { HerramientasService } from './herramientas.service';
import { HerramientasController } from './herramientas.controller';
import { AuditoriaEdicionesModule } from '../auditoria-ediciones/auditoria-ediciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HerramientaTaller, EvidenciaFotografica]),
    AuditoriaEdicionesModule,
    NotificacionesModule,
  ],
  controllers: [HerramientasController],
  providers: [HerramientasService],
  exports: [HerramientasService],
})
export class HerramientasModule {}

