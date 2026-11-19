import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Usuario } from '../modules/usuarios/usuario.entity';
import { TecnicoProveedor } from '../modules/personal/tecnico-proveedor.entity';
import { Vehiculo } from '../modules/vehiculos/vehiculo.entity';
import { RecepcionCheckIn } from '../modules/vehiculos/recepcion-checkin.entity';
import { Cotizacion } from '../modules/cotizaciones/cotizacion.entity';
import { CotizacionItem } from '../modules/cotizaciones/cotizacion-item.entity';
import { TareaOrdenTrabajo } from '../modules/ordenes-trabajo/tarea-ot.entity';
import { RepuestoVehiculo } from '../modules/repuestos/repuesto-vehiculo.entity';
import { InsumoAlmacen } from '../modules/almacen/insumo-almacen.entity';
import { MovimientoInsumo } from '../modules/almacen/movimiento-insumo.entity';
import { HerramientaTaller } from '../modules/herramientas/herramienta-taller.entity';
import { ConfiguracionGlobal } from '../modules/notificaciones/configuracion.entity';
import { NotificacionTiempoReal } from '../modules/notificaciones/notificacion.entity';
import { EvidenciaFotografica } from '../modules/evidencias-fotos/evidencia-fotografica.entity';
import { HistorialEdicion } from '../modules/auditoria-ediciones/historial-edicion.entity';

function fechaHace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}

