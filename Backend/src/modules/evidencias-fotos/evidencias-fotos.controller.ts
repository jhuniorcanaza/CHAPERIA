import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenciasFotosService } from './evidencias-fotos.service';
import { ModuloEvidencia } from './evidencia-fotografica.entity';
import { CarpetaEvidencia, ImageWebpService } from '../../common/services/image-webp.service';

@Controller('api/evidencias-fotos')
export class EvidenciasFotosController {
  constructor(
    private readonly evidenciasService: EvidenciasFotosService,
    private readonly imageWebpService: ImageWebpService,
  ) {}

  @Get()
  findAll(@Query('modulo') modulo?: ModuloEvidencia) {
    return this.evidenciasService.findAll(modulo);
  }

  @Post('subir')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  subirConDetalleYDescripcion(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Body()
    body: {
      moduloOrigen: ModuloEvidencia;
      referenciaId?: string;
      vehiculoReferencia?: string;
      tituloDetalle: string;
      descripcionBreve: string;
      subidoPor?: string;
      paisOrigen?: 'BOLIVIA' | 'CHILE';
      pesoOriginalClienteKb?: string | number;
    },
  ) {
    const pesoOriginalClienteKb = body.pesoOriginalClienteKb
      ? Number(body.pesoOriginalClienteKb)
      : undefined;
    return this.evidenciasService.subirYRegistrarEvidencia(file, {
      ...body,
      pesoOriginalClienteKb: Number.isFinite(pesoOriginalClienteKb)
        ? pesoOriginalClienteKb
        : undefined,
      subidoPor: req.user?.nombreCompleto || body.subidoPor || 'Usuario Taller',
      paisOrigen: req.user?.pais || body.paisOrigen || 'CHILE',
    });
  }

  @Post('upload/:folder')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadLegacyCompatible(
    @Param('folder') folder: CarpetaEvidencia,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Body()
    body?: {
      tituloDetalle?: string;
      descripcionBreve?: string;
      vehiculoReferencia?: string;
      subidoPor?: string;
      moduloOrigen?: ModuloEvidencia;
    },
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Debes adjuntar un archivo válido.');
    }
    if (body?.tituloDetalle && body?.descripcionBreve) {
      return this.evidenciasService.subirYRegistrarEvidencia(file, {
        moduloOrigen: body.moduloOrigen || 'CHECKIN_RECEPCION',
        vehiculoReferencia: body.vehiculoReferencia || 'Taller Chile',
        tituloDetalle: body.tituloDetalle,
        descripcionBreve: body.descripcionBreve,
        subidoPor: req.user?.nombreCompleto || body.subidoPor || 'Alfredo (Chile)',
        paisOrigen: req.user?.pais || 'CHILE',
        carpeta: folder,
      });
    }
    return this.imageWebpService.compressAndSaveWebp(file.buffer, file.originalname, folder);
  }
}
