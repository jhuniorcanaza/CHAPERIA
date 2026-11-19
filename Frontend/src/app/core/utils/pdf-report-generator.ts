export interface FotoComparativaPdf {
  url: string;
  titulo: string;
  descripcion?: string;
}

export interface InformeFinalPdfInput {
  taller: {
    nombre: string;
    sedeOperativa: string;
    administracion: string;
    contacto: string;
  };
  vehiculo: {
    marca: string;
    modelo: string;
    anio?: number;
    color: string;
    vinChasis: string;
    placaOLote: string;
    nombreCliente: string;
    telefonoCliente?: string;
    estado: string;
    fechaIngreso?: string;
    fechaFinalizado?: string;
  };
  checkIn?: {
    inventarioAccesorios?: {
      llantaAuxilio?: boolean;
      gataYrench?: boolean;
      pisosCompletos?: boolean;
      radioOriginal?: boolean;
      airbagsReventados?: boolean;
      estadoFaroles?: string;
    };
    observaciones?: string;
  };
  trabajosRealizados?: Array<{
    categoria: string;
    piezaZona: string;
    gradoDanio?: string;
    esAdendaDesarme?: boolean;
  }>;
  tareasCompletadasResumen?: Array<{
    orden: number;
    titulo: string;
    tipo: string;
    completada: boolean;
  }>;
  comparativaFotos?: {
    fotosAntes?: FotoComparativaPdf[];
    fotosDespues?: FotoComparativaPdf[];
  };
  garantia?: {
    cobertura: string;
    fechaEmision: string;
    certificadoId: string;
  };
}

interface PdfImageData {
  name: string;
  width: number;
  height: number;
  bytes: Uint8Array;
}

const WINANSI_MAP: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0x7f;
  }
  return out;
}

function encodeWinAnsi(str: string): Uint8Array {
  const clean = (str || '').replace(/[\r\n]+/g, ' ');
  const out = new Uint8Array(clean.length);
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code <= 0xff && (code < 0x80 || code >= 0xa0)) {
      out[i] = code;
    } else if (WINANSI_MAP[code] !== undefined) {
      out[i] = WINANSI_MAP[code];
    } else {
      out[i] = 0x3f;
    }
  }
  return out;
}

function escapePdfLiteral(bytes: Uint8Array): Uint8Array {
  const res: number[] = [40]; // '('
  for (const b of bytes) {
    if (b === 40 || b === 41 || b === 92) {
      res.push(92, b);
    } else {
      res.push(b);
    }
  }
  res.push(41); // ')'
  return new Uint8Array(res);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current = `${current} ${w}`;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadImageAsJpeg(url: string, name: string): Promise<PdfImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 6500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const maxW = 720;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const buf = await blob.arrayBuffer();
            resolve({
              name,
              width: w,
              height: h,
              bytes: new Uint8Array(buf),
            });
          },
          'image/jpeg',
          0.84,
        );
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

class PdfPageCanvas {
  readonly commands: Uint8Array[] = [];
  readonly images = new Map<string, PdfImageData>();

  addCmd(cmd: string) {
    this.commands.push(encodeAscii(`${cmd}\n`));
  }

  fillRect(x: number, yBottom: number, w: number, h: number, r: number, g: number, b: number) {
    this.addCmd(
      `q ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(1)} ${yBottom.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f Q`,
    );
  }

  strokeRect(
    x: number,
    yBottom: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    lineWidth = 0.8,
  ) {
    this.addCmd(
      `q ${lineWidth.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x.toFixed(1)} ${yBottom.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S Q`,
    );
  }

  drawText(
    text: string,
    x: number,
    yBaseline: number,
    size: number,
    bold = false,
    r = 0.08,
    g = 0.1,
    b = 0.16,
  ) {
    const fontRef = bold ? '/F2' : '/F1';
    const literal = escapePdfLiteral(encodeWinAnsi(text));
    this.commands.push(
      concatBytes([
        encodeAscii(
          `q BT ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${fontRef} ${size.toFixed(1)} Tf 1 0 0 1 ${x.toFixed(1)} ${yBaseline.toFixed(1)} Tm `,
        ),
        literal,
        encodeAscii(' Tj ET Q\n'),
      ]),
    );
  }

