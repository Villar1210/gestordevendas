// src/main.ts
// Precisa ser o primeiro import: carrega o .env antes de qualquer modulo
// (ex: AuthModule) ler process.env durante a avaliacao dos decorators.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody:true mantem o Buffer bruto do corpo (req.rawBody) disponivel
  // AO LADO do parsing normal de JSON - necessario para o webhook do
  // modulo social_media validar a assinatura X-Hub-Signature-256 da Meta
  // (HMAC precisa ser calculado sobre os bytes exatos recebidos, nao sobre
  // um JSON.stringify do body ja parseado, que pode nao bater byte a byte).
  // Nao afeta nenhuma outra rota - so adiciona o Buffer bruto, nao muda o
  // parsing/comportamento existente.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Em producao, o nginx e o unico processo que fala com o backend
  // (proxy_pass para 127.0.0.1:3003, ja envia X-Forwarded-For/X-Real-IP -
  // confirmado na config da VPS). "1" = confia no primeiro hop de proxy
  // reverso na frente da app, para req.ip resolver o IP real do cliente em
  // vez do loopback do nginx - necessario para o rate limiting por IP
  // (ThrottlerModule) funcionar corretamente. Sem reverse proxy em dev
  // local, isso e inofensivo (nao ha X-Forwarded-For para confiar).
  app.set('trust proxy', 1);

  // Headers de seguranca HTTP (helmet). crossOriginResourcePolicy precisa
  // ficar "cross-origin" porque o frontend (outra origem, NEXT_PUBLIC_API_URL)
  // carrega imagens direto de /uploads deste backend (fotos de imoveis,
  // documentos) - o default "same-origin" do helmet bloquearia esse
  // carregamento.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

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
