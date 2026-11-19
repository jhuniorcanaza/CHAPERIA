import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export type CarpetaEvidencia =
  | 'checkin'
  | 'desarme'
  | 'repuestos'
  | 'facturas'
  | 'herramientas'
  | 'traspasos'
  | 'entrega'
  | 'auditoria';

@Injectable()
export class ImageWebpService {
  private readonly baseUploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

  constructor() {
    const folders: CarpetaEvidencia[] = [
      'checkin',
      'desarme',
      'repuestos',
      'facturas',
      'herramientas',
      'traspasos',
      'entrega',
      'auditoria',
    ];
    for (const folder of folders) {
      const fullPath = path.join(this.baseUploadDir, folder);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  async compressAndSaveWebp(
    buffer: Buffer,
    originalName: string,
    folder: CarpetaEvidencia = 'checkin',
    mimeType?: string,
    pesoOriginalClienteKb?: number,
  ): Promise<{ url: string; pesoOriginalKb: number; pesoWebpKb: number; fileName: string }> {
    const bufferKb = Math.max(1, Math.round(buffer.length / 1024));
    const pesoOriginalKb =
      pesoOriginalClienteKb && pesoOriginalClienteKb > 0
        ? Math.max(pesoOriginalClienteKb, bufferKb)
        : bufferKb;
    const safeBase = path
      .parse(originalName || 'evidencia')
      .name.replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();

    // Si es documento PDF (ej. Orden de Traspaso Naviera), conservar formato PDF
    const esPdf =
      mimeType === 'application/pdf' ||
      (originalName || '').toLowerCase().endsWith('.pdf');
    if (esPdf) {
      const pdfName = `${Date.now()}_${safeBase}.pdf`;
      const pdfPath = path.join(this.baseUploadDir, folder, pdfName);
      await fs.promises.writeFile(pdfPath, buffer);
      return {
        url: `/uploads/${folder}/${pdfName}`,
        pesoOriginalKb: bufferKb,
        pesoWebpKb: bufferKb,
        fileName: pdfName,
      };
    }

    const webpName = `${Date.now()}_${safeBase}.webp`;
    const outputPath = path.join(this.baseUploadDir, folder, webpName);

    // Si el cliente ya pre-comprimió a .webp por debajo de 900 KB, evitar doble recodificación con sharp
    const yaEsWebpOptimizado =
      (mimeType === 'image/webp' || (originalName || '').toLowerCase().endsWith('.webp')) &&
      buffer.length <= 900 * 1024;
    if (yaEsWebpOptimizado) {
      await fs.promises.writeFile(outputPath, buffer);
      return {
        url: `/uploads/${folder}/${webpName}`,
        pesoOriginalKb,
        pesoWebpKb: bufferKb,
        fileName: webpName,
      };
    }

    const maxWidth = parseInt(process.env.WEBP_MAX_WIDTH || '1600', 10);
    const quality = parseInt(process.env.WEBP_QUALITY || '80', 10);

    const info = await sharp(buffer)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toFile(outputPath);

    return {
      url: `/uploads/${folder}/${webpName}`,
      pesoOriginalKb,
      pesoWebpKb: Math.max(1, Math.round(info.size / 1024)),
      fileName: webpName,
    };
  }
}

