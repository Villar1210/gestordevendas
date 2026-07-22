// src/modules/social_media/application/use-cases/process-meta-webhook-event.use-case.ts
// Parseia o payload do webhook da Meta (ja com a assinatura validada pelo
// controller - ver SocialWebhookController) e emite o evento agnostico
// 'mensagem.recebida' (ver shared/domain/events/mensagem-recebida.event.ts)
// para cada DM real recebida. NUNCA lanca erro para fora - o controller ja
// respondeu 200 para a Meta antes de chamar isto (ver CLAUDE.md/instrucao
// da fatia: protocolo de webhook da Meta exige 200 rapido, mesmo se o
// processamento interno falhar) - erros aqui so sao logados.
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject } from '@nestjs/common';
import { ISocialAccountRepository } from '../../domain/repositories/social-account-repository.interface';
import { ISocialMessageRepository } from '../../domain/repositories/social-message-repository.interface';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import {
  MensagemRecebidaEvent,
  MENSAGEM_RECEBIDA_EVENT,
} from '../../../../shared/domain/events/mensagem-recebida.event';

interface MetaMessagingEntry {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
  // reaction/read/delivery - eventos de outros tipos, ignorados nesta
  // fatia (so o campo message e tratado, ver instrucao da fatia).
  [key: string]: unknown;
}

interface MetaWebhookEntry {
  id: string;
  time?: number;
  messaging?: MetaMessagingEntry[];
  // "changes" (comments etc.) - proxima fatia, nao tratado aqui.
  [key: string]: unknown;
}

export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

@Injectable()
export class ProcessMetaWebhookEventUseCase {
  private readonly logger = new Logger(ProcessMetaWebhookEventUseCase.name);

  constructor(
    @Inject('ISocialAccountRepository') private readonly socialAccountRepository: ISocialAccountRepository,
    @Inject('ISocialMessageRepository') private readonly socialMessageRepository: ISocialMessageRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(payload: MetaWebhookPayload): Promise<void> {
    const canal = this.resolveCanal(payload.object);
    if (!canal) {
      this.logger.warn(`Webhook da Meta ignorado: "object" nao reconhecido (${payload.object}).`);
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const messagingItem of entry.messaging ?? []) {
        await this.processMessagingItem(canal, entry, messagingItem);
      }
    }
  }

  private resolveCanal(object: string | undefined): Canal | null {
    if (object === 'instagram') return Canal.INSTAGRAM;
    if (object === 'page') return Canal.FACEBOOK;
    return null;
  }

  private async processMessagingItem(
    canal: Canal,
    entry: MetaWebhookEntry,
    messagingItem: MetaMessagingEntry,
  ): Promise<void> {
    if (!messagingItem.message) {
      // reaction/read/delivery/outros - ver instrucao da fatia: "ignorar
      // silenciosamente (mas logar)".
      this.logger.debug(
        `Evento de messaging sem "message" ignorado (canal=${canal}, pagina=${entry.id}) - tipo nao tratado nesta fatia.`,
      );
      return;
    }

    if (messagingItem.message.is_echo) {
      // Eco da propria mensagem que NOS enviamos (via Send API) - a Meta
      // reenvia isso pelo mesmo webhook. Sem este filtro, a resposta da
      // VIVI dispararia um novo evento 'mensagem.recebida' para a propria
      // resposta dela, entrando em loop.
      return;
    }

    const texto = messagingItem.message.text;
    const senderId = messagingItem.sender?.id;
    if (!texto || !senderId) {
      this.logger.debug(
        `Mensagem sem texto (provavel anexo/sticker) ignorada (canal=${canal}, pagina=${entry.id}, sender=${senderId ?? 'desconhecido'}).`,
      );
      return;
    }

    const socialAccount = await this.socialAccountRepository.findByCanalAndExternalId(canal, entry.id);
    if (!socialAccount) {
      this.logger.warn(
        `Nenhuma SocialAccount conectada encontrada para canal=${canal} externalId=${entry.id} - webhook ignorado (conta desconectada?).`,
      );
      return;
    }

    const timestamp = messagingItem.timestamp ? new Date(messagingItem.timestamp) : new Date();

    await this.socialMessageRepository.create({
      tenantId: socialAccount.tenantId,
      socialAccountId: socialAccount.id,
      direction: 'IN',
      identificadorExterno: senderId,
      body: texto,
      timestamp,
    });

    const mensagemRecebida: MensagemRecebidaEvent = {
      canal,
      tenantId: socialAccount.tenantId,
      identificadorExterno: senderId,
      conteudo: texto,
      timestamp,
      contaId: socialAccount.id,
    };
    this.eventEmitter.emit(MENSAGEM_RECEBIDA_EVENT, mensagemRecebida);
  }
}
