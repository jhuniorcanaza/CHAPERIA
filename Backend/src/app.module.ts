import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

import { CommonModule } from './common/common.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { EvidenciasFotosModule } from './modules/evidencias-fotos/evidencias-fotos.module';
import { AuditoriaEdicionesModule } from './modules/auditoria-ediciones/auditoria-ediciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { VehiculosModule } from './modules/vehiculos/vehiculos.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';
import { OrdenesTrabajoModule } from './modules/ordenes-trabajo/ordenes-trabajo.module';
import { RepuestosModule } from './modules/repuestos/repuestos.module';
import { AlmacenModule } from './modules/almacen/almacen.module';
import { PersonalModule } from './modules/personal/personal.module';
import { HerramientasModule } from './modules/herramientas/herramientas.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { OperacionesModule } from './modules/operaciones/operaciones.module';

import { Usuario } from './modules/usuarios/usuario.entity';
import { TecnicoProveedor } from './modules/personal/tecnico-proveedor.entity';
import { Vehiculo } from './modules/vehiculos/vehiculo.entity';
import { RecepcionCheckIn } from './modules/vehiculos/recepcion-checkin.entity';
import { Cotizacion } from './modules/cotizaciones/cotizacion.entity';
import { CotizacionItem } from './modules/cotizaciones/cotizacion-item.entity';
import { TareaOrdenTrabajo } from './modules/ordenes-trabajo/tarea-ot.entity';
import { RepuestoVehiculo } from './modules/repuestos/repuesto-vehiculo.entity';
import { InsumoAlmacen } from './modules/almacen/insumo-almacen.entity';
import { MovimientoInsumo } from './modules/almacen/movimiento-insumo.entity';
import { HerramientaTaller } from './modules/herramientas/herramienta-taller.entity';
import { ConfiguracionGlobal } from './modules/notificaciones/configuracion.entity';
import { NotificacionTiempoReal } from './modules/notificaciones/notificacion.entity';
import { EvidenciaFotografica } from './modules/evidencias-fotos/evidencia-fotografica.entity';
import { HistorialEdicion } from './modules/auditoria-ediciones/historial-edicion.entity';
import { DatabaseSeederService } from './database/database-seeder.service';

const ALL_ENTITIES = [
  Usuario,
  TecnicoProveedor,
  Vehiculo,
  RecepcionCheckIn,
  Cotizacion,
  CotizacionItem,
  TareaOrdenTrabajo,
  RepuestoVehiculo,
  InsumoAlmacen,
  MovimientoInsumo,
  HerramientaTaller,
  ConfiguracionGlobal,
  NotificacionTiempoReal,
  EvidenciaFotografica,
  HistorialEdicion,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '76964482',
      database: process.env.DB_NAME || 'chaperia_local_db',
      entities: ALL_ENTITIES,
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'chaperia_pro_super_secret_key_bolivia_chile_2026',
      signOptions: { expiresIn: '24h' },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    CommonModule,
    UsuariosModule,
    AuthModule,
    EvidenciasFotosModule,
    AuditoriaEdicionesModule,
    NotificacionesModule,
    VehiculosModule,
    CotizacionesModule,
    OrdenesTrabajoModule,
    RepuestosModule,
    AlmacenModule,
    PersonalModule,
    HerramientasModule,
    ReportesModule,
    OperacionesModule,
  ],
  providers: [
    DatabaseSeederService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
