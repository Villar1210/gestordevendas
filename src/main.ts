// src/main.ts
// Precisa ser o primeiro import: carrega o .env antes de qualquer modulo
// (ex: AuthModule) ler process.env durante a avaliacao dos decorators.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilita CORS apenas para o dominio do frontend definido no .env
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Serve uploads/ (ex: fotos de imoveis) como arquivos estaticos em /uploads
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Validacao automatica e estrita de todos os DTOs de entrada (Zod-like)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos nao esperados do payload
      forbidNonWhitelisted: true, // rejeita payload com campos extras
      transform: true,
    }),
  );

  const port = process.env.PORT || 3333;
  await app.listen(port);
  console.log(`🚀 Ecossistema gestaodevendas rodando na porta ${port}`);
}
bootstrap();
