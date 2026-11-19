import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvidenciaFotografica, ModuloEvidencia } from './evidencia-fotografica.entity';
import { CarpetaEvidencia, ImageWebpService } from '../../common/services/image-webp.service';
import { RealtimeService } from '../../common/services/realtime.service';
import { RecepcionCheckIn } from '../vehiculos/recepcion-checkin.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';

export interface SubirEvidenciaInput {
  moduloOrigen: ModuloEvidencia;
  referenciaId?: string;
  vehiculoReferencia?: string;
  tituloDetalle: string;
  descripcionBreve: string;
  subidoPor: string;
  paisOrigen?: 'BOLIVIA' | 'CHILE';
  carpeta?: CarpetaEvidencia;
  pesoOriginalClienteKb?: number;
}

@Injectable()
export class EvidenciasFotosService {
  constructor(
    @InjectRepository(EvidenciaFotografica)
    private readonly evidenciaRepo: Repository<EvidenciaFotografica>,
    @InjectRepository(RecepcionCheckIn)
    private readonly checkinRepo: Repository<RecepcionCheckIn>,
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
    private readonly imageWebpService: ImageWebpService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async findAll(moduloOrigen?: ModuloEvidencia, limit = 80) {
    if (moduloOrigen) {
      return this.evidenciaRepo.find({
        where: { moduloOrigen },
        order: { creadoEn: 'DESC' },
        take: limit,
      });
    }
    return this.evidenciaRepo.find({
      order: { creadoEn: 'DESC' },
      take: limit,
    });
  }

  async subirYRegistrarEvidencia(
    file: Express.Multer.File,
    input: SubirEvidenciaInput,
  ): Promise<EvidenciaFotografica> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Debes adjuntar una fotografía o archivo de respaldo.');
    }

    const titulo = (input.tituloDetalle || '').trim();
    const descripcion = (input.descripcionBreve || '').trim();

    if (!titulo || titulo.length < 3) {
      throw new BadRequestException(
        'REGLA DE AUDITORÍA: Toda fotografía debe incluir obligatoriamente un "Título / Detalle" (mínimo 3 caracteres).',
      );
    }

    if (!descripcion || descripcion.length < 5) {
      throw new BadRequestException(
        'REGLA DE AUDITORÍA: Toda fotografía debe incluir obligatoriamente una "Descripción Breve" explicando el detalle de la imagen.',
      );
    }

    const carpetaMapa: Record<ModuloEvidencia, CarpetaEvidencia> = {
      CHECKIN_RECEPCION: 'checkin',
      DESARME_COTIZACION: 'desarme',
      REPUESTOS_CUENTAGOTAS: 'repuestos',
      FACTURA_INSUMO_COLORISTA: 'facturas',
      BAJA_HERRAMIENTA: 'herramientas',
      TRASPASO_NAVIERA: 'traspasos',
      ENTREGA_FINAL: 'entrega',
    };

    const folder = input.carpeta || carpetaMapa[input.moduloOrigen] || 'checkin';

    const compressed = await this.imageWebpService.compressAndSaveWebp(
      file.buffer,
      file.originalname,
      folder,
      file.mimetype,
      input.pesoOriginalClienteKb,
    );

    const nuevaEvidencia = this.evidenciaRepo.create({
      moduloOrigen: input.moduloOrigen || 'CHECKIN_RECEPCION',
      referenciaId: input.referenciaId || null,
      vehiculoReferencia: input.vehiculoReferencia || 'General Taller',
      tituloDetalle: titulo,
      descripcionBreve: descripcion,
      archivoWebpUrl: compressed.url,
      nombreArchivo: compressed.fileName,
      pesoOriginalKb: compressed.pesoOriginalKb,
      pesoWebpKb: compressed.pesoWebpKb,
      subidoPor: input.subidoPor || 'Alfredo (Chile)',
      paisOrigen: input.paisOrigen || 'CHILE',
    });

    const saved = await this.evidenciaRepo.save(nuevaEvidencia);

    await this.sincronizarFotoConCheckInVehiculo(saved);

    this.realtimeService.emitEvent({
      tipo: 'EVIDENCIA_FOTOGRAFICA',
      titulo: `Nueva Fotografía: ${saved.tituloDetalle}`,
      mensaje: `${saved.descripcionBreve} (${saved.vehiculoReferencia}) — Subido por ${saved.subidoPor}`,
      destinoRol: 'TODOS',
      moduloDestino: 'dashboard',
      referenciaId: saved.id,
      data: saved,
    });

    return saved;
  }

  private async sincronizarFotoConCheckInVehiculo(
    evidencia: EvidenciaFotografica,
  ): Promise<void> {
    if (
      evidencia.moduloOrigen !== 'CHECKIN_RECEPCION' ||
      !evidencia.referenciaId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        evidencia.referenciaId,
      )
    ) {
      return;
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { id: evidencia.referenciaId },
      relations: ['checkIn'],
    });
    if (!vehiculo) {
      return;
    }

    const detalleFoto = {
      titulo: evidencia.tituloDetalle,
      descripcionBreve: evidencia.descripcionBreve,
      url: evidencia.archivoWebpUrl,
      pesoKb: evidencia.pesoWebpKb,
    };

    if (vehiculo.checkIn) {
      const actuales = Array.isArray(vehiculo.checkIn.fotosIngresoWebp)
        ? vehiculo.checkIn.fotosIngresoWebp
        : [];
      if (!actuales.some((item) => item.url === evidencia.archivoWebpUrl)) {
        vehiculo.checkIn.fotosIngresoWebp = [...actuales, detalleFoto];
        await this.checkinRepo.save(vehiculo.checkIn);
      }
      return;
    }

    const nuevoCheckIn = this.checkinRepo.create({
      vehiculo,
      estadoFaroles: 'Por verificar en ingreso',
      observacionesIngreso: evidencia.descripcionBreve,
      fotosIngresoWebp: [detalleFoto],
    });
    await this.checkinRepo.save(nuevoCheckIn);
  }
}
