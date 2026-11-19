import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilitar CORS para desarrollo local y producción controlada
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validación global de DTOs (sin eliminar propiedades en endpoints dinámicos existentes)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  // Servir archivos comprimidos .webp y PDFs desde la carpeta uploads/
  const uploadsPath = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`Chapería Pro Backend (NestJS + PostgreSQL + JWT + WebP + SSE) corriendo en: http://localhost:${port}/api`);
}
bootstrap();