function fechaEn(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

const DEMO_EMAILS = ['carlos@bolivia.com', 'socia@bolivia.com', 'alfredo@chile.com'];

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(TecnicoProveedor) private readonly tecnicosRepo: Repository<TecnicoProveedor>,
    @InjectRepository(Vehiculo) private readonly vehiculosRepo: Repository<Vehiculo>,
    @InjectRepository(RecepcionCheckIn) private readonly checkInRepo: Repository<RecepcionCheckIn>,
    @InjectRepository(Cotizacion) private readonly cotizacionesRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionItem) private readonly cotItemsRepo: Repository<CotizacionItem>,
    @InjectRepository(TareaOrdenTrabajo) private readonly tareasRepo: Repository<TareaOrdenTrabajo>,
    @InjectRepository(RepuestoVehiculo) private readonly repuestosRepo: Repository<RepuestoVehiculo>,
    @InjectRepository(InsumoAlmacen) private readonly insumosRepo: Repository<InsumoAlmacen>,
    @InjectRepository(MovimientoInsumo) private readonly movimientosRepo: Repository<MovimientoInsumo>,
    @InjectRepository(HerramientaTaller) private readonly herramientasRepo: Repository<HerramientaTaller>,
    @InjectRepository(ConfiguracionGlobal) private readonly configRepo: Repository<ConfiguracionGlobal>,
    @InjectRepository(NotificacionTiempoReal) private readonly notifRepo: Repository<NotificacionTiempoReal>,
    @InjectRepository(EvidenciaFotografica) private readonly evidenciasRepo: Repository<EvidenciaFotografica>,
    @InjectRepository(HistorialEdicion) private readonly auditoriaRepo: Repository<HistorialEdicion>,
  ) {}

  async onModuleInit() {
    const count = await this.usuariosRepo.count();
    await this.asegurarCatalogosBase(count === 0);
    if (count > 0) {
      await this.repararDatosSeedLegacy();
    }

    await this.sincronizarDatosPresentacionCompletos();
    this.logger.log('Base de datos verificada y sincronizada con el catálogo completo de demostración (6 vehículos, fotos y PDFs).');
  }

  private async asegurarCatalogosBase(esPrimeraVez: boolean) {
    if (esPrimeraVez) {
      this.logger.log('Sembrando base de datos inicial completa con datos, imágenes y PDFs reales...');
    }

    if ((await this.configRepo.count()) === 0) {
      await this.configRepo.save(
        this.configRepo.create({
          tasaUsdAClp: 980,
          multaPorDiaRetrasoUsd: 20,
          gastosFijosMensualesTallerUsd: 2400,
        }),
      );
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    const demoUsers: Array<{
      nombreCompleto: string;
      email: string;
      rol: 'SUPERADMIN_BOLIVIA' | 'ADMIN_BOLIVIA' | 'ENCARGADO_CHILE';
      pais: 'BOLIVIA' | 'CHILE';
    }> = [
      {
        nombreCompleto: 'Carlos Mendoza (Gerencia Bolivia)',
        email: 'carlos@bolivia.com',
        rol: 'SUPERADMIN_BOLIVIA',
        pais: 'BOLIVIA',
      },
      {
        nombreCompleto: 'Socia Inversora Bolivia',
        email: 'socia@bolivia.com',
        rol: 'ADMIN_BOLIVIA',
        pais: 'BOLIVIA',
      },
      {
        nombreCompleto: 'Alfredo Rojas (Encargado Chile)',
        email: 'alfredo@chile.com',
        rol: 'ENCARGADO_CHILE',
        pais: 'CHILE',
      },
    ];

    for (const demo of demoUsers) {
      const existe = await this.usuariosRepo.findOne({ where: { email: demo.email } });
      if (!existe) {
        await this.usuariosRepo.save(
          this.usuariosRepo.create({
            ...demo,
            passwordHash,
            activo: true,
          }),
        );
        this.logger.log(`Usuario demo creado: ${demo.email} (${demo.rol})`);
      }
    }

    const tecnicosSeed: Array<{
      nombre: string;
      especialidad: TecnicoProveedor['especialidad'];
      modalidad: 'CONTRATO_PIEZA' | 'SUELDO_FIJO' | 'TERCERO_EXTERNO';
      sueldoFijoMensualUsd: number;
      promedioEstrellas: number;
      trabajosCompletados: number;
      observacionDesempeno: string;
      bloqueadoPorMalTrabajo: boolean;
    }> = [
      {
        nombre: 'Mateo Silva (Chapero Planta)',
        especialidad: 'CHAPERO',
        modalidad: 'CONTRATO_PIEZA',
        sueldoFijoMensualUsd: 0,
        promedioEstrellas: 4.9,
        trabajosCompletados: 28,
        observacionDesempeno: 'Excelente cuadratura en frontales, capó y chasis.',
        bloqueadoPorMalTrabajo: false,
      },
      {
        nombre: 'Jorge Paredes (Pintor Cabina)',
        especialidad: 'PINTOR',
        modalidad: 'CONTRATO_PIEZA',
        sueldoFijoMensualUsd: 0,
        promedioEstrellas: 4.8,
        trabajosCompletados: 34,
        observacionDesempeno: 'Riguroso en control de masilla, igualación colorista y barniz UHS.',
        bloqueadoPorMalTrabajo: false,
      },
      {
        nombre: 'Luis Herrera (Mecánico Planta)',
        especialidad: 'MECANICO_PLANTA',
        modalidad: 'SUELDO_FIJO',
        sueldoFijoMensualUsd: 1150,
        promedioEstrellas: 4.7,
        trabajosCompletados: 19,
        observacionDesempeno: 'Desarme frontal, radiadores, tren delantero y armado final.',
        bloqueadoPorMalTrabajo: false,
      },
      {
        nombre: 'ElectroAuto Iquique (Tercero)',
        especialidad: 'ELECTRICO_EXTERNO',
        modalidad: 'TERCERO_EXTERNO',
        sueldoFijoMensualUsd: 0,
        promedioEstrellas: 4.6,
        trabajosCompletados: 12,
        observacionDesempeno: 'Escáner electrónico, sensores de estacionamiento y ramales.',
        bloqueadoPorMalTrabajo: false,
      },
      {
        nombre: 'SRS Airbag Pro Zofri (Tercero)',
        especialidad: 'AIRBAG_PLASTICOS_EXTERNO',
        modalidad: 'TERCERO_EXTERNO',
        sueldoFijoMensualUsd: 0,
        promedioEstrellas: 4.5,
        trabajosCompletados: 9,
        observacionDesempeno: 'Reseteo de módulos SRS, cinturones pirotécnicos y tablero.',
        bloqueadoPorMalTrabajo: false,
      },
      {
        nombre: 'Taller Soldadura Norte (Externo)',
        especialidad: 'SOLDADOR_EXTERNO',
        modalidad: 'TERCERO_EXTERNO',
        sueldoFijoMensualUsd: 0,
        promedioEstrellas: 2.8,
        trabajosCompletados: 4,
        observacionDesempeno: 'Retrasos reiterados y cordón de soldadura observado en inspección.',
        bloqueadoPorMalTrabajo: true,
      },
    ];

    const tecnicosActuales = await this.tecnicosRepo.find();
    for (const tSeed of tecnicosSeed) {
      const existe = tecnicosActuales.some(
        (t) => t.nombre === tSeed.nombre || t.especialidad === tSeed.especialidad,
      );
      if (!existe) {
        await this.tecnicosRepo.save(this.tecnicosRepo.create(tSeed));
      }
    }

    if ((await this.insumosRepo.count()) === 0) {
      await this.insumosRepo.save(
        [
          { nombre: 'Masilla Poliéster Automotriz (Lata 4 Kg)', unidadMedida: 'Lata', stockActual: 14, stockMinimoAlerta: 5, costoUnitarioUsd: 24 },
          { nombre: 'Catalizador Peróxido para Masilla', unidadMedida: 'Tubo', stockActual: 18, stockMinimoAlerta: 6, costoUnitarioUsd: 4.5 },
          { nombre: 'Primer Relleno 2K Gris (Galón)', unidadMedida: 'Galón', stockActual: 6, stockMinimoAlerta: 3, costoUnitarioUsd: 58 },
          { nombre: 'Barniz Transparente UHS 2K (Kit + Endurecedor)', unidadMedida: 'Kit', stockActual: 4, stockMinimoAlerta: 3, costoUnitarioUsd: 85 },
          { nombre: 'Thinner Acrílico / Diluyente UHS (Bidón 5L)', unidadMedida: 'Bidón', stockActual: 7, stockMinimoAlerta: 3, costoUnitarioUsd: 22 },
          { nombre: 'Lijas al Agua Grano P180 - P320 (Caja x50)', unidadMedida: 'Caja', stockActual: 10, stockMinimoAlerta: 4, costoUnitarioUsd: 18 },
          { nombre: 'Lijas Finas Pulido P800 - P2000 (Caja x50)', unidadMedida: 'Caja', stockActual: 8, stockMinimoAlerta: 3, costoUnitarioUsd: 21 },
          { nombre: 'Cinta Enmascarar Automotriz 3M (Pack x6)', unidadMedida: 'Pack', stockActual: 9, stockMinimoAlerta: 4, costoUnitarioUsd: 15 },
          { nombre: 'Papel Enmascarado 90cm (Rollo)', unidadMedida: 'Rollo', stockActual: 3, stockMinimoAlerta: 4, costoUnitarioUsd: 19 },
          { nombre: 'Pasta de Pulir Corte Rápido 3M (Botella 1L)', unidadMedida: 'Botella', stockActual: 5, stockMinimoAlerta: 2, costoUnitarioUsd: 32 },
          { nombre: 'Discos Desbaste Amoladora 4.5" (Pack x10)', unidadMedida: 'Pack', stockActual: 11, stockMinimoAlerta: 4, costoUnitarioUsd: 14 },
          { nombre: 'Alambre MIG 0.8mm Soldadura (Carrete 5 Kg)', unidadMedida: 'Carrete', stockActual: 4, stockMinimoAlerta: 2, costoUnitarioUsd: 29 },
          { nombre: 'Gas Argón / CO2 Soldadura (Carga Tubo)', unidadMedida: 'Tubo', stockActual: 2, stockMinimoAlerta: 2, costoUnitarioUsd: 65 },
          { nombre: 'Desengrasante Antisilicona (Galón)', unidadMedida: 'Galón', stockActual: 5, stockMinimoAlerta: 2, costoUnitarioUsd: 26 },
          { nombre: 'Pintura Bicapa Preparada Colorista', unidadMedida: 'Litro', stockActual: 6, stockMinimoAlerta: 4, costoUnitarioUsd: 48 },
        ].map((item) => this.insumosRepo.create(item)),
      );
    }
  }

  private async sincronizarDatosPresentacionCompletos() {
    await this.asegurarAlertasStockYInsumosMinimos();

    const tecnicos = await this.tecnicosRepo.find();
    const mateo = tecnicos.find((t) => t.especialidad === 'CHAPERO') || tecnicos[0];
    const jorge = tecnicos.find((t) => t.especialidad === 'PINTOR') || tecnicos[0];
    const luis = tecnicos.find((t) => t.especialidad === 'MECANICO_PLANTA') || tecnicos[0];
    const srs = tecnicos.find((t) => t.especialidad === 'AIRBAG_PLASTICOS_EXTERNO') || tecnicos[0];

    // --- 1. VEHÍCULOS (7 unidades cubriendo todo el flujo operativo y financiero) ---
    const v1 = await this.asegurarVehiculoRanger(mateo, jorge, srs);
    const v2 = await this.asegurarVehiculoRav4();
    const v3 = await this.asegurarVehiculoTucson(mateo, jorge);
    const v4 = await this.asegurarVehiculoNavara(luis);
    const v5 = await this.asegurarVehiculoSwift();
    const v6 = await this.asegurarVehiculoTracker();
    const v7 = await this.asegurarVehiculoSportage(mateo);

    // --- 2. MOVIMIENTOS DE ALMACÉN Y COLORISTA ---
    await this.asegurarMovimientosDemo();

    // --- 3. HERRAMIENTAS DEL TALLER ---
    await this.asegurarHerramientasDemo();

    // --- 4. EVIDENCIAS FOTOGRÁFICAS (.WebP en todas las categorías) ---
    await this.asegurarEvidenciasDemo({ v1, v2, v3, v4, v5 });

    // --- 5. HISTORIAL DE AUDITORÍA (7 módulos cubiertos para que ningún filtro salga vacío) ---
    await this.asegurarAuditoriaDemo();

    // --- 6. NOTIFICACIONES EN TIEMPO REAL CON NAVEGACIÓN DIRECTA ---
    await this.asegurarNotificacionesDemo({ v1, v2, v3, v4, v5 });

    // --- 7. BACKFILL IDEMPOTENTE PARA ELIMINAR CAMPOS VACÍOS EN FLOTA E INVENTARIO ---
    await this.enriquecerYBackfillearFlotaCompleta({ v1, v2, v3, v4, v5, v6, mateo, jorge });
    await this.asegurarEvidenciasNuevasYNotificaciones({ v2, v3, v5, v6, v7 });
    await this.repararVehiculosSinDatosMinimos(mateo, jorge);
  }

  private isoFechaOffset(dias: number): string {
    return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  }

  private async asegurarAlertasStockYInsumosMinimos() {
    const requeridos = [
      { nombre: 'Papel Enmascarado 90cm (Rollo)', unidadMedida: 'Rollo', stockActual: 3, stockMinimoAlerta: 4, costoUnitarioUsd: 19 },
      { nombre: 'Gas Argón / CO2 Soldadura (Carga Tubo)', unidadMedida: 'Tubo', stockActual: 2, stockMinimoAlerta: 2, costoUnitarioUsd: 65 },
    ];
    for (const req of requeridos) {
      const existe = await this.insumosRepo.findOne({ where: { nombre: req.nombre } });
      if (!existe) {
        await this.insumosRepo.save(this.insumosRepo.create(req));
      }
    }

    const todos = await this.insumosRepo.find();
    const enAlerta = todos.filter((i) => Number(i.stockActual) <= Number(i.stockMinimoAlerta));
    if (enAlerta.length === 0) {
      const papel = todos.find((i) => i.nombre === 'Papel Enmascarado 90cm (Rollo)');
      if (papel) {
        papel.stockActual = 3;
        papel.stockMinimoAlerta = 4;
        await this.insumosRepo.save(papel);
      }
      const gas = todos.find((i) => i.nombre === 'Gas Argón / CO2 Soldadura (Carga Tubo)');
      if (gas) {
        gas.stockActual = 2;
        gas.stockMinimoAlerta = 2;
        await this.insumosRepo.save(gas);
      }
    }
  }

  private async asegurarVehiculoSportage(mateo: TecnicoProveedor): Promise<Vehiculo> {
    const vin = 'KNAPU81DBN7877410';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'LOTE-77410',
          marca: 'Kia',
          modelo: 'Sportage EX',
          anio: 2022,
          color: 'Gris Acero',
          tipoCliente: 'INTERNO_IMPORTADORA',
          nombreCliente: 'Importadora Bolivia-Iquique (Arribo)',
          telefonoCliente: '+591 712 44010',
          prioridadCola: 'ALTA_15_DIAS',
          estado: 'EN_PUERTO_NAVIERA',
          navieraNombre: 'Naviera Hapag-Lloyd Chile',
          navieraPagada: false,
          costoGruaImportadoraUsd: 85,
          ordenTraspasoPdfUrl: '/uploads/traspasos/orden_traspaso_kia_sportage_77410.pdf',
        }),
      );
    } else if (!v.ordenTraspasoPdfUrl || !v.navieraNombre) {
      v.ordenTraspasoPdfUrl = v.ordenTraspasoPdfUrl || '/uploads/traspasos/orden_traspaso_kia_sportage_77410.pdf';
      v.navieraNombre = v.navieraNombre || 'Naviera Hapag-Lloyd Chile';
      await this.vehiculosRepo.save(v);
    }

    const sportage = (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
    const fotoPuerto = {
      titulo: 'Inspección portuaria Kia Sportage EX (Antes)',
      descripcionBreve:
        'Unidad arribada en Puerto Iquique con abolladura en puerta posterior y guardafango derecho previo a liberación naviera.',
      url: '/uploads/checkin/sportage_puerto_antes.webp',
      pesoKb: 182,
    };

    const ci = await this.checkInRepo.findOne({ where: { vehiculo: { id: sportage.id } } });
    if (!ci) {
      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: sportage,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Stop derecho trizado levemente en puerto',
          airbagsReventados: false,
          observacionesIngreso:
            'Unidad en explanada portuaria de Iquique esperando confirmación de pago naviera por Bolivia para despacho en grúa.',
          fotosIngresoWebp: [fotoPuerto],
        }),
      );
    } else if (!ci.fotosIngresoWebp || ci.fotosIngresoWebp.length === 0) {
      ci.fotosIngresoWebp = [fotoPuerto];
      await this.checkInRepo.save(ci);
    }

    const cots = await this.cotizacionesRepo.find({ where: { vehiculo: { id: sportage.id } } });
    if (cots.length === 0) {
      const cot = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: sportage,
          version: 1,
          montoOriginalUsd: 640,
          montoAcordadoUsd: 640,
          estadoAprobacion: 'PENDIENTE_REVISION_BOLIVIA',
          creadoPorChile: 'Alfredo Rojas (Chile)',
        }),
      );
      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot,
          categoria: 'CHAPERIA',
          piezaZona: 'Puerta trasera derecha y guardafango posterior',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 165,
          precioCotizadoOriginalUsd: 350,
          precioAcordadoClienteUsd: 350,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot,
          categoria: 'PINTURA',
          piezaZona: 'Pintura bicapa Gris Acero lateral derecho y difuminado',
          gradoDanio: 'NO_APLICA',
          costoInternoOTerceroUsd: 110,
          precioCotizadoOriginalUsd: 290,
          precioAcordadoClienteUsd: 290,
        }),
      ]);
    }

    const ots = await this.tareasRepo.find({ where: { vehiculo: { id: sportage.id } } });
    if (ots.length === 0) {
      await this.tareasRepo.save(
        this.tareasRepo.create({
          vehiculo: sportage,
          orden: 1,
          titulo: 'Desabollado lateral derecho y preparación de panel posterior',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo?.nombre || 'Mateo Silva (Chapero Planta)',
          tecnicoAsignadoId: mateo?.id,
          pagoAcordadoUsd: 165,
          fechaInicio: this.isoFechaOffset(0),
          fechaLimite: this.isoFechaOffset(10),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 165,
          completada: false,
        }),
      );
    }

    const reps = await this.repuestosRepo.find({ where: { vehiculo: { id: sportage.id } } });
    if (reps.length === 0) {
      await this.repuestosRepo.save(
        this.repuestosRepo.create({
          vehiculo: sportage,
          nombreRepuesto: 'Faro Trasero Derecho LED OEM Kia Sportage',
          estado: 'SOLICITADO',
          codigoSerie: 'KM-SPR-89210',
          solicitadoPor: 'Alfredo Rojas (Taller Chile)',
          proveedorOrigen: 'Zofri AutoPartes Iquique',
          costoRepuestoUsd: 195,
          observacion: 'Pre-solicitado para instalación inmediata al ingreso de la grúa desde puerto.',
        }),
      );
    }

    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || sportage;
  }

  private async enriquecerYBackfillearFlotaCompleta(refs: {
    v1: Vehiculo;
    v2: Vehiculo;
    v3: Vehiculo;
    v4: Vehiculo;
    v5: Vehiculo;
    v6: Vehiculo;
    mateo: TecnicoProveedor;
    jorge: TecnicoProveedor;
  }) {
    const { v1, v2, v3, v4, v5, v6, mateo, jorge } = refs;

    // 1. Ranger (v1): asegurar al menos una OT con prórroga otorgada visible en KPIs
    const otsV1 = await this.tareasRepo.find({ where: { vehiculo: { id: v1.id } }, order: { orden: 'ASC' } });
    if (otsV1.length > 0 && !otsV1.some((t) => Number(t.diasProrrogaOtorgados || 0) > 0)) {
      const target = otsV1.find((t) => !t.completada) || otsV1[otsV1.length - 1];
      target.diasProrrogaOtorgados = 2;
      target.motivoProrroga = 'Prórroga autorizada por espera de farol derecho OEM y secado en cabina.';
      await this.tareasRepo.save(target);
    }

    // 2. Toyota RAV4 (v2): Check-In foto, 2 OTs (con EXCESO_MASILLA para indicador), 1 repuesto recibido y gasto de almacén
    const ciV2 = await this.checkInRepo.findOne({ where: { vehiculo: { id: v2.id } } });
    if (ciV2 && (!ciV2.fotosIngresoWebp || ciV2.fotosIngresoWebp.length === 0)) {
      ciV2.fotosIngresoWebp = [
        {
          titulo: 'Lateral izquierdo Toyota RAV4 al ingreso',
          descripcionBreve: 'Daño lateral en puerta del conductor y guardabarros izquierdo previo a intervención.',
          url: '/uploads/checkin/rav4_lateral_izq.webp',
          pesoKb: 142,
        },
      ];
      await this.checkInRepo.save(ciV2);
    }

    const otsV2 = await this.tareasRepo.find({ where: { vehiculo: { id: v2.id } }, order: { orden: 'ASC' } });
    if (otsV2.length === 0) {
      await this.tareasRepo.save([
        this.tareasRepo.create({
          vehiculo: v2,
          orden: 1,
          titulo: 'Enderezado lateral puerta y guardabarros delantero izquierdo',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo?.nombre || 'Mateo Silva (Chapero Planta)',
          tecnicoAsignadoId: mateo?.id,
          pagoAcordadoUsd: 160,
          fechaInicio: this.isoFechaOffset(-6),
          fechaLimite: this.isoFechaOffset(-1),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 160,
          completada: true,
          fechaCompletada: new Date(),
          calificacionEstrellas: 3,
          controlCalidadMasilla: 'EXCESO_MASILLA',
          observacionCalidad: 'Pintor observa exceso de masilla en arco de rueda izquierdo; requiere repaso de lijado antes de fondeo.',
          notaReasignacion: 'Reasignado repaso fino de masilla en pestaña de guardabarros.',
        }),
        this.tareasRepo.create({
          vehiculo: v2,
          orden: 2,
          titulo: 'Fondeo 2K, pintura bicapa Blanco Perla y pulido final',
          tipo: 'PINTURA',
          tecnicoAsignadoNombre: jorge?.nombre || 'Jorge Paredes (Pintor Cabina)',
          tecnicoAsignadoId: jorge?.id,
          pagoAcordadoUsd: 185,
          fechaInicio: this.isoFechaOffset(0),
          fechaLimite: this.isoFechaOffset(5),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 185,
          completada: false,
        }),
      ]);
    } else if (!otsV2.some((t) => t.controlCalidadMasilla === 'EXCESO_MASILLA')) {
      otsV2[0].completada = true;
      otsV2[0].fechaCompletada = otsV2[0].fechaCompletada || new Date();
      otsV2[0].controlCalidadMasilla = 'EXCESO_MASILLA';
      otsV2[0].calificacionEstrellas = otsV2[0].calificacionEstrellas || 3;
      otsV2[0].observacionCalidad =
        otsV2[0].observacionCalidad || 'Control de calidad detecta exceso de masilla en arco izquierdo; programado repaso previo a cabina.';
      otsV2[0].notaReasignacion = otsV2[0].notaReasignacion || 'Repaso de lijado fino asignado antes de pintura.';
      await this.tareasRepo.save(otsV2[0]);
    }

    const repsV2 = await this.repuestosRepo.find({ where: { vehiculo: { id: v2.id } } });
    if (repsV2.length === 0) {
      await this.repuestosRepo.save(
        this.repuestosRepo.create({
          vehiculo: v2,
          nombreRepuesto: 'Guardabarros Delantero Izquierdo OEM Toyota',
          estado: 'RECIBIDO_OK',
          codigoSerie: 'TY-RAV4-53802',
          fotoRecepcionWebp: '/uploads/repuestos/guardabarros_rav4_oem.webp',
          descripcionFotoRecepcion:
            'Guardabarros delantero izquierdo imprimado en caja original Toyota con kit de grapas de montaje.',
          observacion: 'Verificado completo sin abolladuras de transporte; listo para calce e imprimación.',
          solicitadoPor: 'Alfredo Rojas (Taller Chile)',
          proveedorOrigen: 'Toyota Repuestos ZOFRI',
          costoRepuestoUsd: 215,
          fechaRecepcion: new Date(),
        }),
      );
    }

    const movs = await this.movimientosRepo.find();
    const tieneMovRav4 = movs.some((m) => (m.vehiculoReferencia || '').includes('RAV4') || (m.vehiculoReferencia || '').includes('CL-PR-4491'));
    if (!tieneMovRav4) {
      await this.movimientosRepo.save(
        this.movimientosRepo.create({
          tipo: 'SALIDA_POR_TAREA',
          insumoNombre: 'Papel Enmascarado 90cm (Rollo)',
          cantidad: 1,
          unidad: 'Rollo',
          vehiculoReferencia: 'Toyota RAV4 (CL-PR-4491)',
          tareaReferencia: 'Empapelado previo a fondeo lateral izquierdo',
          costoTotalUsd: 19,
        }),
      );
    }
    for (const m of movs) {
      if (!m.vehiculoReferencia || !m.tareaReferencia) {
        m.vehiculoReferencia = m.vehiculoReferencia || 'Stock General Taller Iquique';
        m.tareaReferencia = m.tareaReferencia || 'Reposición operativa de almacén';
        await this.movimientosRepo.save(m);
      }
    }

    // 3. Hyundai Tucson (v3): completar fotografía de repuesto faltante
    const repsV3 = await this.repuestosRepo.find({ where: { vehiculo: { id: v3.id } } });
    for (const r of repsV3) {
      if (!r.fotoRecepcionWebp) {
        r.fotoRecepcionWebp = '/uploads/repuestos/moldura_tucson_oem.webp';
        r.descripcionFotoRecepcion =
          r.descripcionFotoRecepcion || 'Moldura paso de rueda y soporte OEM Hyundai Tucson verificados tras recepción e instalación.';
        r.observacion = r.observacion || 'Repuesto OEM original instalado con fijaciones nuevas en paso de rueda.';
        r.proveedorOrigen = r.proveedorOrigen || 'Hyundai Mobis Chile';
        await this.repuestosRepo.save(r);
      }
    }

    // 4. Nissan Navara (v4): asegurar 2 OTs (1/2) y campos completos de repuestos
    const otsV4 = await this.tareasRepo.find({ where: { vehiculo: { id: v4.id } }, order: { orden: 'ASC' } });
    if (otsV4.length === 1) {
      await this.tareasRepo.save(
        this.tareasRepo.create({
          vehiculo: v4,
          orden: 2,
          titulo: 'Cuadratura de frontal, montaje de farol y pintura de máscara',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo?.nombre || 'Mateo Silva (Chapero Planta)',
          tecnicoAsignadoId: mateo?.id,
          pagoAcordadoUsd: 145,
          fechaInicio: this.isoFechaOffset(0),
          fechaLimite: this.isoFechaOffset(6),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 145,
          completada: false,
        }),
      );
    }
    const repsV4 = await this.repuestosRepo.find({ where: { vehiculo: { id: v4.id } } });
    for (const r of repsV4) {
      if (!r.codigoSerie || !r.proveedorOrigen || !r.observacion) {
        r.codigoSerie = r.codigoSerie || 'NI-NP300-4410';
        r.proveedorOrigen = r.proveedorOrigen || 'Nissan Chile Recambios';
        r.solicitadoPor = r.solicitadoPor || 'Alfredo Rojas (Taller Chile)';
        r.observacion = r.observacion || 'Solicitud confirmada en proveedor oficial; arribo coordinado a taller.';
        await this.repuestosRepo.save(r);
      }
    }

    // 5. Suzuki Swift (v5): asegurar PDF traspaso, Check-In con foto, Cotización, 1 OT y 1 repuesto con foto
    if (!v5.ordenTraspasoPdfUrl) {
      v5.ordenTraspasoPdfUrl = '/uploads/traspasos/orden_traspaso_suzuki_swift_91023.pdf';
      await this.vehiculosRepo.save(v5);
    }
    const fotoSwift = {
      titulo: 'Inspección portuaria Suzuki Swift (Antes)',
      descripcionBreve:
        'Vista frontal tres cuartos en patio portuario previo al embarque en grúa: roce en parachoques y falta parrilla.',
      url: '/uploads/checkin/swift_puerto_frente.webp',
      pesoKb: 164,
    };
    const ciV5 = await this.checkInRepo.findOne({ where: { vehiculo: { id: v5.id } } });
    if (!ciV5) {
      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v5,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Neblinero izquierdo desmontado en puerto',
          airbagsReventados: false,
          observacionesIngreso:
            'Unidad liberada de naviera y en traslado en grúa hacia taller central para desarme y armado frontal.',
          fotosIngresoWebp: [fotoSwift],
        }),
      );
    } else if (!ciV5.fotosIngresoWebp || ciV5.fotosIngresoWebp.length === 0) {
      ciV5.fotosIngresoWebp = [fotoSwift];
      await this.checkInRepo.save(ciV5);
    }

    const cotsV5 = await this.cotizacionesRepo.find({ where: { vehiculo: { id: v5.id } } });
    if (cotsV5.length === 0) {
      const cotSwift = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v5,
          version: 1,
          montoOriginalUsd: 480,
          montoAcordadoUsd: 480,
          estadoAprobacion: 'PENDIENTE_REVISION_BOLIVIA',
          creadoPorChile: 'Alfredo Rojas (Chile)',
        }),
      );
      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cotSwift,
          categoria: 'CHAPERIA',
          piezaZona: 'Desmontaje y reparación parachoques delantero + ajuste parrilla',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 115,
          precioCotizadoOriginalUsd: 260,
          precioAcordadoClienteUsd: 260,
        }),
        this.cotItemsRepo.create({
          cotizacion: cotSwift,
          categoria: 'PINTURA',
          piezaZona: 'Pintura parachoques delantero Azul Eléctrico y difuminado',
          gradoDanio: 'NO_APLICA',
          costoInternoOTerceroUsd: 95,
          precioCotizadoOriginalUsd: 220,
          precioAcordadoClienteUsd: 220,
        }),
      ]);
    }

    const otsV5 = await this.tareasRepo.find({ where: { vehiculo: { id: v5.id } } });
    if (otsV5.length === 0) {
      await this.tareasRepo.save(
        this.tareasRepo.create({
          vehiculo: v5,
          orden: 1,
          titulo: 'Recepción en rampa y desarme de parachoques delantero',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo?.nombre || 'Mateo Silva (Chapero Planta)',
          tecnicoAsignadoId: mateo?.id,
          pagoAcordadoUsd: 115,
          fechaInicio: this.isoFechaOffset(0),
          fechaLimite: this.isoFechaOffset(7),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 115,
          completada: false,
        }),
      );
    }

    const repsV5 = await this.repuestosRepo.find({ where: { vehiculo: { id: v5.id } } });
    if (repsV5.length === 0) {
      await this.repuestosRepo.save(
        this.repuestosRepo.create({
          vehiculo: v5,
          nombreRepuesto: 'Parrilla Frontal Superior + Soporte Neblinero Swift',
          estado: 'RECIBIDO_OK',
          codigoSerie: 'SZ-SWF-71711',
          fotoRecepcionWebp: '/uploads/repuestos/parrilla_swift_oem.webp',
          descripcionFotoRecepcion:
            'Parrilla delantera negra brillante OEM y biseles de neblineros verificados en bodega previo al arribo.',
          observacion: 'Recibido en bodega de recepción anticipadamente junto con orden de traspaso.',
          solicitadoPor: 'Alfredo Rojas (Taller Chile)',
          proveedorOrigen: 'Suzuki Zofri Import',
          costoRepuestoUsd: 135,
          fechaRecepcion: new Date(),
        }),
      );
    }

    // 6. Chevrolet Tracker (v6): asegurar foto peritaje, monto evaluación (>0) y 1 OT de peritaje (1/1)
    const fotoTracker = {
      titulo: 'Peritaje trasero Chevrolet Tracker (Antes)',
      descripcionBreve:
        'Inspección fotográfica de compuerta posterior y parachoques realizada antes del retiro de la unidad.',
      url: '/uploads/checkin/tracker_trasero_peritaje.webp',
      pesoKb: 126,
    };
    const ciV6 = await this.checkInRepo.findOne({ where: { vehiculo: { id: v6.id } } });
    if (!ciV6) {
      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v6,
          tieneLlantaAuxilio: true,
          tieneGataYrench: false,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Stop derecho trizado',
          airbagsReventados: false,
          observacionesIngreso:
            'Cliente ingresó unidad para peritaje trasero; posteriormente optó por retirar sin ejecutar reparación.',
          fotosIngresoWebp: [fotoTracker],
        }),
      );
    } else if (!ciV6.fotosIngresoWebp || ciV6.fotosIngresoWebp.length === 0) {
      ciV6.fotosIngresoWebp = [fotoTracker];
      await this.checkInRepo.save(ciV6);
    }

    const cotsV6 = await this.cotizacionesRepo.find({ where: { vehiculo: { id: v6.id } } });
    if (cotsV6.length === 0) {
      const cotTracker = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v6,
          version: 1,
          montoOriginalUsd: 340,
          montoAcordadoUsd: 340,
          estadoAprobacion: 'RECHAZADA_CLIENTE',
          creadoPorChile: 'Alfredo Rojas (Chile)',
          motivoEdicionAcuerdo: 'Cliente retiró unidad tras peritaje técnico inicial (exento de reparación mayor).',
        }),
      );
      await this.cotItemsRepo.save(
        this.cotItemsRepo.create({
          cotizacion: cotTracker,
          categoria: 'CHAPERIA',
          piezaZona: 'Peritaje técnico y presupuesto de compuerta y parachoques trasero',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 45,
          precioCotizadoOriginalUsd: 340,
          precioAcordadoClienteUsd: 340,
        }),
      );
    } else if (Number(cotsV6[0].montoAcordadoUsd || 0) === 0 && Number(cotsV6[0].montoOriginalUsd || 0) === 0) {
      cotsV6[0].montoOriginalUsd = 340;
      cotsV6[0].montoAcordadoUsd = 340;
      cotsV6[0].estadoAprobacion = 'RECHAZADA_CLIENTE';
      cotsV6[0].motivoEdicionAcuerdo =
        cotsV6[0].motivoEdicionAcuerdo || 'Presupuesto de peritaje archivado tras retiro de unidad por el cliente.';
      await this.cotizacionesRepo.save(cotsV6[0]);
    }

    const otsV6 = await this.tareasRepo.find({ where: { vehiculo: { id: v6.id } } });
    if (otsV6.length === 0) {
      await this.tareasRepo.save(
        this.tareasRepo.create({
          vehiculo: v6,
          orden: 1,
          titulo: 'Peritaje técnico y evaluación fotográfica de daños traseros previo a retiro',
          tipo: 'CONTROL_FINAL',
          tecnicoAsignadoNombre: mateo?.nombre || 'Mateo Silva (Chapero Planta)',
          tecnicoAsignadoId: mateo?.id,
          pagoAcordadoUsd: 45,
          fechaInicio: this.isoFechaOffset(-4),
          fechaLimite: this.isoFechaOffset(-2),
          diasAtraso: 0,
          diasProrrogaOtorgados: 0,
          descuentoMultaUsd: 0,
          pagoLiquidoFinalUsd: 45,
          completada: true,
          fechaCompletada: new Date(),
          calificacionEstrellas: 5,
          controlCalidadMasilla: 'APROBADA',
          observacionCalidad: 'Diagnóstico documentado y firmado previo al retiro del propietario.',
        }),
      );
    }

    // 7. Herramientas activas: asegurar detalle de estado operativo
    const herramientas = await this.herramientasRepo.find();
    for (const h of herramientas) {
      if (h.estado === 'ACTIVA' && !h.detalleBaja) {
        h.detalleBaja = 'Operativa en taller • Calibración y mantenimiento preventivo al día';
        h.responsableBaja = h.responsableBaja || 'Taller Central Iquique';
        await this.herramientasRepo.save(h);
      }
    }
  }

  private async asegurarEvidenciasNuevasYNotificaciones(refs: {
    v2: Vehiculo;
    v3: Vehiculo;
    v5: Vehiculo;
    v6: Vehiculo;
    v7: Vehiculo;
  }) {
    const nuevasEvidencias = [
      {
        moduloOrigen: 'CHECKIN_RECEPCION' as const,
        referenciaId: refs.v5.id,
        vehiculoReferencia: 'Suzuki Swift Boosterjet (LOTE-91023)',
        tituloDetalle: 'Inspección portuaria Suzuki Swift (Antes)',
        descripcionBreve: 'Roce superficial en parachoques delantero izquierdo y parrilla ausente al cargar en grúa.',
        archivoWebpUrl: '/uploads/checkin/swift_puerto_frente.webp',
        nombreArchivo: 'swift_puerto_frente.webp',
        pesoOriginalKb: 720,
        pesoWebpKb: 164,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION' as const,
        referenciaId: refs.v6.id,
        vehiculoReferencia: 'Chevrolet Tracker Premier (CL-HK-2148)',
        tituloDetalle: 'Peritaje trasero Chevrolet Tracker (Antes)',
        descripcionBreve: 'Abolladura trasera evaluada antes de retiro de la unidad por el propietario.',
        archivoWebpUrl: '/uploads/checkin/tracker_trasero_peritaje.webp',
        nombreArchivo: 'tracker_trasero_peritaje.webp',
        pesoOriginalKb: 680,
        pesoWebpKb: 126,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION' as const,
        referenciaId: refs.v7.id,
        vehiculoReferencia: 'Kia Sportage EX (LOTE-77410)',
        tituloDetalle: 'Inspección portuaria Kia Sportage EX (Antes)',
        descripcionBreve: 'Unidad esperando liberación naviera en puerto de Iquique con daño posterior derecho.',
        archivoWebpUrl: '/uploads/checkin/sportage_puerto_antes.webp',
        nombreArchivo: 'sportage_puerto_antes.webp',
        pesoOriginalKb: 810,
        pesoWebpKb: 182,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS' as const,
        referenciaId: refs.v5.id,
        vehiculoReferencia: 'Suzuki Swift Boosterjet (LOTE-91023)',
        tituloDetalle: 'Parrilla frontal y biseles neblineros Swift OEM',
        descripcionBreve: 'Repuesto OEM recepcionado en bodega previo al ingreso de la grúa.',
        archivoWebpUrl: '/uploads/repuestos/parrilla_swift_oem.webp',
        nombreArchivo: 'parrilla_swift_oem.webp',
        pesoOriginalKb: 640,
        pesoWebpKb: 158,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS' as const,
        referenciaId: refs.v2.id,
        vehiculoReferencia: 'Toyota RAV4 (CL-PR-4491)',
        tituloDetalle: 'Guardabarros delantero izquierdo Toyota RAV4 OEM',
        descripcionBreve: 'Panel imprimado original recibido conforme con kit de grapas.',
        archivoWebpUrl: '/uploads/repuestos/guardabarros_rav4_oem.webp',
        nombreArchivo: 'guardabarros_rav4_oem.webp',
        pesoOriginalKb: 610,
        pesoWebpKb: 133,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS' as const,
        referenciaId: refs.v3.id,
        vehiculoReferencia: 'Hyundai Tucson Limited (CL-KJ-7710)',
        tituloDetalle: 'Moldura paso de rueda y soporte OEM Tucson',
        descripcionBreve: 'Respaldo de recepción e instalación de moldura posterior derecha OEM.',
        archivoWebpUrl: '/uploads/repuestos/moldura_tucson_oem.webp',
        nombreArchivo: 'moldura_tucson_oem.webp',
        pesoOriginalKb: 540,
        pesoWebpKb: 80,
        subidoPor: 'Alfredo Rojas (Taller Chile)',
        paisOrigen: 'CHILE' as const,
      },
    ];

    for (const ev of nuevasEvidencias) {
      const existe = await this.evidenciasRepo.findOne({ where: { archivoWebpUrl: ev.archivoWebpUrl } });
      if (!existe) {
        await this.evidenciasRepo.save(this.evidenciasRepo.create(ev));
      }
    }

    const refSportage = 'sportage-naviera-pendiente';
    const existeNotif = await this.notifRepo.findOne({ where: { referenciaId: refSportage } });
    if (!existeNotif) {
      await this.notifRepo.save(
        this.notifRepo.create({
          tipo: 'RECEPCION_VEHICULO',
          titulo: 'Naviera Pendiente • Kia Sportage EX (LOTE-77410)',
          mensaje:
            'Unidad con Orden de Traspaso PDF en Puerto Iquique; requiere pago de liberación naviera para traslado en grúa.',
          destinoRol: 'BOLIVIA',
          moduloDestino: 'recepcion',
          vehiculoId: refs.v7.id,
          referenciaId: refSportage,
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          leidaPor: {},
        }),
      );
    }
  }

  private async repararVehiculosSinDatosMinimos(mateo: TecnicoProveedor, jorge: TecnicoProveedor) {
    const todos = await this.vehiculosRepo.find();
    for (const veh of todos) {
      const fotoBase = {
        titulo: `Inspección de ingreso ${veh.marca} ${veh.modelo}`,
        descripcionBreve: 'Registro fotográfico de recepción física en taller.',
        url: '/uploads/checkin/tucson_antes_choque.webp',
        pesoKb: 108,
      };

      const ci = await this.checkInRepo.findOne({ where: { vehiculo: { id: veh.id } } });
      if (!ci) {
        await this.checkInRepo.save(
          this.checkInRepo.create({
            vehiculo: veh,
            tieneLlantaAuxilio: true,
            tieneGataYrench: true,
            tienePisosCompletos: true,
            tieneRadioOriginal: true,
            estadoFaroles: 'Revisión general al ingreso',
            airbagsReventados: false,
            observacionesIngreso: 'Inventario físico y respaldo visual registrados en taller.',
            fotosIngresoWebp: [fotoBase],
          }),
        );
      } else if (!ci.fotosIngresoWebp || ci.fotosIngresoWebp.length === 0) {
        ci.fotosIngresoWebp = [fotoBase];
        ci.observacionesIngreso = ci.observacionesIngreso || 'Inventario físico y respaldo visual registrados en taller.';
        await this.checkInRepo.save(ci);
      }

      const cots = await this.cotizacionesRepo.find({ where: { vehiculo: { id: veh.id } } });
      if (cots.length === 0) {
        const cot = await this.cotizacionesRepo.save(
          this.cotizacionesRepo.create({
            vehiculo: veh,
            version: 1,
            montoOriginalUsd: 320,
            montoAcordadoUsd: 320,
            estadoAprobacion: 'PENDIENTE_REVISION_BOLIVIA',
            creadoPorChile: 'Alfredo Rojas (Chile)',
          }),
        );
        await this.cotItemsRepo.save(
          this.cotItemsRepo.create({
            cotizacion: cot,
            categoria: 'CHAPERIA',
            piezaZona: `Evaluación e intervención inicial ${veh.marca} ${veh.modelo}`,
            gradoDanio: 'LEVE',
            costoInternoOTerceroUsd: 120,
            precioCotizadoOriginalUsd: 320,
            precioAcordadoClienteUsd: 320,
          }),
        );
      }

      const ots = await this.tareasRepo.find({ where: { vehiculo: { id: veh.id } } });
      if (ots.length === 0) {
        const tec = mateo || jorge;
        await this.tareasRepo.save(
          this.tareasRepo.create({
            vehiculo: veh,
            orden: 1,
            titulo: `Evaluación estructural e inicio de orden (${veh.placaOLote})`,
            tipo: 'CHAPERIA',
            tecnicoAsignadoNombre: tec?.nombre || 'Mateo Silva (Chapero Planta)',
            tecnicoAsignadoId: tec?.id,
            pagoAcordadoUsd: 120,
            fechaInicio: this.isoFechaOffset(0),
            fechaLimite: this.isoFechaOffset(7),
            diasAtraso: 0,
            diasProrrogaOtorgados: 0,
            descuentoMultaUsd: 0,
            pagoLiquidoFinalUsd: 120,
            completada: false,
          }),
        );
      }
    }
  }

  private async asegurarVehiculoRanger(
    mateo: TecnicoProveedor,
    jorge: TecnicoProveedor,
    srs: TecnicoProveedor,
  ): Promise<Vehiculo> {
    const vin = '1FTEW1EP5MFB12345';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'LOTE-88412',
          marca: 'Ford',
          modelo: 'Ranger XLT 4x4',
          anio: 2022,
          color: 'Azul Metálico',
          tipoCliente: 'INTERNO_IMPORTADORA',
          nombreCliente: 'Importadora Bolivia-Iquique (Stock)',
          telefonoCliente: '+591 712 44010',
          prioridadCola: 'ALTA_15_DIAS',
          estado: 'EN_TALLER',
          navieraNombre: 'Naviera Hyundai Glovis',
          ordenTraspasoPdfUrl: '/uploads/traspasos/orden_traspaso_ford_ranger_88412.pdf',
          navieraPagada: true,
          costoGruaImportadoraUsd: 110,
        }),
      );

      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: false,
          tieneRadioOriginal: true,
          estadoFaroles: 'Farol derecho partido y soporte doblado',
          airbagsReventados: true,
          observacionesIngreso:
            'Ingresa en grúa desde Puerto Iquique. Sin pisos originales de goma y con airbag frontal detonado.',
          fotosIngresoWebp: [
            {
              titulo: 'Golpe frontal derecho y capó',
              descripcionBreve: 'Parachoques trizado, farol derecho roto y descuadre en punta delantera.',
              url: '/uploads/checkin/ranger_frente.webp',
              pesoKb: 196,
            },
            {
              titulo: 'Tablero con airbag frontal detonado',
              descripcionBreve: 'Volante y cubierta acompañante desplegados; requiere reset de centralita SRS.',
              url: '/uploads/checkin/ranger_tablero_airbag.webp',
              pesoKb: 121,
            },
            {
              titulo: 'Cabina delantera sin pisos originales',
              descripcionBreve: 'Checklist visual confirma ausencia de alfombras de goma OEM en entrega de puerto.',
              url: '/uploads/checkin/ranger_sin_pisos.webp',
              pesoKb: 132,
            },
          ],
        }),
      );

      const cot1 = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v,
          version: 2,
          montoOriginalUsd: 1180,
          montoAcordadoUsd: 1380,
          estadoAprobacion: 'VERDE_ACEPTADA_POR_CHILE',
          creadoPorChile: 'Alfredo Rojas (Encargado Chile)',
          autorizadoEdicionBolivia: 'Carlos Mendoza (Gerencia Bolivia)',
          motivoEdicionAcuerdo:
            'Adenda autorizada tras desarme frontal: puente de radiador e intercooler desplazados.',
          fechaAceptacionChile: new Date(Date.now() - 86400000 * 3),
        }),
      );

      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot1,
          categoria: 'CHAPERIA',
          piezaZona: 'Capó, punta de chasis y guardabarros derecho',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 220,
          precioCotizadoOriginalUsd: 420,
          precioAcordadoClienteUsd: 420,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot1,
          categoria: 'PINTURA',
          piezaZona: 'Pintura bicapa frente completo y difuminado puertas',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 180,
          precioCotizadoOriginalUsd: 390,
          precioAcordadoClienteUsd: 390,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot1,
          categoria: 'SERVICIO_TERCERO',
          piezaZona: 'Reseteo centralita SRS y tapizado airbag volante',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 170,
          precioCotizadoOriginalUsd: 260,
          precioAcordadoClienteUsd: 260,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot1,
          categoria: 'CHAPERIA',
          piezaZona: 'Adenda desarme: Enderezado puente radiador y frente oculto',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 95,
          precioCotizadoOriginalUsd: 110,
          precioAcordadoClienteUsd: 310,
          fotoDesarmeAdendaWebp: '/uploads/desarme/ranger_desarme_oculto.webp',
          descripcionFotoAdenda: 'Marco frontal e intercooler desplazados expuestos al retirar parachoques.',
        }),
      ]);

      await this.tareasRepo.save([
        this.tareasRepo.create({
          vehiculo: v,
          orden: 1,
          titulo: 'Enderezado frontal, puente radiador y cuadratura capó',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo.nombre,
          tecnicoAsignadoId: mateo.id,
          pagoAcordadoUsd: 260,
          fechaInicio: fechaHace(7),
          fechaLimite: fechaHace(3),
          pagoLiquidoFinalUsd: 260,
          completada: true,
          fechaCompletada: new Date(Date.now() - 86400000 * 3),
          calificacionEstrellas: 5,
          controlCalidadMasilla: 'APROBADA',
          observacionCalidad: 'Cuadratura milimétrica en luces de capó sin exceso de masilla.',
        }),
        this.tareasRepo.create({
          vehiculo: v,
          orden: 2,
          titulo: 'Reseteo centralita SRS y restauración airbag frontal',
          tipo: 'SERVICIO_EXTERNO',
          tecnicoAsignadoNombre: srs.nombre,
          tecnicoAsignadoId: srs.id,
          pagoAcordadoUsd: 170,
          fechaInicio: fechaHace(5),
          fechaLimite: fechaHace(2),
          diasAtraso: 2,
          descuentoMultaUsd: 40,
          pagoLiquidoFinalUsd: 130,
          completada: false,
        }),
        this.tareasRepo.create({
          vehiculo: v,
          orden: 3,
          titulo: 'Preparación primer 2K, pintura bicapa cabina y pulido',
          tipo: 'PINTURA',
          tecnicoAsignadoNombre: jorge.nombre,
          tecnicoAsignadoId: jorge.id,
          pagoAcordadoUsd: 190,
          fechaInicio: fechaHace(1),
          fechaLimite: fechaEn(3),
          pagoLiquidoFinalUsd: 190,
          completada: false,
        }),
      ]);

      await this.repuestosRepo.save([
        this.repuestosRepo.create({
          vehiculo: v,
          nombreRepuesto: 'Farol Delantero Derecho LED OEM Ford',
          estado: 'RECIBIDO_OK',
          codigoSerie: 'FR-OEM-22-RH',
          fotoRecepcionWebp: '/uploads/repuestos/farol_ranger_oem.webp',
          descripcionFotoRecepcion:
            'Óptica recibida en caja sellada Iquique, pines intactos y encastre verificado.',
          solicitadoPor: 'Mateo Silva (Chapero Planta)',
          proveedorOrigen: 'Autopartes Zofri Express',
          costoRepuestoUsd: 215,
          fechaRecepcion: new Date(Date.now() - 86400000 * 1),
        }),
        this.repuestosRepo.create({
          vehiculo: v,
          nombreRepuesto: 'Parachoques Delantero XLT c/ Sensores',
          estado: 'OBSERVADO_NO_COMPATIBLE',
          codigoSerie: 'FB-XLT-9901',
          fotoRecepcionWebp: '/uploads/repuestos/parachoques_incompatible.webp',
          descripcionFotoRecepcion: 'Llegó versión básica XL sin perforaciones para sensores de proximidad.',
          observacion: 'Solicitado cambio inmediato con proveedor en Zofri por código XLT.',
          solicitadoPor: 'Alfredo Rojas (Encargado Chile)',
          proveedorOrigen: 'Importadora Repuestos Norte',
          costoRepuestoUsd: 185,
        }),
      ]);
    } else if (v.color === 'Gris Meteoro') {
      v.color = 'Azul Metálico';
      await this.vehiculosRepo.update({ id: v.id }, { color: 'Azul Metálico' });
    }

    // Asegurar al menos 1 repuesto SOLICITADO en Ford Ranger para poblar bandeja de reposición en Módulo 5
    const repSolicitado = await this.repuestosRepo.findOne({
      where: { codigoSerie: 'FB-XLT-9902-REP' },
    });
    if (!repSolicitado) {
      await this.repuestosRepo.save(
        this.repuestosRepo.create({
          vehiculo: v,
          nombreRepuesto: 'Parachoques Delantero XLT c/ Sensor Park (Reemplazo)',
          estado: 'SOLICITADO',
          codigoSerie: 'FB-XLT-9902-REP',
          observacion: 'Reposición en tránsito desde proveedor Zofri tras rechazo de versión XL.',
          solicitadoPor: 'Alfredo Rojas (Encargado Chile)',
          proveedorOrigen: 'Ford Parts Zofri Iquique',
          costoRepuestoUsd: 195,
        }),
      );
    }

    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarVehiculoRav4(): Promise<Vehiculo> {
    const vin = 'JTMB1RFV7MD091822';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'CL-PR-4491',
          marca: 'Toyota',
          modelo: 'RAV4 Hybrid',
          anio: 2021,
          color: 'Blanco Perla',
          tipoCliente: 'EXTERNO_CALLE',
          nombreCliente: 'Rodrigo Fuentes (Cliente Calle Iquique)',
          telefonoCliente: '+56 9 8412 5530',
          prioridadCola: 'COLA_30_DIAS',
          estado: 'COTIZADO',
          navieraPagada: true,
          costoGruaImportadoraUsd: 0,
        }),
      );

      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Sanos / Funcionales',
          airbagsReventados: false,
          observacionesIngreso:
            'Cliente particular solicita cotización en Blanco Perla por roce en guardabarros izquierdo.',
          fotosIngresoWebp: [
            {
              titulo: 'Abolladura lateral izquierda y roce puerta',
              descripcionBreve:
                'Hundimiento moderado sobre arco de rueda izquierdo con transferencia de pintura.',
              url: '/uploads/checkin/rav4_lateral_izq.webp',
              pesoKb: 148,
            },
          ],
        }),
      );

      const cot2 = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v,
          version: 1,
          montoOriginalUsd: 520,
          montoAcordadoUsd: 460,
          estadoAprobacion: 'AMARILLO_EDITADA_POR_BOLIVIA',
          creadoPorChile: 'Alfredo Rojas (Encargado Chile)',
          autorizadoEdicionBolivia: 'Socia Inversora Bolivia',
          motivoEdicionAcuerdo:
            'Ajuste comercial autorizado para retener cliente particular con carga compartida de pintura.',
        }),
      );

      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot2,
          categoria: 'CHAPERIA',
          piezaZona: 'Desabolladura guardabarros y borde puerta delantera izq.',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 95,
          precioCotizadoOriginalUsd: 220,
          precioAcordadoClienteUsd: 195,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot2,
          categoria: 'PINTURA',
          piezaZona: 'Pintado tricapa Blanco Perla paño completo + difuminado',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 110,
          precioCotizadoOriginalUsd: 300,
          precioAcordadoClienteUsd: 265,
        }),
      ]);
    }
    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarVehiculoTucson(
    mateo: TecnicoProveedor,
    jorge: TecnicoProveedor,
  ): Promise<Vehiculo> {
    const vin = 'KM8J3CAL7MU319044';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'CL-KJ-7710',
          marca: 'Hyundai',
          modelo: 'Tucson Limited',
          anio: 2021,
          color: 'Gris Grafito',
          tipoCliente: 'INTERNO_IMPORTADORA',
          nombreCliente: 'Importadora Bolivia-Iquique (Entrega)',
          telefonoCliente: '+591 712 44010',
          prioridadCola: 'ALTA_15_DIAS',
          estado: 'FINALIZADO',
          navieraNombre: 'Naviera Wallenius Wilhelmsen',
          ordenTraspasoPdfUrl: '/uploads/traspasos/orden_traspaso_hyundai_tucson_77104.pdf',
          navieraPagada: true,
          costoGruaImportadoraUsd: 85,
          fechaFinalizado: new Date(Date.now() - 86400000 * 1),
        }),
      );

      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Farol trasero izquierdo revisado OK',
          airbagsReventados: false,
          observacionesIngreso:
            'Ingresa por impacto en cuarto trasero izquierdo, portalón y parachoques descuadrado. Trabajo concluido al 100%.',
          fotosIngresoWebp: [
            {
              titulo: 'ANTES: Vista lateral posterior izquierda al ingreso',
              descripcionBreve:
                'Hundimiento en portalón y roce profundo sobre arco trasero izquierdo.',
              url: '/uploads/checkin/tucson_antes_choque.webp',
              pesoKb: 232,
            },
            {
              titulo: 'ANTES: Detalle de abrasión en parachoques izq.',
              descripcionBreve:
                'Acercamiento de la zona afectada previo a desabollado y primer 2K.',
              url: '/uploads/checkin/tucson_antes_detalle.webp',
              pesoKb: 164,
            },
          ],
        }),
      );

      const cot3 = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v,
          version: 1,
          montoOriginalUsd: 780,
          montoAcordadoUsd: 780,
          estadoAprobacion: 'VERDE_ACEPTADA_POR_CHILE',
          creadoPorChile: 'Alfredo Rojas (Encargado Chile)',
          fechaAceptacionChile: new Date(Date.now() - 86400000 * 8),
        }),
      );

      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot3,
          categoria: 'CHAPERIA',
          piezaZona: 'Desabolladura cuarto trasero izquierdo, portalón y parachoques',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 140,
          precioCotizadoOriginalUsd: 320,
          precioAcordadoClienteUsd: 320,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot3,
          categoria: 'PINTURA',
          piezaZona: 'Pintura cabina Gris Grafito bicapa y pulido cerámico final',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 155,
          precioCotizadoOriginalUsd: 460,
          precioAcordadoClienteUsd: 460,
        }),
      ]);

      await this.tareasRepo.save([
        this.tareasRepo.create({
          vehiculo: v,
          orden: 1,
          titulo: 'Desabolladura cuarto trasero izquierdo y ajuste de parachoques',
          tipo: 'CHAPERIA',
          tecnicoAsignadoNombre: mateo.nombre,
          tecnicoAsignadoId: mateo.id,
          pagoAcordadoUsd: 140,
          fechaInicio: fechaHace(7),
          fechaLimite: fechaHace(4),
          pagoLiquidoFinalUsd: 140,
          completada: true,
          fechaCompletada: new Date(Date.now() - 86400000 * 4),
          calificacionEstrellas: 5,
          controlCalidadMasilla: 'APROBADA',
          observacionCalidad: 'Terminación limpia y líneas de carrocería recuperadas.',
        }),
        this.tareasRepo.create({
          vehiculo: v,
          orden: 2,
          titulo: 'Pintado bicapa en cabina y pulido cerámico de entrega',
          tipo: 'PINTURA',
          tecnicoAsignadoNombre: jorge.nombre,
          tecnicoAsignadoId: jorge.id,
          pagoAcordadoUsd: 155,
          fechaInicio: fechaHace(4),
          fechaLimite: fechaHace(1),
          pagoLiquidoFinalUsd: 155,
          completada: true,
          fechaCompletada: new Date(Date.now() - 86400000 * 1),
          calificacionEstrellas: 5,
          controlCalidadMasilla: 'APROBADA',
          observacionCalidad: 'Brillo espejo verificado bajo luz LED para Informe Final PDF.',
        }),
      ]);

      await this.repuestosRepo.save([
        this.repuestosRepo.create({
          vehiculo: v,
          nombreRepuesto: 'Moldura Arco Rueda Trasero + Soporte Parachoques OEM',
          estado: 'INSTALADO',
          codigoSerie: 'HY-TUC-87742',
          solicitadoPor: 'Mateo Silva (Chapero Planta)',
          proveedorOrigen: 'Hyundai Mobis Zofri',
          costoRepuestoUsd: 95,
          fechaRecepcion: new Date(Date.now() - 86400000 * 5),
        }),
      ]);
    } else {
      if (v.color === 'Rojo Carmesí') {
        v.color = 'Gris Grafito';
        await this.vehiculosRepo.update({ id: v.id }, { color: 'Gris Grafito' });
      }

      if (v.checkIn) {
        const fotos = Array.isArray(v.checkIn.fotosIngresoWebp) ? [...v.checkIn.fotosIngresoWebp] : [];
        let changed = false;
        if (!fotos.some((f) => f.url === '/uploads/checkin/tucson_antes_detalle.webp')) {
          fotos.push({
            titulo: 'ANTES: Detalle de abrasión en parachoques izq.',
            descripcionBreve: 'Acercamiento de la zona afectada previo a desabollado y primer 2K.',
            url: '/uploads/checkin/tucson_antes_detalle.webp',
            pesoKb: 164,
          });
          v.checkIn.fotosIngresoWebp = fotos;
          changed = true;
        }
        if (v.checkIn.observacionesIngreso?.includes('derecho')) {
          v.checkIn.observacionesIngreso =
            'Ingresa por impacto en cuarto trasero izquierdo, portalón y parachoques descuadrado. Trabajo concluido al 100%.';
          changed = true;
        }
        if (changed) {
          await this.checkInRepo.save(v.checkIn);
        }
      }
    }

    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarVehiculoNavara(luis: TecnicoProveedor): Promise<Vehiculo> {
    const vin = '3N6AD33A9MK855210';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'LOTE-55210',
          marca: 'Nissan',
          modelo: 'Navara NP300 LE',
          anio: 2021,
          color: 'Plata Metálico',
          tipoCliente: 'INTERNO_IMPORTADORA',
          nombreCliente: 'Importadora Bolivia-Iquique (Stock)',
          telefonoCliente: '+591 712 44010',
          prioridadCola: 'ALTA_15_DIAS',
          estado: 'RECEPCIONADO',
          navieraNombre: 'Naviera Maersk Chile',
          ordenTraspasoPdfUrl: '/uploads/traspasos/orden_traspaso_nissan_navara_55210.pdf',
          navieraPagada: true,
          costoGruaImportadoraUsd: 120,
        }),
      );

      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v,
          tieneLlantaAuxilio: true,
          tieneGataYrench: true,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Neblinero derecho levemente raspado',
          airbagsReventados: false,
          observacionesIngreso:
            'Recibida en taller con Check-In completo. Presenta roce en esquina delantera derecha de parachoques y máscara.',
          fotosIngresoWebp: [
            {
              titulo: 'Ingreso Check-In: Roce frontal derecho en parachoques',
              descripcionBreve:
                'Raspadura profunda en esquina derecha del parachoques delantero y borde de guardabarros.',
              url: '/uploads/checkin/navara_frente.webp',
              pesoKb: 185,
            },
          ],
        }),
      );

      const cot4 = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v,
          version: 1,
          montoOriginalUsd: 690,
          montoAcordadoUsd: 690,
          estadoAprobacion: 'PENDIENTE_REVISION_BOLIVIA',
          creadoPorChile: 'Alfredo Rojas (Encargado Chile)',
        }),
      );

      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot4,
          categoria: 'CHAPERIA',
          piezaZona: 'Cuadratura punta frontal derecha y ajuste parachoques',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 110,
          precioCotizadoOriginalUsd: 260,
          precioAcordadoClienteUsd: 260,
          fotoDesarmeAdendaWebp: '/uploads/desarme/navara_desarme_frente.webp',
          descripcionFotoAdenda: 'Detalle de soporte lateral del parachoques e inspección de fijaciones.',
        }),
        this.cotItemsRepo.create({
          cotizacion: cot4,
          categoria: 'PINTURA',
          piezaZona: 'Pintura parachoques delantero Plata Metálico + difuminado',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 125,
          precioCotizadoOriginalUsd: 290,
          precioAcordadoClienteUsd: 290,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot4,
          categoria: 'MECANICA_INTERNA',
          piezaZona: 'Desmontaje máscara frontal y calibración soporte neblinero',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 55,
          precioCotizadoOriginalUsd: 140,
          precioAcordadoClienteUsd: 140,
        }),
      ]);

      await this.tareasRepo.save([
        this.tareasRepo.create({
          vehiculo: v,
          orden: 1,
          titulo: 'Desmontaje frontal preliminar y revisión de neblinero',
          tipo: 'MECANICA',
          tecnicoAsignadoNombre: luis.nombre,
          tecnicoAsignadoId: luis.id,
          pagoAcordadoUsd: 55,
          fechaInicio: fechaHace(1),
          fechaLimite: fechaEn(2),
          pagoLiquidoFinalUsd: 55,
          completada: true,
          fechaCompletada: new Date(),
          calificacionEstrellas: 5,
          controlCalidadMasilla: 'APROBADA',
          observacionCalidad: 'Soportes internos verificados sin daño en radiador.',
        }),
      ]);

      await this.repuestosRepo.save([
        this.repuestosRepo.create({
          vehiculo: v,
          nombreRepuesto: 'Bisel Neblinero Derecho + Grapas Parachoques Navara',
          estado: 'SOLICITADO',
          codigoSerie: 'NI-NP300-4410',
          observacion: 'Solicitado a importadora de autopartes Iquique para armado frontal.',
          solicitadoPor: 'Luis Herrera (Mecánico Planta)',
          proveedorOrigen: 'Nissan Autopartes Zofri',
          costoRepuestoUsd: 88,
        }),
      ]);
    }
    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarVehiculoSwift(): Promise<Vehiculo> {
    const vin = 'JS2ZC83S5N6191023';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'LOTE-91023',
          marca: 'Suzuki',
          modelo: 'Swift Boosterjet',
          anio: 2022,
          color: 'Azul Eléctrico',
          tipoCliente: 'INTERNO_IMPORTADORA',
          nombreCliente: 'Importadora Bolivia-Iquique (Arribo)',
          telefonoCliente: '+591 712 44010',
          prioridadCola: 'COLA_30_DIAS',
          estado: 'EN_GRUA',
          navieraNombre: 'Naviera MSC Zofri',
          ordenTraspasoPdfUrl: '/uploads/traspasos/orden_traspaso_suzuki_swift_91023.pdf',
          navieraPagada: true,
          costoGruaImportadoraUsd: 75,
        }),
      );
    }
    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarVehiculoTracker(): Promise<Vehiculo> {
    const vin = '9BGJC7520KB214890';
    let v = await this.vehiculosRepo.findOne({ where: { vinChasis: vin } });
    if (!v) {
      v = await this.vehiculosRepo.save(
        this.vehiculosRepo.create({
          vinChasis: vin,
          placaOLote: 'CL-HK-2148',
          marca: 'Chevrolet',
          modelo: 'Tracker Premier',
          anio: 2019,
          color: 'Blanco Perla',
          tipoCliente: 'EXTERNO_CALLE',
          nombreCliente: 'Marco Antonio Quispe (Cliente Particular)',
          telefonoCliente: '+56 9 6721 1904',
          prioridadCola: 'COLA_30_DIAS',
          estado: 'RETIRADO_SIN_REPARAR',
          navieraPagada: true,
          costoGruaImportadoraUsd: 65,
        }),
      );

      await this.checkInRepo.save(
        this.checkInRepo.create({
          vehiculo: v,
          tieneLlantaAuxilio: true,
          tieneGataYrench: false,
          tienePisosCompletos: true,
          tieneRadioOriginal: true,
          estadoFaroles: 'Stop derecho trizado',
          airbagsReventados: false,
          observacionesIngreso:
            'Cliente ingresó unidad para peritaje trasero; posteriormente optó por retirar sin ejecutar reparación (exento de prorrateo fijo).',
        }),
      );

      const cot6 = await this.cotizacionesRepo.save(
        this.cotizacionesRepo.create({
          vehiculo: v,
          version: 1,
          montoOriginalUsd: 890,
          montoAcordadoUsd: 0,
          estadoAprobacion: 'RECHAZADA_CLIENTE',
          creadoPorChile: 'Alfredo Rojas (Encargado Chile)',
          autorizadoEdicionBolivia: 'Carlos Mendoza (Gerencia Bolivia)',
          motivoEdicionAcuerdo:
            'Cliente particular declinó reparación tras evaluación de portalón trasero; unidad retirada del taller.',
        }),
      );

      await this.cotItemsRepo.save([
        this.cotItemsRepo.create({
          cotizacion: cot6,
          categoria: 'CHAPERIA',
          piezaZona: 'Cambio portalón trasero y enderezado faldón',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 210,
          precioCotizadoOriginalUsd: 540,
          precioAcordadoClienteUsd: 0,
        }),
        this.cotItemsRepo.create({
          cotizacion: cot6,
          categoria: 'PINTURA',
          piezaZona: 'Pintura tricapa Blanco Perla posterior',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 130,
          precioCotizadoOriginalUsd: 350,
          precioAcordadoClienteUsd: 0,
        }),
      ]);
    }
    return (await this.vehiculosRepo.findOne({ where: { vinChasis: vin } })) || v;
  }

  private async asegurarMovimientosDemo() {
    const actuales = await this.movimientosRepo.find();

    const seeds: Partial<MovimientoInsumo>[] = [
      {
        tipo: 'COMPRA_PINTURA_COLORISTA',
        insumoNombre: 'Pintura Bicapa Colorista (Código Ford N7 Azul + Tucson)',
        cantidad: 3.5,
        unidad: 'Litros',
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tareaReferencia: 'Preparación bicapa cabina y difuminado guardabarros',
        costoTotalUsd: 165,
        fotoFacturaWebp: '/uploads/facturas/boleta_colorista_4410.webp',
        descripcionFotoFactura: 'Boleta #4410 Colorista Iquique: 3.5L pintura bicapa preparada + diluyente UHS.',
      },
      {
        tipo: 'ENTRADA_STOCK',
        insumoNombre: 'Masilla Poliéster Automotriz (Lata 4 Kg)',
        cantidad: 8,
        unidad: 'Lata',
        vehiculoReferencia: 'Reposición Mensual Almacén',
        tareaReferencia: 'Compra mayorista Distribuidora Zofri (Factura #008821)',
        costoTotalUsd: 192,
        fotoFacturaWebp: '/uploads/facturas/factura_insumos_zofri_8821.webp',
        descripcionFotoFactura: 'Factura Electrónica #008821 Zofri S.A.: 8 latas masilla poliéster con timbre SII.',
      },
      {
        tipo: 'SALIDA_POR_TAREA',
        insumoNombre: 'Lijas al Agua Grano P180 - P320 (Caja x50)',
        cantidad: 1,
        unidad: 'Caja',
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tareaReferencia: 'Desbaste y cuadratura capó y guardabarros',
        costoTotalUsd: 18,
      },
      {
        tipo: 'SALIDA_POR_TAREA',
        insumoNombre: 'Barniz Transparente UHS 2K (Kit + Endurecedor)',
        cantidad: 1,
        unidad: 'Kit',
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tareaReferencia: 'Acabado en cabina presurizada y pulido espejo',
        costoTotalUsd: 85,
      },
      {
        tipo: 'COMPRA_PINTURA_COLORISTA',
        insumoNombre: 'Pintura Gris Grafito Hyundai Igualada Espectro',
        cantidad: 2,
        unidad: 'Litros',
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tareaReferencia: 'Igualación colorista cuarto trasero izquierdo y parachoques',
        costoTotalUsd: 118,
        fotoFacturaWebp: '/uploads/facturas/boleta_colorista_4410.webp',
        descripcionFotoFactura: 'Complemento mezcla colorista igualada a espectrofotómetro.',
      },
    ];

    for (const s of seeds) {
      const existe = actuales.find(
        (m) => m.insumoNombre === s.insumoNombre && m.vehiculoReferencia === s.vehiculoReferencia,
      );
      if (!existe) {
        await this.movimientosRepo.save(this.movimientosRepo.create(s));
      } else if (!existe.fotoFacturaWebp && s.fotoFacturaWebp) {
        existe.fotoFacturaWebp = s.fotoFacturaWebp;
        existe.descripcionFotoFactura = s.descripcionFotoFactura || existe.descripcionFotoFactura;
        existe.tareaReferencia = s.tareaReferencia || existe.tareaReferencia;
        await this.movimientosRepo.save(existe);
      }
    }
  }

  private async asegurarHerramientasDemo() {
    const actuales = await this.herramientasRepo.find();
    const seeds: Partial<HerramientaTaller>[] = [
      { nombre: 'Pistola de Pintura HVLP Devilbiss Pro', estado: 'ACTIVA', costoCompraUsd: 240 },
      { nombre: 'Equipo de Soldadura MIG/MAG 220A', estado: 'ACTIVA', costoCompraUsd: 680 },
      { nombre: 'Compresor Industrial 300 Litros 5HP', estado: 'ACTIVA', costoCompraUsd: 920 },
      { nombre: 'Lijadora Orbital Neumática 6" Rupes', estado: 'ACTIVA', costoCompraUsd: 165 },
      { nombre: 'Lámpara Infrarroja de Secado Cabina IR-3000', estado: 'ACTIVA', costoCompraUsd: 480 },
      {
        nombre: 'Gata Hidráulica Lagarto 3 Toneladas',
        estado: 'DADA_DE_BAJA',
        costoCompraUsd: 145,
        responsableBaja: 'Ayudante Taller Turno B',
        tipoCausaBaja: 'MAL_USO_COBRAR',
        detalleBaja: 'Sello hidráulico reventado y pistón torcido por apoyo lateral indebido sin taco.',
        fotoHerramientaRotaWebp: '/uploads/herramientas/gata_rota_1t.webp',
        descripcionFotoBaja: 'Pistón hidráulico doblado y fuga de aceite verificada en patio.',
      },
      {
        nombre: 'Kit Boquilla y Aguja 1.4mm HVLP Devilbiss',
        estado: 'DADA_DE_BAJA',
        costoCompraUsd: 38,
        responsableBaja: 'Jorge Paredes (Pintor Cabina)',
        tipoCausaBaja: 'DESGASTE_NORMAL',
        detalleBaja: 'Abrasión normal del pico tras 1,200 horas de aplicación de primer 2K y barniz UHS.',
        fotoHerramientaRotaWebp: '/uploads/herramientas/boquilla_hvlp_desgaste.webp',
        descripcionFotoBaja: 'Acta de inspección por desgaste natural sin cargo al pintor.',
      },
      {
        nombre: 'Gata Hidráulica Lagarto 3.5 Toneladas (Reposición)',
        estado: 'COMPRA_SOLICITADA',
        costoCompraUsd: 195,
        detalleBaja: 'Reposición urgente solicitada tras baja de unidad de 3T.',
      },
    ];

    for (const s of seeds) {
      if (!actuales.some((h) => h.nombre === s.nombre)) {
        await this.herramientasRepo.save(this.herramientasRepo.create(s));
      }
    }
  }

  private async asegurarEvidenciasDemo(refs: {
    v1: Vehiculo;
    v2: Vehiculo;
    v3: Vehiculo;
    v4: Vehiculo;
    v5: Vehiculo;
  }) {
    const actuales = await this.evidenciasRepo.find();
    const cot1 = refs.v1.cotizaciones?.[0];
    const cot4 = refs.v4.cotizaciones?.[0];

    const seeds: Partial<EvidenciaFotografica>[] = [
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Golpe frontal derecho y capó',
        descripcionBreve: 'Parachoques trizado, farol derecho roto y descuadre en punta delantera.',
        archivoWebpUrl: '/uploads/checkin/ranger_frente.webp',
        nombreArchivo: 'ranger_frente.webp',
        pesoOriginalKb: 926,
        pesoWebpKb: 196,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Tablero con airbag frontal detonado',
        descripcionBreve: 'Volante y cubierta acompañante desplegados; requiere reset SRS.',
        archivoWebpUrl: '/uploads/checkin/ranger_tablero_airbag.webp',
        nombreArchivo: 'ranger_tablero_airbag.webp',
        pesoOriginalKb: 765,
        pesoWebpKb: 121,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Cabina delantera sin pisos originales',
        descripcionBreve: 'Verificación de ingreso confirma ausencia de pisos OEM desde puerto.',
        archivoWebpUrl: '/uploads/checkin/ranger_sin_pisos.webp',
        nombreArchivo: 'ranger_sin_pisos.webp',
        pesoOriginalKb: 827,
        pesoWebpKb: 132,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'DESARME_COTIZACION',
        referenciaId: cot1?.id || refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Adenda desarme: Puente radiador e intercooler',
        descripcionBreve: 'Daño estructural oculto descubierto al desmontar carenado frontal.',
        archivoWebpUrl: '/uploads/desarme/ranger_desarme_oculto.webp',
        nombreArchivo: 'ranger_desarme_oculto.webp',
        pesoOriginalKb: 929,
        pesoWebpKb: 187,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS',
        referenciaId: refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Farol LED OEM Ford recibido OK',
        descripcionBreve: 'Óptica recibida en caja sellada Iquique y verificada en almacén.',
        archivoWebpUrl: '/uploads/repuestos/farol_ranger_oem.webp',
        nombreArchivo: 'farol_ranger_oem.webp',
        pesoOriginalKb: 832,
        pesoWebpKb: 145,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS',
        referenciaId: refs.v1.id,
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Parachoques observado (no compatible con sensores)',
        descripcionBreve: 'Pieza recibida sin orificios para sensores XLT; gestionado cambio en Zofri.',
        archivoWebpUrl: '/uploads/repuestos/parachoques_incompatible.webp',
        nombreArchivo: 'parachoques_incompatible.webp',
        pesoOriginalKb: 820,
        pesoWebpKb: 126,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v2.id,
        vehiculoReferencia: 'Toyota RAV4 Hybrid 2021 (CL-PR-4491)',
        tituloDetalle: 'Abolladura lateral izquierda en recepción',
        descripcionBreve: 'Hundimiento moderado sobre guardabarros izquierdo y roce en puerta.',
        archivoWebpUrl: '/uploads/checkin/rav4_lateral_izq.webp',
        nombreArchivo: 'rav4_lateral_izq.webp',
        pesoOriginalKb: 856,
        pesoWebpKb: 148,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v3.id,
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tituloDetalle: 'ANTES: Roce cuarto trasero izquierdo y portalón',
        descripcionBreve: 'Estado inicial al ingresar al taller previo a desabolladura y pintura.',
        archivoWebpUrl: '/uploads/checkin/tucson_antes_choque.webp',
        nombreArchivo: 'tucson_antes_choque.webp',
        pesoOriginalKb: 1002,
        pesoWebpKb: 232,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v3.id,
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tituloDetalle: 'ANTES: Acercamiento abrasión parachoques izq.',
        descripcionBreve: 'Detalle de raspones profundos y desajuste de esquina trasera.',
        archivoWebpUrl: '/uploads/checkin/tucson_antes_detalle.webp',
        nombreArchivo: 'tucson_antes_detalle.webp',
        pesoOriginalKb: 640,
        pesoWebpKb: 164,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'ENTREGA_FINAL',
        referenciaId: refs.v3.id,
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tituloDetalle: 'DESPUÉS: Acabado cabina y pulido cerámico',
        descripcionBreve: 'Vehículo terminado y verificado bajo luz de inspección para entrega.',
        archivoWebpUrl: '/uploads/entrega/tucson_despues_pulido.webp',
        nombreArchivo: 'tucson_despues_pulido.webp',
        pesoOriginalKb: 780,
        pesoWebpKb: 126,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'ENTREGA_FINAL',
        referenciaId: refs.v3.id,
        vehiculoReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tituloDetalle: 'DESPUÉS: Detalle terminación barniz UHS 2K',
        descripcionBreve: 'Control de calidad Gris Grafito sin diferencia tonal ni exceso de masilla.',
        archivoWebpUrl: '/uploads/entrega/tucson_despues_detalle.webp',
        nombreArchivo: 'tucson_despues_detalle.webp',
        pesoOriginalKb: 610,
        pesoWebpKb: 142,
        subidoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        paisOrigen: 'BOLIVIA',
      },
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: refs.v4.id,
        vehiculoReferencia: 'Nissan Navara NP300 LE 2021 (LOTE-55210)',
        tituloDetalle: 'ANTES: Roce esquina delantera derecha',
        descripcionBreve: 'Ingreso en bahía taller con raspadura en esquina derecha de parachoques.',
        archivoWebpUrl: '/uploads/checkin/navara_frente.webp',
        nombreArchivo: 'navara_frente.webp',
        pesoOriginalKb: 890,
        pesoWebpKb: 185,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'DESARME_COTIZACION',
        referenciaId: cot4?.id || refs.v4.id,
        vehiculoReferencia: 'Nissan Navara NP300 LE 2021 (LOTE-55210)',
        tituloDetalle: 'Inspección soporte lateral y neblinero Navara',
        descripcionBreve: 'Revisión de fijaciones tras retirar esquina de parachoques.',
        archivoWebpUrl: '/uploads/desarme/navara_desarme_frente.webp',
        nombreArchivo: 'navara_desarme_frente.webp',
        pesoOriginalKb: 540,
        pesoWebpKb: 138,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'TRASPASO_NAVIERA',
        referenciaId: refs.v4.id,
        vehiculoReferencia: 'Nissan Navara NP300 LE 2021 (LOTE-55210)',
        tituloDetalle: 'Pase de Puerta Puerto Iquique #55210',
        descripcionBreve: 'Liberación naviera Maersk Chile pagada y retiro en grúa autorizado.',
        archivoWebpUrl: '/uploads/traspasos/pase_puerto_navara_55210.webp',
        nombreArchivo: 'pase_puerto_navara_55210.webp',
        pesoOriginalKb: 420,
        pesoWebpKb: 96,
        subidoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        paisOrigen: 'BOLIVIA',
      },
      {
        moduloOrigen: 'FACTURA_INSUMO_COLORISTA',
        vehiculoReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tituloDetalle: 'Boleta #4410 Colorista Iquique ($165 USD)',
        descripcionBreve: 'Pintura bicapa preparada según código Ford y Hyundai + diluyente UHS.',
        archivoWebpUrl: '/uploads/facturas/boleta_colorista_4410.webp',
        nombreArchivo: 'boleta_colorista_4410.webp',
        pesoOriginalKb: 1017,
        pesoWebpKb: 233,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'FACTURA_INSUMO_COLORISTA',
        vehiculoReferencia: 'Reposición Mensual Almacén',
        tituloDetalle: 'Factura Electrónica Zofri #008821 ($192 USD)',
        descripcionBreve: 'Compra mayorista de 8 latas Masilla Poliéster 4Kg con timbre SII.',
        archivoWebpUrl: '/uploads/facturas/factura_insumos_zofri_8821.webp',
        nombreArchivo: 'factura_insumos_zofri_8821.webp',
        pesoOriginalKb: 480,
        pesoWebpKb: 98,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'BAJA_HERRAMIENTA',
        vehiculoReferencia: 'Inventario Taller Iquique',
        tituloDetalle: 'Baja por Mal Uso: Gata Hidráulica Lagarto 3T',
        descripcionBreve: 'Pistón doblado y pérdida de aceite hidráulico por mal apoyo lateral.',
        archivoWebpUrl: '/uploads/herramientas/gata_rota_1t.webp',
        nombreArchivo: 'gata_rota_1t.webp',
        pesoOriginalKb: 1011,
        pesoWebpKb: 241,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
      {
        moduloOrigen: 'BAJA_HERRAMIENTA',
        vehiculoReferencia: 'Inventario Taller Iquique',
        tituloDetalle: 'Acta Desgaste Normal: Kit Boquilla HVLP 1.4mm',
        descripcionBreve: 'Cumplimiento de ciclo de 1,200h en cabina sin cargo al pintor.',
        archivoWebpUrl: '/uploads/herramientas/boquilla_hvlp_desgaste.webp',
        nombreArchivo: 'boquilla_hvlp_desgaste.webp',
        pesoOriginalKb: 380,
        pesoWebpKb: 89,
        subidoPor: 'Alfredo Rojas (Encargado Chile)',
        paisOrigen: 'CHILE',
      },
    ];

    for (const ev of seeds) {
      const existe = actuales.find((a) => a.archivoWebpUrl === ev.archivoWebpUrl);
      if (!existe) {
        await this.evidenciasRepo.save(this.evidenciasRepo.create(ev));
      } else if (ev.archivoWebpUrl?.includes('tucson_antes_choque') && existe.tituloDetalle?.includes('derecho')) {
        existe.tituloDetalle = ev.tituloDetalle || existe.tituloDetalle;
        await this.evidenciasRepo.save(existe);
      }
    }
  }

  private async asegurarAuditoriaDemo() {
    const actuales = await this.auditoriaRepo.find();
    const seeds: Partial<HistorialEdicion>[] = [
      {
        modulo: 'RECEPCION',
        entidadReferencia: 'Nissan Navara NP300 LE 2021 (LOTE-55210)',
        tipoAccion: 'TRASPASO_NAVIERA_AUTORIZADO',
        valorAnterior: 'Estado: EN_PUERTO_NAVIERA (Maersk Chile)',
        valorNuevo: 'Estado: RECEPCIONADO en taller (Grúa $120 USD + Pase #55210)',
        motivoEdicion: 'Naviera cancelada por Gerencia Bolivia; unidad retirada e ingresada con Check-In completo.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        evidenciaFotoUrl: '/uploads/traspasos/pase_puerto_navara_55210.webp',
        evidenciaDescripcion: 'Pase de puerta aduanero y documento PDF adjunto.',
      },
      {
        modulo: 'COTIZACION',
        entidadReferencia: 'Ford Ranger XLT 2022 (LOTE-88412)',
        tipoAccion: 'ADENDA_DESARME_APROBADA',
        valorAnterior: 'Total Cotización v1: $1,180 USD',
        valorNuevo: 'Total Cotización v2: $1,380 USD (+200 puente radiador)',
        motivoEdicion: 'Daño oculto expuesto al desmontar parachoques frontal; autorizado por gerencia Bolivia.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        evidenciaFotoUrl: '/uploads/desarme/ranger_desarme_oculto.webp',
        evidenciaDescripcion: 'Soporte radiador e intercooler desplazados en desarme.',
      },
      {
        modulo: 'COTIZACION',
        entidadReferencia: 'Toyota RAV4 Hybrid 2021 (CL-PR-4491)',
        tipoAccion: 'AJUSTE_COMERCIAL_BOLIVIA',
        valorAnterior: 'Cotización Inicial: $520 USD',
        valorNuevo: 'Acuerdo Amarillo Bolivia: $460 USD (-$60 descuento)',
        motivoEdicion: 'Descuento comercial para cerrar orden del cliente externo antes de cierre semanal.',
        editadoPor: 'Socia Inversora Bolivia',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
      },
      {
        modulo: 'ORDEN_TRABAJO',
        entidadReferencia: 'Ford Ranger XLT 2022 — Tarea #2 SRS Airbag',
        tipoAccion: 'MULTA_ATRASO_APLICADA',
        valorAnterior: 'Pago Acordado: $170 USD (Sin retraso)',
        valorNuevo: 'Pago Líquido Ajustado: $130 USD (-$40 por 2 días de atraso)',
        motivoEdicion: 'Incumplimiento de fecha límite comprometida por proveedor externo de módulos SRS.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
      },
      {
        modulo: 'REPUESTOS',
        entidadReferencia: 'Parachoques Delantero XLT (Ford Ranger)',
        tipoAccion: 'REPUESTO_OBSERVADO_CAMBIO',
        valorAnterior: 'Estado: SOLICITADO (Código FB-XLT-9901)',
        valorNuevo: 'Estado: OBSERVADO_NO_COMPATIBLE + Nueva Solicitud Reemplazo',
        motivoEdicion: 'Proveedor despachó parachoques básico XL sin orificios para sensores frontales.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        evidenciaFotoUrl: '/uploads/repuestos/parachoques_incompatible.webp',
        evidenciaDescripcion: 'Pieza recibida en almacén sin perforaciones de sensores.',
      },
      {
        modulo: 'ALMACEN_INSUMOS',
        entidadReferencia: 'Masilla Poliéster Automotriz (Lata 4 Kg)',
        tipoAccion: 'INGRESO_FACTURA_ZOFRI',
        valorAnterior: 'Stock previo: 6 Latas',
        valorNuevo: 'Stock actualizado: 14 Latas (+8 u. / $192 USD)',
        motivoEdicion: 'Reposición mensual preventiva con respaldo de Factura Electrónica Zofri #008821.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Socia Inversora Bolivia',
        evidenciaFotoUrl: '/uploads/facturas/factura_insumos_zofri_8821.webp',
        evidenciaDescripcion: 'Factura #008821 Distribuidora Automotriz Zofri pagada.',
      },
      {
        modulo: 'HERRAMIENTAS',
        entidadReferencia: 'Gata Hidráulica Lagarto 3 Toneladas',
        tipoAccion: 'BAJA_MAL_USO_COBRAR',
        valorAnterior: 'Estado: ACTIVA ($145 USD)',
        valorNuevo: 'Estado: DADA_DE_BAJA (Cobrar a Ayudante Turno B)',
        motivoEdicion: 'Sello hidráulico reventado y pistón torcido por sobrecarga lateral sin taco de seguridad.',
        editadoPor: 'Alfredo Rojas (Encargado Chile)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        evidenciaFotoUrl: '/uploads/herramientas/gata_rota_1t.webp',
        evidenciaDescripcion: 'Pistón doblado y fuga de aceite verificada en patio.',
      },
      {
        modulo: 'CONFIGURACION',
        entidadReferencia: 'Hyundai Tucson Limited 2021 (CL-KJ-7710)',
        tipoAccion: 'CIERRE_Y_CERTIFICADO_CALIDAD',
        valorAnterior: 'Estado: EN_TALLER (Gastos fijos base $2,400/mes)',
        valorNuevo: 'Estado: FINALIZADO • Certificado #CERT-319044-2026 Emitido',
        motivoEdicion: 'Cierre de costos reales validado y emisión de Acta de Calidad e Informe Final PDF.',
        editadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        aprobadoPor: 'Carlos Mendoza (Gerencia Bolivia)',
        evidenciaFotoUrl: '/uploads/auditoria/acta_calidad_tucson_cl_kj_7710.webp',
        evidenciaDescripcion: 'Acta de control de calidad final aprobada (100%).',
      },
    ];

    for (const s of seeds) {
      const existe = actuales.some(
        (a) => a.tipoAccion === s.tipoAccion && a.entidadReferencia === s.entidadReferencia,
      );
      if (!existe) {
        await this.auditoriaRepo.save(this.auditoriaRepo.create(s));
      }
    }
  }

  private async asegurarNotificacionesDemo(refs: {
    v1: Vehiculo;
    v2: Vehiculo;
    v3: Vehiculo;
    v4: Vehiculo;
    v5: Vehiculo;
  }) {
    const actuales = await this.notifRepo.find();
    const cot2 = refs.v2.cotizaciones?.[0];
    const cot4 = refs.v4.cotizaciones?.[0];

    const seeds: Partial<NotificacionTiempoReal>[] = [
      {
        tipo: 'ATRASO_TAREA',
        titulo: '⚠️ Retraso Crítico OT: Ford Ranger LOTE-88412',
        mensaje: 'SRS Airbag Pro Zofri acumula 2 días de retraso en reset de centralita (-$40 USD multa).',
        destinoRol: 'TODOS',
        moduloDestino: 'ordenes',
        vehiculoId: refs.v1.id,
        actorEmail: null,
        actorNombre: 'Control Automático de Plazos',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'COTIZACION_EDITADA',
        titulo: '🟡 Cotización Editada (Amarillo): Toyota RAV4 CL-PR-4491',
        mensaje: 'Bolivia ajustó el acuerdo comercial a $460 USD. Pendiente confirmación Verde en Chile.',
        destinoRol: 'TODOS',
        moduloDestino: 'cotizacion',
        vehiculoId: refs.v2.id,
        referenciaId: cot2?.id || null,
        actorEmail: 'carlos@bolivia.com',
        actorNombre: 'Carlos Mendoza (Gerencia Bolivia)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'RECEPCION_VEHICULO',
        titulo: '📋 Nueva Cotización por Revisar: Nissan Navara LOTE-55210',
        mensaje: 'Unidad recepcionada en Iquique; cotización inicial por $690 USD espera aprobación Bolivia.',
        destinoRol: 'TODOS',
        moduloDestino: 'cotizacion',
        vehiculoId: refs.v4.id,
        referenciaId: cot4?.id || null,
        actorEmail: 'alfredo@chile.com',
        actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'REPUESTO_OBSERVADO',
        titulo: '🔎 Repuesto Rechazado en Taller: Parachoques Ranger XLT',
        mensaje: 'Llegó versión XL sin sensores y se solicitó reemplazo en Zofri ($195 USD).',
        destinoRol: 'TODOS',
        moduloDestino: 'repuestos',
        vehiculoId: refs.v1.id,
        actorEmail: 'alfredo@chile.com',
        actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'BAJA_HERRAMIENTA',
        titulo: '🔧 Baja por Mal Uso ($145 USD): Gata Lagarto 3T',
        mensaje: 'Ayudante Turno B dañó el pistón por sobrecarga lateral. Respaldo fotográfico adjunto.',
        destinoRol: 'TODOS',
        moduloDestino: 'herramientas',
        subTabDestino: 'herramientas',
        actorEmail: 'alfredo@chile.com',
        actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'VEHICULO_FINALIZADO',
        titulo: '📄 Informe Final PDF Listo: Hyundai Tucson CL-KJ-7710',
        mensaje: 'Vehículo terminado con comparativa Antes/Después. Ya puedes descargar el informe PDF.',
        destinoRol: 'BOLIVIA',
        moduloDestino: 'reportes',
        vehiculoId: refs.v3.id,
        actorEmail: 'alfredo@chile.com',
        actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'RECEPCION_VEHICULO',
        titulo: '🚛 Unidad En Grúa desde Puerto: Suzuki Swift LOTE-91023',
        mensaje: 'Naviera MSC Zofri pagada; grúa en ruta al taller con Orden de Traspaso PDF.',
        destinoRol: 'TODOS',
        moduloDestino: 'recepcion',
        vehiculoId: refs.v5.id,
        actorEmail: 'carlos@bolivia.com',
        actorNombre: 'Carlos Mendoza (Gerencia Bolivia)',
        leidaPor: {},
        leida: false,
      },
      {
        tipo: 'COMPRA_INSUMO',
        titulo: '🧾 Factura Zofri #008821 y Boleta Colorista #4410 Registradas',
        mensaje: 'Respaldo fotográfico cargado en Almacén e Insumos.',
        destinoRol: 'TODOS',
        moduloDestino: 'almacen',
        subTabDestino: 'movimientos',
        actorEmail: 'alfredo@chile.com',
        actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
        leidaPor: {
          'carlos@bolivia.com': new Date(Date.now() - 3600000 * 6).toISOString(),
        },
        leida: false,
      },
    ];

    for (const n of seeds) {
      const existe = actuales.some((a) => a.titulo === n.titulo);
      if (!existe) {
        await this.notifRepo.save(this.notifRepo.create(n));
      }
    }
  }

  private async repararDatosSeedLegacy() {
    const newHash = await bcrypt.hash('admin123', 10);
    for (const email of DEMO_EMAILS) {
      const user = await this.usuariosRepo.findOne({ where: { email } });
      if (user) {
        const esPasswordLegado = await bcrypt.compare('123456', user.passwordHash);
        if (esPasswordLegado) {
          user.passwordHash = newHash;
          await this.usuariosRepo.save(user);
          this.logger.log(`Password demo legado actualizado a 'admin123' para ${email}`);
        }
      }
    }

    const legacyMap: Record<string, string> = {
      '/uploads/checkin/demo1.webp': '/uploads/checkin/ranger_frente.webp',
      '/uploads/checkin/demo2.webp': '/uploads/checkin/ranger_tablero_airbag.webp',
      '/uploads/checkin/demo3.webp': '/uploads/checkin/ranger_sin_pisos.webp',
      '/uploads/checkin/rav4_1.webp': '/uploads/checkin/rav4_lateral_izq.webp',
      '/uploads/desarme/desarme1.webp': '/uploads/desarme/ranger_desarme_oculto.webp',
      '/uploads/facturas/boleta_pintura_4410.webp': '/uploads/facturas/boleta_colorista_4410.webp',
      '/uploads/herramientas/gata_rota.webp': '/uploads/herramientas/gata_rota_1t.webp',
      '/uploads/traspasos/Orden_Traspaso_Ford_Ranger_88412.pdf': '/uploads/traspasos/orden_traspaso_ford_ranger_88412.pdf',
    };

    const vehiculos = await this.vehiculosRepo.find();
    for (const v of vehiculos) {
      if (v.ordenTraspasoPdfUrl && legacyMap[v.ordenTraspasoPdfUrl]) {
        v.ordenTraspasoPdfUrl = legacyMap[v.ordenTraspasoPdfUrl];
        await this.vehiculosRepo.update({ id: v.id }, { ordenTraspasoPdfUrl: v.ordenTraspasoPdfUrl });
      }
      if (v.checkIn?.fotosIngresoWebp?.length) {
        let changed = false;
        const nextFotos = v.checkIn.fotosIngresoWebp.map((f) => {
          if (legacyMap[f.url]) {
            changed = true;
            return { ...f, url: legacyMap[f.url] };
          }
          return f;
        });
        if (changed) {
          v.checkIn.fotosIngresoWebp = nextFotos;
          await this.checkInRepo.save(v.checkIn);
        }
      }
    }

    const cotItems = await this.cotItemsRepo.find();
    for (const item of cotItems) {
      if (item.fotoDesarmeAdendaWebp && legacyMap[item.fotoDesarmeAdendaWebp]) {
        item.fotoDesarmeAdendaWebp = legacyMap[item.fotoDesarmeAdendaWebp];
        await this.cotItemsRepo.save(item);
      }
    }

    const movimientos = await this.movimientosRepo.find();
    for (const m of movimientos) {
      if (m.fotoFacturaWebp && legacyMap[m.fotoFacturaWebp]) {
        m.fotoFacturaWebp = legacyMap[m.fotoFacturaWebp];
        await this.movimientosRepo.save(m);
      }
    }

    const herramientas = await this.herramientasRepo.find();
    for (const h of herramientas) {
      if (h.fotoHerramientaRotaWebp && legacyMap[h.fotoHerramientaRotaWebp]) {
        h.fotoHerramientaRotaWebp = legacyMap[h.fotoHerramientaRotaWebp];
        await this.herramientasRepo.save(h);
      }
    }

    const evidencias = await this.evidenciasRepo.find();
    for (const ev of evidencias) {
      if (ev.archivoWebpUrl && legacyMap[ev.archivoWebpUrl]) {
        ev.archivoWebpUrl = legacyMap[ev.archivoWebpUrl];
        ev.nombreArchivo = ev.archivoWebpUrl.split('/').pop() || ev.nombreArchivo;
        await this.evidenciasRepo.save(ev);
      }
    }

    const historial = await this.auditoriaRepo.find();
    for (const hist of historial) {
      if (hist.evidenciaFotoUrl && legacyMap[hist.evidenciaFotoUrl]) {
        hist.evidenciaFotoUrl = legacyMap[hist.evidenciaFotoUrl];
        await this.auditoriaRepo.save(hist);
      }
    }

    const notifs = await this.notifRepo.find();
    for (const n of notifs) {
      let updated = false;
      if (!n.tipo) {
        n.tipo = 'SISTEMA';
        updated = true;
      }
      if (!n.moduloDestino || n.moduloDestino === 'dashboard') {
        const tipoStr = String(n.tipo || 'SISTEMA');
        if (tipoStr === 'ATRASO_TAREA' || tipoStr === 'TAREA_OT' || tipoStr === 'CALIDAD_MASILLA') {
          n.moduloDestino = 'ordenes';
          updated = true;
        } else if (tipoStr === 'COTIZACION_EDITADA' || tipoStr === 'COTIZACION_APROBADA') {
          n.moduloDestino = 'cotizacion';
          updated = true;
        } else if (tipoStr === 'BAJA_HERRAMIENTA' || tipoStr === 'SOLICITUD_HERRAMIENTA') {
          n.moduloDestino = 'herramientas';
          n.subTabDestino = 'herramientas';
          updated = true;
        } else if (tipoStr === 'COMPRA_INSUMO' || tipoStr === 'STOCK_BAJO') {
          n.moduloDestino = 'almacen';
          updated = true;
        } else if (tipoStr.startsWith('REPUESTO_')) {
          n.moduloDestino = 'repuestos';
          updated = true;
        } else if (tipoStr === 'VEHICULO_FINALIZADO') {
          n.moduloDestino = 'reportes';
          updated = true;
        } else if (tipoStr === 'RECEPCION_VEHICULO') {
          n.moduloDestino = 'recepcion';
          updated = true;
        }
      }
      const seedMetaPorTitulo: Record<
        string,
        {
          actorEmail: string | null;
          actorNombre: string;
          destinoRol: 'TODOS' | 'BOLIVIA' | 'CHILE';
          migrarLeidaParaCarlos?: boolean;
        }
      > = {
        '⚠️ Retraso Crítico OT: Ford Ranger LOTE-88412': {
          actorEmail: null,
          actorNombre: 'Control Automático de Plazos',
          destinoRol: 'TODOS',
        },
        '🟡 Cotización Editada (Amarillo): Toyota RAV4 CL-PR-4491': {
          actorEmail: 'carlos@bolivia.com',
          actorNombre: 'Carlos Mendoza (Gerencia Bolivia)',
          destinoRol: 'TODOS',
        },
        '📋 Nueva Cotización por Revisar: Nissan Navara LOTE-55210': {
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          destinoRol: 'TODOS',
        },
        '🔎 Repuesto Rechazado en Taller: Parachoques Ranger XLT': {
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          destinoRol: 'TODOS',
        },
        '🔧 Baja por Mal Uso ($145 USD): Gata Lagarto 3T': {
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          destinoRol: 'TODOS',
        },
        '📄 Informe Final PDF Listo: Hyundai Tucson CL-KJ-7710': {
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          destinoRol: 'BOLIVIA',
        },
        '🚛 Unidad En Grúa desde Puerto: Suzuki Swift LOTE-91023': {
          actorEmail: 'carlos@bolivia.com',
          actorNombre: 'Carlos Mendoza (Gerencia Bolivia)',
          destinoRol: 'TODOS',
        },
        '🧾 Factura Zofri #008821 y Boleta Colorista #4410 Registradas': {
          actorEmail: 'alfredo@chile.com',
          actorNombre: 'Alfredo Rojas (Encargado Taller Chile)',
          destinoRol: 'TODOS',
          migrarLeidaParaCarlos: true,
        },
      };

      const meta = seedMetaPorTitulo[n.titulo];
      if (meta) {
        if (!n.actorNombre) {
          n.actorEmail = meta.actorEmail;
          n.actorNombre = meta.actorNombre;
          n.destinoRol = meta.destinoRol;
          updated = true;
        }
        if (
          meta.migrarLeidaParaCarlos &&
          n.leida &&
          (!n.leidaPor || Object.keys(n.leidaPor).length === 0)
        ) {
          n.leida = false;
          n.leidaPor = {
            'carlos@bolivia.com': (n.leidaEn || new Date()).toISOString(),
          };
          updated = true;
        }
      }
      if (updated) {
        await this.notifRepo.save(n);
      }
    }
  }
}
