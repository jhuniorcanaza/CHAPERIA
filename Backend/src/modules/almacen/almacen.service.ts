import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsumoAlmacen } from './insumo-almacen.entity';
import { MovimientoInsumo } from './movimiento-insumo.entity';
import { EvidenciaFotografica } from '../evidencias-fotos/evidencia-fotografica.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaEdicionesService } from '../auditoria-ediciones/auditoria-ediciones.service';
import {
  CreateInsumoDto,
  RegistrarMovimientoAlmacenDto,
  UpdateInsumoDto,
} from './almacen.dto';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

@Injectable()
export class AlmacenService {
  constructor(
    @InjectRepository(InsumoAlmacen)
    private readonly insumoRepo: Repository<InsumoAlmacen>,
    @InjectRepository(MovimientoInsumo)
    private readonly movRepo: Repository<MovimientoInsumo>,
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    private readonly notificacionesService: NotificacionesService,
    private readonly auditoriaService: AuditoriaEdicionesService,
  ) {}

  listarInsumos() {
    return this.insumoRepo.find({ order: { nombre: 'ASC' } });
  }

  listarMovimientos() {
    return this.movRepo.find({ order: { fecha: 'DESC' }, take: 200 });
  }

  private async vincularEvidenciaFactura(
    url: string | null | undefined,
    movimiento: MovimientoInsumo,
  ) {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl) return;
    const ev = await this.evidenciaRepo.findOne({ where: { archivoWebpUrl: cleanUrl } });
    if (!ev) return;
    ev.referenciaId = movimiento.id;
    if (movimiento.vehiculoReferencia) {
      ev.vehiculoReferencia = movimiento.vehiculoReferencia;
    }
    await this.evidenciaRepo.save(ev);
  }

  async crearInsumo(dto: CreateInsumoDto, usuarioActor?: string): Promise<InsumoAlmacen> {
    const nombre = (dto.nombre || '').trim();
    if (nombre.length < 3) throw new BadRequestException('Indica el nombre del insumo.');
    if (!dto.unidadMedida || !dto.unidadMedida.trim()) {
      throw new BadRequestException('Indica la unidad de medida del insumo.');
    }

    const existente = await this.insumoRepo
      .createQueryBuilder('i')
      .where('LOWER(i.nombre) = LOWER(:nombre)', { nombre })
      .getOne();
    if (existente) throw new BadRequestException('Ya existe un insumo con ese nombre.');

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    const insumo = this.insumoRepo.create({
      nombre,
      unidadMedida: dto.unidadMedida.trim().toUpperCase(),
      stockActual: round2(dto.stockActual || 0),
      stockMinimoAlerta: round2(dto.stockMinimoAlerta ?? 5),
      costoUnitarioUsd: round2(dto.costoUnitarioUsd || 0),
    });
    const saved = await this.insumoRepo.save(insumo);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ALMACEN_INSUMOS',
      entidadReferencia: saved.nombre,
      tipoAccion: 'ALTA_DE_INSUMO',
      valorAnterior: 'Insumo inexistente',
      valorNuevo: `Stock inicial ${saved.stockActual} ${saved.unidadMedida}, mínimo ${saved.stockMinimoAlerta}, costo unit. USD ${saved.costoUnitarioUsd}`,
      motivoEdicion: 'Alta de nuevo insumo en el catálogo del almacén.',
      editadoPor: actor,
      aprobadoPor: 'Registro de Almacén',
    });

    if (Number(saved.stockActual) <= Number(saved.stockMinimoAlerta)) {
      await this.notificacionesService.crearYEmitir(
        'STOCK_BAJO',
        `Stock inicial bajo: ${saved.nombre}`,
        `Registrado con ${saved.stockActual} ${saved.unidadMedida} (mínimo ${saved.stockMinimoAlerta}).`,
        'TODOS',
        {
          moduloDestino: 'almacen',
          referenciaId: saved.id,
          subTabDestino: 'catalogo',
        },
      );
    }

    return saved;
  }

  async editarInsumo(
    id: string,
    dto: UpdateInsumoDto,
    usuarioActor?: string,
  ): Promise<InsumoAlmacen> {
    const insumo = await this.insumoRepo.findOne({ where: { id } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado.');

    const motivo = (dto.motivoEdicion || '').trim();
    if (motivo.length < 4) {
      throw new BadRequestException('Debes ingresar el motivo de edición (mín. 4 caracteres).');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';
    const anteriores: string[] = [];
    const nuevos: string[] = [];

    if (dto.nombre !== undefined) {
      const nuevoNombre = dto.nombre.trim();
      if (nuevoNombre.length < 3) {
        throw new BadRequestException('El nombre del insumo debe tener al menos 3 caracteres.');
      }
      if (nuevoNombre.toLowerCase() !== insumo.nombre.toLowerCase()) {
        const dup = await this.insumoRepo
          .createQueryBuilder('i')
          .where('LOWER(i.nombre) = LOWER(:nombre) AND i.id != :id', { nombre: nuevoNombre, id })
          .getOne();
        if (dup) throw new BadRequestException('Ya existe otro insumo con ese nombre.');
        anteriores.push(`Nombre: ${insumo.nombre}`);
        nuevos.push(`Nombre: ${nuevoNombre}`);
        insumo.nombre = nuevoNombre;
      }
    }

    if (dto.unidadMedida !== undefined) {
      const nuevaUnidad = dto.unidadMedida.trim().toUpperCase();
      if (!nuevaUnidad) throw new BadRequestException('La unidad de medida no puede quedar vacía.');
      if (nuevaUnidad !== insumo.unidadMedida.toUpperCase()) {
        anteriores.push(`Unidad: ${insumo.unidadMedida}`);
        nuevos.push(`Unidad: ${nuevaUnidad}`);
        insumo.unidadMedida = nuevaUnidad;
      }
    }

    const stockPrevio = Number(insumo.stockActual || 0);
    if (dto.stockActual !== undefined && round2(dto.stockActual) !== round2(stockPrevio)) {
      const nuevoStock = round2(dto.stockActual);
      anteriores.push(`Stock físico: ${stockPrevio}`);
      nuevos.push(`Stock físico: ${nuevoStock}`);
      insumo.stockActual = nuevoStock;
    }

    if (
      dto.stockMinimoAlerta !== undefined &&
      round2(dto.stockMinimoAlerta) !== round2(insumo.stockMinimoAlerta)
    ) {
      anteriores.push(`Mín. alerta: ${Number(insumo.stockMinimoAlerta)}`);
      nuevos.push(`Mín. alerta: ${round2(dto.stockMinimoAlerta)}`);
      insumo.stockMinimoAlerta = round2(dto.stockMinimoAlerta);
    }

    if (
      dto.costoUnitarioUsd !== undefined &&
      round2(dto.costoUnitarioUsd) !== round2(insumo.costoUnitarioUsd)
    ) {
      anteriores.push(`Costo unit.: USD ${Number(insumo.costoUnitarioUsd)}`);
      nuevos.push(`Costo unit.: USD ${round2(dto.costoUnitarioUsd)}`);
      insumo.costoUnitarioUsd = round2(dto.costoUnitarioUsd);
    }

    if (anteriores.length === 0) {
      throw new BadRequestException('No se detectaron cambios en los datos del insumo.');
    }

    const saved = await this.insumoRepo.save(insumo);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ALMACEN_INSUMOS',
      entidadReferencia: saved.nombre,
      tipoAccion: 'EDICION_DE_INSUMO',
      valorAnterior: anteriores.join(' | '),
      valorNuevo: nuevos.join(' | '),
      motivoEdicion: motivo,
      editadoPor: actor,
      aprobadoPor: 'Control de Almacén',
    });

    if (Number(saved.stockActual) <= Number(saved.stockMinimoAlerta)) {
      await this.notificacionesService.crearYEmitir(
        'STOCK_BAJO',
        `Stock bajo tras ajuste: ${saved.nombre}`,
        `Quedan ${saved.stockActual} ${saved.unidadMedida} (mínimo ${saved.stockMinimoAlerta}).`,
        'TODOS',
        {
          moduloDestino: 'almacen',
          referenciaId: saved.id,
          subTabDestino: 'catalogo',
        },
      );
    }

    return saved;
  }

  async registrarMovimiento(
    dto: RegistrarMovimientoAlmacenDto,
    usuarioActor?: string,
  ): Promise<MovimientoInsumo> {
    const cantidad = round2(dto.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a cero.');
    }

    const actor = (dto.usuarioNombre || '').trim() || usuarioActor || 'Encargado Taller';

    const mov = new MovimientoInsumo();
    mov.tipo = dto.tipo;
    mov.cantidad = cantidad;
    mov.vehiculoReferencia = dto.vehiculoReferencia?.trim() || null;
    mov.tareaReferencia = dto.tareaReferencia?.trim() || null;
    mov.fotoFacturaWebp = dto.fotoFacturaUrl?.trim() || null;
    mov.descripcionFotoFactura = dto.descripcionFotoFactura?.trim() || null;

    // Pintura directa del colorista: no pasa por el stock del almacén
    if (dto.tipo === 'COMPRA_PINTURA_COLORISTA') {
      if (!dto.insumoNombre || dto.insumoNombre.trim().length < 3) {
        throw new BadRequestException('Describe la pintura comprada (color y tipo).');
      }
      if (!mov.vehiculoReferencia) {
        throw new BadRequestException('La pintura del colorista debe asociarse a un vehículo.');
      }
      if (!mov.fotoFacturaWebp || !mov.descripcionFotoFactura || mov.descripcionFotoFactura.length < 5) {
        throw new BadRequestException(
          'La compra al colorista exige foto de la factura con su descripción breve.',
        );
      }
      if (!dto.costoTotalUsd || Number(dto.costoTotalUsd) <= 0) {
        throw new BadRequestException('Indica el costo total de la pintura.');
      }
      mov.insumoNombre = dto.insumoNombre.trim();
      mov.unidad = dto.unidad?.trim().toUpperCase() || 'ML';
      mov.costoTotalUsd = round2(dto.costoTotalUsd);
      const saved = await this.movRepo.save(mov);

      await this.vincularEvidenciaFactura(saved.fotoFacturaWebp, saved);

      await this.auditoriaService.registrarEdicionInmutable({
        modulo: 'ALMACEN_INSUMOS',
        entidadReferencia: `${saved.vehiculoReferencia} - ${saved.insumoNombre}`,
        tipoAccion: 'COMPRA_PINTURA_COLORISTA',
        valorAnterior: 'Compra externa directa',
        valorNuevo: `${saved.cantidad} ${saved.unidad} • USD ${saved.costoTotalUsd}`,
        motivoEdicion: saved.descripcionFotoFactura || 'Compra directa a colorista con factura respaldada.',
        editadoPor: actor,
        aprobadoPor: 'Respaldo de Boleta Adjunta',
        evidenciaFotoUrl: saved.fotoFacturaWebp,
        evidenciaDescripcion: saved.descripcionFotoFactura,
      });

      await this.notificacionesService.crearYEmitir(
        'COMPRA_INSUMO',
        'Pintura del colorista registrada',
        `${saved.insumoNombre} (${saved.cantidad} ${saved.unidad}) para ${saved.vehiculoReferencia}. Costo USD ${saved.costoTotalUsd}.`,
        'TODOS',
        {
          moduloDestino: 'almacen',
          vehiculoId: dto.vehiculoId || null,
          referenciaId: saved.id,
          subTabDestino: 'movimientos',
        },
      );
      return saved;
    }

    // Entradas y salidas del stock regular del almacén
    if (!dto.insumoId) throw new BadRequestException('Selecciona el insumo del almacén.');
    const insumo = await this.insumoRepo.findOne({ where: { id: dto.insumoId } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado.');

    mov.insumoNombre = insumo.nombre;
    mov.unidad = insumo.unidadMedida;
    const stockAntes = round2(Number(insumo.stockActual || 0));

    if (dto.tipo === 'ENTRADA_STOCK') {
      const costoTotal = round2(dto.costoTotalUsd || 0);
      insumo.stockActual = round2(stockAntes + cantidad);
      if (costoTotal > 0) {
        insumo.costoUnitarioUsd = round2(costoTotal / cantidad);
      }
      mov.costoTotalUsd = costoTotal;
    } else if (dto.tipo === 'SALIDA_POR_TAREA') {
      if (!mov.vehiculoReferencia || !mov.tareaReferencia) {
        throw new BadRequestException('Toda salida de almacén debe indicar el vehículo y la tarea que la consume.');
      }
      if (cantidad > stockAntes) {
        throw new BadRequestException(
          `Stock insuficiente de ${insumo.nombre}: disponible ${stockAntes} ${insumo.unidadMedida}.`,
        );
      }
      insumo.stockActual = round2(stockAntes - cantidad);
      mov.costoTotalUsd = round2(cantidad * Number(insumo.costoUnitarioUsd || 0));
    } else {
      throw new BadRequestException('Tipo de movimiento no válido.');
    }

    await this.insumoRepo.save(insumo);
    const saved = await this.movRepo.save(mov);

    await this.auditoriaService.registrarEdicionInmutable({
      modulo: 'ALMACEN_INSUMOS',
      entidadReferencia: insumo.nombre,
      tipoAccion: dto.tipo === 'ENTRADA_STOCK' ? 'ENTRADA_DE_STOCK' : 'SALIDA_POR_TAREA',
      valorAnterior: `Stock previo ${stockAntes} ${insumo.unidadMedida}`,
      valorNuevo: `Stock ${insumo.stockActual} ${insumo.unidadMedida} (${dto.tipo === 'ENTRADA_STOCK' ? '+' : '-'}${saved.cantidad} • USD ${saved.costoTotalUsd})`,
      motivoEdicion:
        dto.tipo === 'ENTRADA_STOCK'
          ? `Reposición registrada${saved.tareaReferencia ? `: ${saved.tareaReferencia}` : ''}.`
          : `Consumo asignado a ${saved.vehiculoReferencia} (${saved.tareaReferencia}).`,
      editadoPor: actor,
      aprobadoPor: 'Kardex de Almacén',
    });

    if (Number(insumo.stockActual) <= Number(insumo.stockMinimoAlerta)) {
      await this.notificacionesService.crearYEmitir(
        'STOCK_BAJO',
        `Stock bajo: ${insumo.nombre}`,
        `Quedan ${insumo.stockActual} ${insumo.unidadMedida} (mínimo ${insumo.stockMinimoAlerta}). Gestionar reposición.`,
        'TODOS',
        {
          moduloDestino: 'almacen',
          vehiculoId: dto.vehiculoId || null,
          referenciaId: insumo.id,
          subTabDestino: 'catalogo',
        },
      );
    } else {
      await this.notificacionesService.crearYEmitir(
        'COMPRA_INSUMO',
        dto.tipo === 'ENTRADA_STOCK' ? `Entrada de almacén: ${insumo.nombre}` : `Salida de almacén: ${insumo.nombre}`,
        `${saved.cantidad} ${saved.unidad}${saved.vehiculoReferencia ? ` para ${saved.vehiculoReferencia}` : ''}. Stock actual: ${insumo.stockActual}.`,
        'TODOS',
        {
          moduloDestino: 'almacen',
          vehiculoId: dto.vehiculoId || null,
          referenciaId: saved.id,
          subTabDestino: 'movimientos',
        },
      );
    }
    return saved;
  }
}