  drawImageContain(
    img: PdfImageData,
    boxX: number,
    boxBottom: number,
    boxW: number,
    boxH: number,
  ) {
    this.images.set(img.name, img);
    const ratioImg = img.width / Math.max(1, img.height);
    const ratioBox = boxW / Math.max(1, boxH);
    let drawW = boxW;
    let drawH = boxH;
    if (ratioImg > ratioBox) {
      drawH = boxW / ratioImg;
    } else {
      drawW = boxH * ratioImg;
    }
    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxBottom + (boxH - drawH) / 2;
    this.addCmd(
      `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /${img.name} Do Q`,
    );
  }

  buildStream(): Uint8Array {
    return concatBytes(this.commands);
  }
}

export async function generarYDescargarInformePdf(
  data: InformeFinalPdfInput,
  resolveMediaUrl: (raw: string) => string,
): Promise<{ ok: boolean; filename: string; fotosIncluidas: number }> {
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const fotosAntesRaw = (data.comparativaFotos?.fotosAntes || []).slice(0, 4);
  const fotosDespuesRaw = (data.comparativaFotos?.fotosDespues || []).slice(0, 4);

  const [antesLoaded, despuesLoaded] = await Promise.all([
    Promise.all(
      fotosAntesRaw.map((f, idx) => loadImageAsJpeg(resolveMediaUrl(f.url), `ImA${idx + 1}`)),
    ),
    Promise.all(
      fotosDespuesRaw.map((f, idx) => loadImageAsJpeg(resolveMediaUrl(f.url), `ImD${idx + 1}`)),
    ),
  ]);

  let fotosIncluidas = 0;
  antesLoaded.forEach((im) => {
    if (im) fotosIncluidas += 1;
  });
  despuesLoaded.forEach((im) => {
    if (im) fotosIncluidas += 1;
  });

  const pages: PdfPageCanvas[] = [];
  const startPage = () => {
    const p = new PdfPageCanvas();
    pages.push(p);
    return p;
  };

  // --- PÁGINA 1: FICHA, CHECK-IN Y TRABAJOS EJECUTADOS ---
  const p1 = startPage();
  let y = PAGE_H - MARGIN;

  // Banda superior corporativa
  p1.fillRect(MARGIN, y - 62, CONTENT_W, 62, 0.12, 0.16, 0.38);
  p1.drawText(data.taller.nombre || 'CHAPERIA & PINTURA PROFESIONAL', MARGIN + 14, y - 22, 13, true, 1, 1, 1);
  p1.drawText(
    `Sede: ${data.taller.sedeOperativa}  |  Adm.: ${data.taller.administracion}`,
    MARGIN + 14,
    y - 37,
    8.5,
    false,
    0.82,
    0.87,
    0.98,
  );
  p1.drawText(
    `INFORME FINAL DE ENTREGA AL CLIENTE  •  ${data.garantia?.certificadoId || 'CERT-CHP'}`,
    MARGIN + 14,
    y - 51,
    8.5,
    true,
    0.58,
    0.85,
    0.98,
  );
  y -= 76;

  // Ficha del Vehículo y Propietario
  p1.fillRect(MARGIN, y - 82, CONTENT_W, 82, 0.96, 0.97, 0.99);
  p1.strokeRect(MARGIN, y - 82, CONTENT_W, 82, 0.82, 0.85, 0.91);
  p1.drawText('DATOS DE LA UNIDAD Y CLIENTE', MARGIN + 12, y - 16, 9, true, 0.16, 0.24, 0.52);

  const vehTitulo = `${data.vehiculo.marca} ${data.vehiculo.modelo}${data.vehiculo.anio ? ` (${data.vehiculo.anio})` : ''}`;
  p1.drawText(`Vehiculo: ${vehTitulo}`, MARGIN + 12, y - 33, 9.5, true);
  p1.drawText(`Color / Acabado: ${data.vehiculo.color}`, MARGIN + 290, y - 33, 9.5, false);

  p1.drawText(`VIN / Chasis: ${data.vehiculo.vinChasis}`, MARGIN + 12, y - 49, 9, false);
  p1.drawText(`Lote / Placa: ${data.vehiculo.placaOLote}`, MARGIN + 290, y - 49, 9, false);

  p1.drawText(`Cliente: ${data.vehiculo.nombreCliente}`, MARGIN + 12, y - 65, 9, true);
  p1.drawText(
    `Entrega: ${data.vehiculo.fechaFinalizado || '-'}  |  Estado: ${data.vehiculo.estado}`,
    MARGIN + 290,
    y - 65,
    9,
    false,
  );
  y -= 98;

  // Inventario Check-In de Ingreso
  const inv = data.checkIn?.inventarioAccesorios;
  p1.drawText('VERIFICACION DE INVENTARIO AL INGRESO (CHECK-IN)', MARGIN, y - 10, 9.5, true, 0.12, 0.16, 0.38);
  y -= 16;
  p1.fillRect(MARGIN, y - 48, CONTENT_W, 48, 0.98, 0.98, 0.99);
  p1.strokeRect(MARGIN, y - 48, CONTENT_W, 48, 0.85, 0.88, 0.92);
  const invLinea1 = `Llanta auxilio: ${inv?.llantaAuxilio ? 'SI' : 'NO'}   |   Gata y llave: ${inv?.gataYrench ? 'SI' : 'NO'}   |   Pisos completos: ${inv?.pisosCompletos ? 'SI' : 'NO'}   |   Radio orig.: ${inv?.radioOriginal ? 'SI' : 'NO'}`;
  const invLinea2 = `Airbags reventados: ${inv?.airbagsReventados ? 'SI' : 'NO'}   |   Estado faroles: ${inv?.estadoFaroles || 'Normal'}`;
  p1.drawText(invLinea1, MARGIN + 10, y - 18, 8.2, false);
  p1.drawText(invLinea2, MARGIN + 10, y - 34, 8.2, false);
  y -= 64;

  // Trabajos Realizados (Cotización Aprobada + Operaciones OT)
  p1.drawText('TRABAJOS DE CHAPERIA, PINTURA Y RESTAURACION EJECUTADOS', MARGIN, y - 10, 9.5, true, 0.12, 0.16, 0.38);
  y -= 22;

  const itemsLista: Array<{ label: string; tag: string }> = [];
  for (const it of data.trabajosRealizados || []) {
    itemsLista.push({
      label: `${it.piezaZona}${it.gradoDanio ? ` (${it.gradoDanio})` : ''}`,
      tag: it.esAdendaDesarme ? `${it.categoria} • ADENDA` : it.categoria,
    });
  }
  for (const t of data.tareasCompletadasResumen || []) {
    itemsLista.push({
      label: `OT #${t.orden}: ${t.titulo}`,
      tag: t.completada ? `${t.tipo} • OK` : t.tipo,
    });
  }
  if (itemsLista.length === 0) {
    itemsLista.push({
      label: 'Reparacion integral de carroceria, enderezado y pintura bicapa en horno',
      tag: 'COMPLETADO',
    });
  }

  let pageActual = p1;
  for (const row of itemsLista) {
    const wrapped = wrapText(row.label, 68);
    const rowH = Math.max(20, wrapped.length * 11 + 8);
    if (y - rowH < 130) {
      pageActual = startPage();
      y = PAGE_H - MARGIN;
      pageActual.drawText('CONTINUACION DE TRABAJOS EJECUTADOS', MARGIN, y - 12, 9.5, true, 0.12, 0.16, 0.38);
      y -= 24;
    }

    pageActual.fillRect(MARGIN, y - rowH, CONTENT_W, rowH, 0.97, 0.98, 0.99);
    pageActual.strokeRect(MARGIN, y - rowH, CONTENT_W, rowH, 0.88, 0.9, 0.94, 0.5);
    wrapped.forEach((line, idx) => {
      pageActual.drawText(line, MARGIN + 10, y - 13 - idx * 11, 8.5, idx === 0);
    });
    pageActual.drawText(row.tag, PAGE_W - MARGIN - 120, y - 13, 7.5, true, 0.22, 0.32, 0.65);
    y -= rowH + 4;
  }

  // --- PÁGINA NUEVA PARA COMPARATIVA ANTES VS DESPUÉS Y GARANTÍA ---
  const pFotos = startPage();
  let fy = PAGE_H - MARGIN;

  pFotos.fillRect(MARGIN, fy - 34, CONTENT_W, 34, 0.12, 0.16, 0.38);
  pFotos.drawText(
    `CONSTANCIA FOTOGRAFICA: ANTES VS. DESPUES  •  ${vehTitulo}`,
    MARGIN + 12,
    fy - 21,
    10.5,
    true,
    1,
    1,
    1,
  );
  fy -= 48;

  const colGap = 14;
  const colW = (CONTENT_W - colGap) / 2;

  const drawPhotoColumn = (
    title: string,
    headerRgb: [number, number, number],
    colX: number,
    rawList: FotoComparativaPdf[],
    loadedList: Array<PdfImageData | null>,
  ) => {
    let cy = fy;
    pFotos.fillRect(colX, cy - 22, colW, 22, headerRgb[0], headerRgb[1], headerRgb[2]);
    pFotos.drawText(title, colX + 8, cy - 15, 8.5, true, 1, 1, 1);
    cy -= 30;

    if (rawList.length === 0) {
      pFotos.fillRect(colX, cy - 90, colW, 90, 0.97, 0.97, 0.98);
      pFotos.strokeRect(colX, cy - 90, colW, 90, 0.85, 0.85, 0.88);
      pFotos.drawText('Sin fotografias registradas en esta etapa.', colX + 20, cy - 48, 8.5, false, 0.45, 0.48, 0.55);
      return;
    }

    for (let i = 0; i < rawList.length; i++) {
      const f = rawList[i];
      const img = loadedList[i];
      const cardH = 122;
      const imgH = 92;

      pFotos.fillRect(colX, cy - cardH, colW, cardH, 0.98, 0.98, 0.99);
      pFotos.strokeRect(colX, cy - cardH, colW, cardH, 0.82, 0.85, 0.9);

      if (img) {
        pFotos.drawImageContain(img, colX + 4, cy - imgH - 4, colW - 8, imgH);
      } else {
        pFotos.fillRect(colX + 6, cy - imgH - 4, colW - 12, imgH, 0.94, 0.95, 0.97);
        pFotos.drawText('Imagen adjunta en expediente', colX + 42, cy - 52, 8, false, 0.45, 0.48, 0.55);
      }

      const capTitle = wrapText(f.titulo || 'Evidencia fotografica', 42)[0] || '';
      pFotos.drawText(capTitle, colX + 6, cy - imgH - 17, 7.8, true);
      cy -= cardH + 8;
    }
  };

  drawPhotoColumn(
    'ESTADO INICIAL AL INGRESO (ANTES)',
    [0.72, 0.14, 0.24],
    MARGIN,
    fotosAntesRaw,
    antesLoaded,
  );
  drawPhotoColumn(
    'VEHICULO TERMINADO Y PULIDO (DESPUES)',
    [0.06, 0.52, 0.34],
    MARGIN + colW + colGap,
    fotosDespuesRaw,
    despuesLoaded,
  );

  // Bloque inferior de Garantía y Sello
  const gy = 108;
  pFotos.fillRect(MARGIN, gy - 68, CONTENT_W, 68, 0.94, 0.96, 1.0);
  pFotos.strokeRect(MARGIN, gy - 68, CONTENT_W, 68, 0.35, 0.42, 0.82, 1.0);
  pFotos.drawText('CERTIFICADO DE CALIDAD Y GARANTIA DE TALLER', MARGIN + 12, gy - 16, 9, true, 0.14, 0.2, 0.55);
  const garLines = wrapText(
    data.garantia?.cobertura || 'Garantia de 6 meses en pintura horneada y alineacion estructural.',
    72,
  );
  garLines.slice(0, 2).forEach((ln, idx) => {
    pFotos.drawText(ln, MARGIN + 12, gy - 31 - idx * 11, 8, false);
  });
  pFotos.drawText(
    `Emitido el ${data.garantia?.fechaEmision || new Date().toLocaleDateString('es-BO')}  •  Certificado: ${data.garantia?.certificadoId || 'CHP'}`,
    MARGIN + 12,
    gy - 56,
    7.8,
    true,
    0.25,
    0.3,
    0.45,
  );
  pFotos.drawText('__________________________', PAGE_W - MARGIN - 135, gy - 44, 8, false, 0.3, 0.35, 0.45);
  pFotos.drawText('Control de Calidad', PAGE_W - MARGIN - 115, gy - 56, 7.5, true, 0.2, 0.25, 0.35);

  // --- ENSAMBLADO BINARIO PDF 1.4 CON XREF BYTE-EXACT ---
  const collectedImages: PdfImageData[] = [];
  const seenNames = new Set<string>();
  for (const p of pages) {
    for (const img of p.images.values()) {
      if (!seenNames.has(img.name)) {
        seenNames.add(img.name);
        collectedImages.push(img);
      }
    }
  }

  // Objetos base:
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold
  // Siguientes: por página [PageObj, ContentObj], luego XObjects imagen
  const pageCount = pages.length;
  const firstPageObjId = 5;
  const firstImgObjId = firstPageObjId + pageCount * 2;

  const imgObjIdByName = new Map<string, number>();
  collectedImages.forEach((img, idx) => {
    imgObjIdByName.set(img.name, firstImgObjId + idx);
  });

  const fileParts: Uint8Array[] = [];
  let totalBytes = 0;
  const pushPart = (b: Uint8Array) => {
    fileParts.push(b);
    totalBytes += b.length;
  };

  // Header PDF con bytes binarios indicadores
  pushPart(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [];
  const beginObj = (id: number) => {
    offsets[id] = totalBytes;
    pushPart(encodeAscii(`${id} 0 obj\n`));
  };
  const endObj = () => {
    pushPart(encodeAscii('\nendobj\n'));
  };

  // 1: Catalog
  beginObj(1);
  pushPart(encodeAscii('<< /Type /Catalog /Pages 2 0 R >>'));
  endObj();

  // 2: Pages
  const kidsRefs = pages.map((_, idx) => `${firstPageObjId + idx * 2} 0 R`).join(' ');
  beginObj(2);
  pushPart(encodeAscii(`<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pageCount} >>`));
  endObj();

  // 3: Helvetica
  beginObj(3);
  pushPart(encodeAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  endObj();

  // 4: Helvetica-Bold
  beginObj(4);
  pushPart(encodeAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  endObj();

  // Pages & Content Streams
  pages.forEach((p, idx) => {
    const pageObjId = firstPageObjId + idx * 2;
    const contentObjId = pageObjId + 1;
    const xobjEntries = Array.from(p.images.keys())
      .map((name) => `/${name} ${imgObjIdByName.get(name)} 0 R`)
      .join(' ');
    const xobjDict = xobjEntries ? ` /XObject << ${xobjEntries} >>` : '';

    beginObj(pageObjId);
    pushPart(
      encodeAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjDict} >> /Contents ${contentObjId} 0 R >>`,
      ),
    );
    endObj();

    const streamBytes = p.buildStream();
    beginObj(contentObjId);
    pushPart(encodeAscii(`<< /Length ${streamBytes.length} >>\nstream\n`));
    pushPart(streamBytes);
    pushPart(encodeAscii('\nendstream'));
    endObj();
  });

  // Image XObjects (JPEG /DCTDecode)
  collectedImages.forEach((img) => {
    const objId = imgObjIdByName.get(img.name)!;
    beginObj(objId);
    pushPart(
      encodeAscii(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
      ),
    );
    pushPart(img.bytes);
    pushPart(encodeAscii('\nendstream'));
    endObj();
  });

  const totalObjs = firstImgObjId + collectedImages.length - 1;
  const xrefOffset = totalBytes;
  pushPart(encodeAscii(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`));
  for (let id = 1; id <= totalObjs; id++) {
    pushPart(encodeAscii(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`));
  }
  pushPart(
    encodeAscii(
      `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ),
  );

  const blob = new Blob(fileParts as BlobPart[], { type: 'application/pdf' });
  const safeMarca = (data.vehiculo.marca || 'Vehiculo').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeVin = (data.vehiculo.vinChasis || 'Informe').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = `Informe_Final_${safeMarca}_${safeVin}.pdf`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);

  return { ok: true, filename, fotosIncluidas };
}
