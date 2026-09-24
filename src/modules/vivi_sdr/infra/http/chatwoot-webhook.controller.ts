// src/modules/vivi-integration/infra/http/chatwoot-webhook.controller.ts
// Recebe eventos do Chatwoot (message_created) e aciona a VIVI.
// Rota publica (sem ViviApiKeyGuard) — protegida pelo CHATWOOT_WEBHOOK_SECRET.
import { Controller, Post, Body, Headers, UnauthorizedException, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessIncomingMessageUseCase } from '../../../vivi_sdr/application/use-cases/process-incoming-message.use-case';
import { CHATWOOT_VIRTUAL_SESSION_ID } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';

@Controller('chatwoot/webhook')
export class ChatwootWebhookController {
  private readonly logger = new Logger(ChatwootWebhookController.name);

  constructor(
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-chatwoot-signature') signature: string,
  ): Promise<{ ok: boolean }> {
    // Valida o secret configurado no Chatwoot (Configuracoes > Integrações > Webhooks)
    const secret = this.config.get<string>('CHATWOOT_WEBHOOK_SECRET', '');
    if (secret && signature !== secret) {
      throw new UnauthorizedException('Assinatura do webhook invalida.');
    }

    const event = body?.event;

    // Só processa mensagens recebidas de clientes (message_created, tipo incoming)
    if (event !== 'message_created') {
      return { ok: true };
    }

    const messageType = body?.message_type;
    // message_type: 0 = incoming (cliente), 1 = outgoing (agente/bot)
    // Ignora mensagens de saída para evitar loop
    if (messageType !== 0 && body?.message_type !== 'incoming') {
      return { ok: true };
    }

    const content: string = body?.content;
    if (!content?.trim()) {
      return { ok: true };
    }

    // Extrai o telefone do contato a partir do conversation ou sender
    const phoneNumber: string | undefined =
      body?.conversation?.meta?.sender?.phone_number ||
      body?.sender?.phone_number;

    if (!phoneNumber) {
      this.logger.warn('Webhook Chatwoot sem phoneNumber — ignorado.');
      return { ok: true };
    }

    // Normaliza: remove +, espaços, deixa só dígitos
    const phone = phoneNumber.replace(/\D/g, '');

    const tenantId = this.config.get<string>('VIVI_TENANT_ID', '');
    const pushName: string | undefined = body?.sender?.name;

    this.logger.log(`[Chatwoot Webhook] Mensagem de ${phone}: "${content.substring(0, 60)}"`);

    // Processa em background — não deixa o Chatwoot esperando resposta HTTP
    setImmediate(() => {
      this.processIncomingMessageUseCase
        .execute({
          tenantId,
          sessionId: CHATWOOT_VIRTUAL_SESSION_ID,
          phoneNumber: phone,
          messageBody: content,
          pushName: pushName ?? null,
        })
        .catch((err: Error) => {
          this.logger.error(`Erro ao processar mensagem Chatwoot de ${phone}: ${err.message}`);
        });
    });

    return { ok: true };
  }
}
