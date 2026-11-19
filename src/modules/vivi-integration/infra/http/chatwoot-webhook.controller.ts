// WhatsApp integrado - Etapa 1, parte 2 (19/11/2026). Rota PUBLICA chamada
// pelo Chatwoot (webhook da conta, evento message_created) a cada mensagem
// nova. Nao ha usuario logado: a protecao e a ASSINATURA (HMAC com o segredo
// do webhook, CHATWOOT_WEBHOOK_SECRET) e o prazo de 5 min do timestamp.
// O Chatwoot entrega por endereco publico (bloqueia rede privada), entao o
// caminho e https://<dominio>/api/chatwoot/eventos (o nginx tira o /api).
//
// Respostas: 401 assinatura ausente/invalida/antiga; 503 servidor sem
// configuracao; 500 falha ao gravar (o Chatwoot pode reenviar - repetidos
// nao duplicam); 200 nos demais casos, inclusive eventos ignorados.
import { Controller, HttpCode, HttpException, HttpStatus, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { assinaturaChatwootValida, interpretarMensagemChatwoot } from '../../services/evento-chatwoot';
import { RegistrarMensagemChatwootUseCase } from '../../application/use-cases/registrar-mensagem-chatwoot.use-case';

function cabecalho(req: Request, nome: string): string | undefined {
  const v = req.headers[nome];
  return typeof v === 'string' ? v : undefined;
}

// Sem limite por IP: o Chatwoot manda tudo do mesmo endereco (rajadas de
// mensagens); quem nao tem o segredo e recusado pela assinatura.
@SkipThrottle()
@Controller('chatwoot')
export class ChatwootWebhookController {
  private readonly logger = new Logger(ChatwootWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registrarMensagem: RegistrarMensagemChatwootUseCase,
  ) {}

  @Post('eventos')
  @HttpCode(HttpStatus.OK)
  async receber(@Req() req: RawBodyRequest<Request>): Promise<{ ok: true; gravada?: boolean }> {
    const valida = assinaturaChatwootValida({
      corpo: req.rawBody,
      timestamp: cabecalho(req, 'x-chatwoot-timestamp'),
      assinatura: cabecalho(req, 'x-chatwoot-signature'),
      segredo: this.config.get<string>('CHATWOOT_WEBHOOK_SECRET'),
      agoraSeg: Math.floor(Date.now() / 1000),
    });
    if (!valida) {
      this.logger.warn('POST /chatwoot/eventos recusado: assinatura ausente, invalida ou antiga.');
      throw new UnauthorizedException('Assinatura invalida.');
    }

    const tenantId = this.config.get<string>('VIVI_TENANT_ID');
    const oficial = Number(this.config.get<string>('CHATWOOT_INBOX_OFICIAL_ID', ''));
    if (!tenantId || !Number.isInteger(oficial) || oficial <= 0) {
      this.logger.error('Webhook do Chatwoot sem VIVI_TENANT_ID ou CHATWOOT_INBOX_OFICIAL_ID configurado.');
      throw new HttpException('Servidor sem configuracao do WhatsApp.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const mensagem = interpretarMensagemChatwoot(req.body, oficial);
    if (!mensagem) return { ok: true };

    try {
      const { gravada } = await this.registrarMensagem.execute(tenantId, mensagem);
      return { ok: true, gravada };
    } catch (err) {
      this.logger.error(`Falha ao gravar mensagem #${mensagem.chatwootMessageId} do Chatwoot: ${(err as Error).message}`);
      throw new HttpException('Falha ao gravar a mensagem.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
