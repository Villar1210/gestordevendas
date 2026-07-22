// src/modules/social_media/infra/http/social-webhook.controller.ts
// Rotas PUBLICAS (a Meta chama isso, nao ha usuario logado) - controller
// PROPRIO, separado de SocialController (que usa @Controller('social')
// tambem, mas para as rotas de OAuth/gestao de contas autenticadas) porque
// /social/webhook e uma rota IRMA, com dependencias/seguranca proprias
// (mesmo raciocinio ja usado para separar EdocStatsController de
// EnvelopeController).
import { Controller, Get, HttpStatus, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ProcessMetaWebhookEventUseCase } from '../../application/use-cases/process-meta-webhook-event.use-case';

@Controller('social')
export class SocialWebhookController {
  private readonly logger = new Logger(SocialWebhookController.name);

  constructor(private readonly processMetaWebhookEventUseCase: ProcessMetaWebhookEventUseCase) {}

  // GET /social/webhook - handshake de verificacao exigido pela Meta ao
  // cadastrar a URL do webhook no App Dashboard (Webhooks > Callback URL).
  @Get('webhook')
  verificar(@Query() query: Record<string, string>, @Res() res: Response): void {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && !!expectedToken && token === expectedToken) {
      res.status(HttpStatus.OK).type('text/plain').send(challenge);
      return;
    }

    this.logger.warn('Verificacao de webhook da Meta rejeitada (hub.mode/hub.verify_token nao batem).');
    res.status(HttpStatus.FORBIDDEN).send('Forbidden');
  }

  // POST /social/webhook - eventos reais (DMs, e futuramente comentarios).
  // Sempre responde 200 rapido (protocolo da Meta), MESMO se o
  // processamento interno falhar - a unica excecao e assinatura invalida
  // (401), que rejeita a requisicao antes de qualquer processamento.
  @Post('webhook')
  async receber(@Req() req: RawBodyRequest<Request>, @Res() res: Response): Promise<void> {
    if (!this.isValidSignature(req)) {
      this.logger.warn('POST /social/webhook rejeitado: assinatura X-Hub-Signature-256 ausente ou invalida.');
      res.status(HttpStatus.UNAUTHORIZED).send('Invalid signature');
      return;
    }

    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    try {
      await this.processMetaWebhookEventUseCase.execute(req.body);
    } catch (err) {
      this.logger.error(
        `Falha ao processar evento do webhook da Meta: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // HMAC SHA-256 do corpo BRUTO (req.rawBody - ver main.ts, rawBody:true)
  // com META_APP_SECRET, comparado ao header X-Hub-Signature-256
  // (formato "sha256=<hex>") em tempo constante (timingSafeEqual) - mesmo
  // cuidado padrao contra timing attack ja usado em outros pontos do
  // projeto que comparam segredos (ex: tokens de acesso).
  private isValidSignature(req: RawBodyRequest<Request>): boolean {
    const appSecret = process.env.META_APP_SECRET;
    const signatureHeader = req.headers['x-hub-signature-256'];

    if (!appSecret || typeof signatureHeader !== 'string' || !req.rawBody) {
      return false;
    }

    const expected = 'sha256=' + createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
