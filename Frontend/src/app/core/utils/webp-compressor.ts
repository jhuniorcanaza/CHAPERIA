export interface ComprimirWebpResultado {
  file: File;
  previewUrl: string;
  originalKb: number;
  finalKb: number;
}

/**
 * Redimensiona y pre-comprime imágenes en el navegador usando Canvas WebP
 * antes de enviarlas al backend (fallback limpio al archivo original si el formato no aplica).
 */
export function comprimirImagenNavegadorWebp(
  file: File,
  maxWidth = 1400,
  quality = 0.82,
): Promise<ComprimirWebpResultado> {
  const originalKb = Math.max(1, Math.round(file.size / 1024));

  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('El archivo no es una imagen compatible.'));
    };

    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(sourceUrl);
        resolve({
          file,
          previewUrl: URL.createObjectURL(file),
          originalKb,
          finalKb: originalKb,
        });
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      URL.revokeObjectURL(sourceUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              previewUrl: URL.createObjectURL(file),
              originalKb,
              finalKb: originalKb,
            });
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const webpFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
          const previewUrl = URL.createObjectURL(webpFile);
          const finalKb = Math.max(1, Math.round(webpFile.size / 1024));
          resolve({ file: webpFile, previewUrl, originalKb, finalKb });
        },
        'image/webp',
        quality,
      );
    };

    img.src = sourceUrl;
  });
}
