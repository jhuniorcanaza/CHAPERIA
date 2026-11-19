import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { MovimientoInsumo } from '../almacen/movimiento-insumo.entity';
import { TecnicoProveedor } from '../personal/tecnico-proveedor.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EvidenciasFotosService } from '../evidencias-fotos/evidencias-fotos.service';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    @InjectRepository(MovimientoInsumo)
    private readonly movRepo: Repository<MovimientoInsumo>,
    @InjectRepository(TecnicoProveedor)
    private readonly tecnicoRepo: Repository<TecnicoProveedor>,
    private readonly notificacionesService: NotificacionesService,
    private readonly evidenciasService: EvidenciasFotosService,
  ) {}

  private validarAccesoBolivia(rol?: string) {
    if (rol === 'ENCARGADO_CHILE') {
      throw new ForbiddenException(
        'ACCESO DENEGADO: El módulo de Reportes Financieros, Costeo y Cierre es exclusivo para la administración y gerencia en Bolivia.',
      );
    }
  }

  async obtenerResumenFinancieroGlobal(rol?: string) {
    this.validarAccesoBolivia(rol);

    const [config, vehiculos, movimientos, tecnicos, evidencias] = await Promise.all([
      this.notificacionesService.getConfiguracion(),
      this.vehiculoRepo.find({
        relations: ['checkIn', 'cotizaciones', 'cotizaciones.items', 'tareasOt', 'repuestos'],
        relationLoadStrategy: 'query',
        order: { fechaIngreso: 'DESC' },
      }),
      this.movRepo.find(),
      this.tecnicoRepo.find(),
      this.evidenciasService.findAll(undefined, 500),
    ]);

    const gastosFijosMensuales = round2(config.gastosFijosMensualesTallerUsd ?? 2400);
    const tasaUsdAClp = Number(config.tasaUsdAClp || 980);
    const multaPorDiaRetrasoUsd = round2(config.multaPorDiaRetrasoUsd ?? 20);

    let nominaFijaMensualUsd = 0;
    for (const tec of tecnicos) {
      if (!tec.bloqueadoPorMalTrabajo && tec.modalidad === 'SUELDO_FIJO') {
        nominaFijaMensualUsd += Number(tec.sueldoFijoMensualUsd || 0);
      }
    }
    nominaFijaMensualUsd = round2(nominaFijaMensualUsd);

    const vehiculosProductivos = vehiculos.filter((v) => v.estado !== 'RETIRADO_SIN_REPARAR');
    const totalVehiculosProductivos = Math.max(1, vehiculosProductivos.length || vehiculos.length);
    const prorrateoBaseUsd = round2(gastosFijosMensuales / totalVehiculosProductivos);

    const reportePorVehiculo = vehiculos.map((v) => {
      // 1. Ingresos: precio cotizado al cliente (prioridad a cotización aceptada en verde; $0 si retirado/rechazado)
      const cotAprobada =
        v.cotizaciones?.find((c) => c.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') ||
        v.cotizaciones?.find((c) => c.estadoAprobacion !== 'RECHAZADA_CLIENTE') ||
        v.cotizaciones?.[0];
      const esRetiradoORechazado =
        v.estado === 'RETIRADO_SIN_REPARAR' || cotAprobada?.estadoAprobacion === 'RECHAZADA_CLIENTE';
      const precioCobradoClienteUsd = esRetiradoORechazado
        ? 0
        : round2(cotAprobada?.montoAcordadoUsd || cotAprobada?.montoOriginalUsd || 0);

      // 2. Costo Mano de Obra: suma de tareas en OT (pago líquido ya ajustado por multas si existen)
      let costoManoObraUsd = 0;
      let multasAplicadasUsd = 0;
      let tareasCompletadasCount = 0;
      for (const t of v.tareasOt || []) {
        const pagoLiquido = Number(t.pagoLiquidoFinalUsd || 0);
        const pagoBase = Number(t.pagoAcordadoUsd || 0);
        const descuento = Number(t.descuentoMultaUsd || 0);
        costoManoObraUsd += pagoLiquido > 0 || t.completada ? pagoLiquido : Math.max(0, pagoBase - descuento);
        multasAplicadasUsd += descuento;
        if (t.completada) tareasCompletadasCount += 1;
      }
      costoManoObraUsd = round2(costoManoObraUsd);
      multasAplicadasUsd = round2(multasAplicadasUsd);

      // 3. Costo Repuestos: suma de repuestos solicitados para este vehículo
      let costoRepuestosUsd = 0;
      for (const r of v.repuestos || []) {
        costoRepuestosUsd += Number(r.costoRepuestoUsd || 0);
      }
      costoRepuestosUsd = round2(costoRepuestosUsd);

      // 4. Insumos de almacén y Pintura de colorista vinculados a este vehículo
      let costoInsumosAlmacenUsd = 0;
      let costoPinturaColoristaUsd = 0;

      const refMatcher = `${v.marca} ${v.modelo}`.toLowerCase();
      const vinMatcher = (v.vinChasis || '').toLowerCase();
      const loteMatcher = (v.placaOLote || '').toLowerCase();

      for (const m of movimientos) {
        const ref = (m.vehiculoReferencia || '').toLowerCase();
        const coincide =
          Boolean(ref) &&
          ((vinMatcher && ref.includes(vinMatcher)) ||
            (loteMatcher && ref.includes(loteMatcher)) ||
            (refMatcher && ref.includes(refMatcher)));
        if (coincide) {
          if (m.tipo === 'SALIDA_POR_TAREA') {
            costoInsumosAlmacenUsd += Number(m.costoTotalUsd || 0);
          } else if (m.tipo === 'COMPRA_PINTURA_COLORISTA') {
            costoPinturaColoristaUsd += Number(m.costoTotalUsd || 0);
          }
        }
      }
      costoInsumosAlmacenUsd = round2(costoInsumosAlmacenUsd);
      costoPinturaColoristaUsd = round2(costoPinturaColoristaUsd);

      // 5. Costo de Grúa / Flete inicial (importadora / naviera)
      const costoGruaNavieraUsd = round2(v.costoGruaImportadoraUsd || 0);

      // Conteo de evidencias Antes y Después coherente con el Informe Final PDF
      const evVehiculo = evidencias.filter((e) => {
        const ref = (e.vehiculoReferencia || '').toLowerCase();
        return (
          e.referenciaId === v.id ||
          (vinMatcher && ref.includes(vinMatcher)) ||
          (loteMatcher && ref.includes(loteMatcher)) ||
          (refMatcher && ref.includes(refMatcher))
        );
      });
      const urlsAntes = new Set(
        evVehiculo
          .filter(
            (e) => e.moduloOrigen === 'CHECKIN_RECEPCION' || e.moduloOrigen === 'DESARME_COTIZACION',
          )
          .map((e) => e.archivoWebpUrl),
      );
      if (Array.isArray(v.checkIn?.fotosIngresoWebp)) {
        for (const f of v.checkIn.fotosIngresoWebp) {
          if (f?.url) urlsAntes.add(f.url);
        }
      }
      const fotosAntesCount = urlsAntes.size;
      const fotosDespuesCount = new Set(
        evVehiculo.filter((e) => e.moduloOrigen === 'ENTREGA_FINAL').map((e) => e.archivoWebpUrl),
      ).size;

      // Totales
      const costoDirectoTotalUsd = round2(
        costoManoObraUsd +
          costoRepuestosUsd +
          costoInsumosAlmacenUsd +
          costoPinturaColoristaUsd +
          costoGruaNavieraUsd,
      );

      const prorrateoGastosFijosUsd =
        v.estado === 'RETIRADO_SIN_REPARAR' ? 0 : prorrateoBaseUsd;

      const costoTotalRealUsd = round2(costoDirectoTotalUsd + prorrateoGastosFijosUsd);
      const utilidadNetaUsd = round2(precioCobradoClienteUsd - costoTotalRealUsd);
      const margenPorcentaje =
        precioCobradoClienteUsd > 0
          ? Math.round((utilidadNetaUsd / precioCobradoClienteUsd) * 1000) / 10
          : 0;

      return {
        vehiculoId: v.id,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        color: v.color,
        vinChasis: v.vinChasis,
        placaOLote: v.placaOLote,
        tipoCliente: v.tipoCliente,
        nombreCliente: v.nombreCliente,
        estado: v.estado,
        fechaIngreso: v.fechaIngreso,
        fechaFinalizado: v.fechaFinalizado,
        // Cobertura operativa / PDF
        totalTareasOt: (v.tareasOt || []).length,
        tareasCompletadasCount,
        totalRepuestos: (v.repuestos || []).length,
        fotosAntesCount,
        fotosDespuesCount,
        // Desglose financiero
        precioCobradoClienteUsd,
        costoManoObraUsd,
        multasAplicadasUsd,
        costoRepuestosUsd,
        costoInsumosAlmacenUsd,
        costoPinturaColoristaUsd,
        costoGruaNavieraUsd,
        costoDirectoTotalUsd,
        prorrateoGastosFijosUsd,
        costoTotalRealUsd,
        utilidadNetaUsd,
        margenPorcentaje,
      };
    });

    const sumaIngresos = reportePorVehiculo.reduce((a, b) => a + b.precioCobradoClienteUsd, 0);
    const sumaCostosDirectos = reportePorVehiculo.reduce((a, b) => a + b.costoDirectoTotalUsd, 0);
    const sumaCostosTotales = reportePorVehiculo.reduce((a, b) => a + b.costoTotalRealUsd, 0);
    const sumaUtilidad = reportePorVehiculo.reduce((a, b) => a + b.utilidadNetaUsd, 0);

    return {
      gastosFijosMensualesTallerUsd: gastosFijosMensuales,
      nominaFijaMensualUsd,
      tasaUsdAClp,
      multaPorDiaRetrasoUsd,
      totalVehiculos: vehiculos.length,
      totalVehiculosProductivos,
      prorrateoPorVehiculoUsd: prorrateoBaseUsd,
      totalesGlobales: {
        ingresosTotalesUsd: round2(sumaIngresos),
        costosDirectosTotalesUsd: round2(sumaCostosDirectos),
        costosTotalesConGastosFijosUsd: round2(sumaCostosTotales),
        utilidadNetaGlobalUsd: round2(sumaUtilidad),
        margenGlobalPorcentaje:
          sumaIngresos > 0 ? Math.round((sumaUtilidad / sumaIngresos) * 1000) / 10 : 0,
      },
      reportePorVehiculo,
    };
  }

  async obtenerDatosInformeFinalPdf(vehiculoId: string, rol?: string) {
    this.validarAccesoBolivia(rol);

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: vehiculoId },
      relations: ['checkIn', 'cotizaciones', 'cotizaciones.items', 'tareasOt', 'repuestos'],
      relationLoadStrategy: 'query',
    });

    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado.');

    const todasLasEvidencias = await this.evidenciasService.findAll(undefined, 500);
    const vinMatcher = (vehiculo.vinChasis || '').toLowerCase();
    const loteMatcher = (vehiculo.placaOLote || '').toLowerCase();
    const marcaMatcher = `${vehiculo.marca} ${vehiculo.modelo}`.toLowerCase();

    const evidenciasVehiculo = todasLasEvidencias.filter((e) => {
      const ref = (e.vehiculoReferencia || '').toLowerCase();
      return (
        e.referenciaId === vehiculo.id ||
        (vinMatcher && ref.includes(vinMatcher)) ||
        (loteMatcher && ref.includes(loteMatcher)) ||
        (marcaMatcher && ref.includes(marcaMatcher))
      );
    });

    // Fotos de Entrada (Antes): Check-In, Desarme y Recepción
    const fotosAntes = evidenciasVehiculo
      .filter((e) => e.moduloOrigen === 'CHECKIN_RECEPCION' || e.moduloOrigen === 'DESARME_COTIZACION')
      .map((e) => ({
        url: e.archivoWebpUrl,
        titulo: e.tituloDetalle,
        descripcion: e.descripcionBreve,
      }));

    if (vehiculo.checkIn?.fotosIngresoWebp && Array.isArray(vehiculo.checkIn.fotosIngresoWebp)) {
      for (const f of vehiculo.checkIn.fotosIngresoWebp) {
        if (!fotosAntes.some((x) => x.url === f.url)) {
          fotosAntes.push({
            url: f.url,
            titulo: f.titulo || 'Ingreso a taller',
            descripcion: f.descripcionBreve || 'Estado inicial del vehículo',
          });
        }
      }
    }

    // Fotos de Salida (Después): fotografías de entrega final del vehículo terminado
    const fotosDespues = evidenciasVehiculo
      .filter((e) => e.moduloOrigen === 'ENTREGA_FINAL')
      .map((e) => ({
        url: e.archivoWebpUrl,
        titulo: e.tituloDetalle,
        descripcion: e.descripcionBreve,
      }));

    // Trabajos ejecutados de cara al cliente (de la cotización aprobada)
    const cotAprobada =
      vehiculo.cotizaciones?.find((c) => c.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') ||
      vehiculo.cotizaciones?.[0];

    const trabajosRealizados = (cotAprobada?.items || []).map((it) => ({
      categoria: it.categoria,
      piezaZona: it.piezaZona,
      gradoDanio: it.gradoDanio,
      esAdendaDesarme: Boolean(it.fotoDesarmeAdendaWebp),
    }));

    // Resumen operativo para el cliente (solo tareas completadas, sin precios internos)
    const tareasCompletadasResumen = [...(vehiculo.tareasOt || [])]
      .sort((a, b) => a.orden - b.orden)
      .map((t) => ({
        orden: t.orden,
        titulo: t.titulo,
        tipo: t.tipo,
        completada: t.completada,
        calificacionEstrellas: t.calificacionEstrellas || null,
      }));

    return {
      taller: {
        nombre: 'CHAPERÍA & PINTURA PROFESIONAL',
        sedeOperativa: 'Arica / Iquique, Chile',
        administracion: 'Santa Cruz / La Paz, Bolivia',
        contacto: 'operaciones@chaperia.com',
      },
      vehiculo: {
        id: vehiculo.id,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        color: vehiculo.color,
        vinChasis: vehiculo.vinChasis,
        placaOLote: vehiculo.placaOLote,
        tipoCliente: vehiculo.tipoCliente,
        nombreCliente: vehiculo.nombreCliente,
        telefonoCliente: vehiculo.telefonoCliente,
        estado: vehiculo.estado,
        fechaIngreso: vehiculo.fechaIngreso,
        fechaFinalizado: vehiculo.fechaFinalizado || new Date().toISOString().split('T')[0],
      },
      checkIn: {
        inventarioAccesorios: {
          llantaAuxilio: vehiculo.checkIn?.tieneLlantaAuxilio ?? true,
          gataYrench: vehiculo.checkIn?.tieneGataYrench ?? true,
          pisosCompletos: vehiculo.checkIn?.tienePisosCompletos ?? true,
          radioOriginal: vehiculo.checkIn?.tieneRadioOriginal ?? true,
          airbagsReventados: vehiculo.checkIn?.airbagsReventados ?? false,
          estadoFaroles: vehiculo.checkIn?.estadoFaroles || 'Normal',
        },
        observaciones:
          vehiculo.checkIn?.observacionesIngreso || 'Vehículo ingresado con inventario verificado.',
      },
      trabajosRealizados,
      tareasCompletadasResumen,
      comparativaFotos: {
        fotosAntes,
        fotosDespues,
      },
      garantia: {
        cobertura:
          'Garantía de 6 meses en acabado de pintura horneada y alineación de chapería estructural.',
        fechaEmision: new Date().toLocaleDateString('es-BO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        certificadoId: `CERT-${(vehiculo.vinChasis || 'CHP').slice(-6).toUpperCase()}-${new Date().getFullYear()}`,
      },
    };
  }
}
