// src/modules/social_media/infra/services/meta-graph-api-messaging.service.ts
// Camada de INFRA: implementa ISocialMessagingService chamando a Send API
// da Graph API da Meta de verdade, via "fetch" nativo (mesmo padrao ja
// usado por MetaGraphApiOAuthService - sem axios). Endpoint unificado
// (POST /{id}/messages) serve tanto Paginas do Facebook (Messenger) quanto
// contas do Instagram Business (Direct) - o {id} e o externalId da
// SocialAccount (Page ID ou IG Business ID) e o token e sempre o
// accessToken da Pagina (nao ha token proprio do Instagram, ver comentario
// do model SocialAccount em schema.prisma).
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  ISocialMessagingService,
  EnviarSocialMessagingInput,
} from '../../domain/services/social-messaging.interface';
import { ISocialAccountRepository } from '../../domain/repositories/social-account-repository.interface';
import { ISocialMessageRepository } from '../../domain/repositories/social-message-repository.interface';

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface GraphApiErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

@Injectable()
export class MetaGraphApiMessagingService implements ISocialMessagingService {
  private readonly logger = new Logger(MetaGraphApiMessagingService.name);

  constructor(
    @Inject('ISocialAccountRepository') private readonly socialAccountRepository: ISocialAccountRepository,
    @Inject('ISocialMessageRepository') private readonly socialMessageRepository: ISocialMessageRepository,
  ) {}

  async enviar(input: EnviarSocialMessagingInput): Promise<void> {
    const account = await this.socialAccountRepository.findById(input.socialAccountId);
    if (!account || account.tenantId !== input.tenantId) {
      throw new NotFoundException('Conta social nao encontrada para este tenant.');
    }
    if (!account.accessToken) {
      throw new BadRequestException(
        `Conta social ${account.id} (${account.canal}) nao tem access_token - reconecte via OAuth.`,
      );
    }

    const url = `${GRAPH_API_BASE}/${account.externalId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.destinatarioExternalId },
        message: { text: input.conteudo },
        access_token: account.accessToken,
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | (GraphApiErrorBody & Record<string, unknown>)
      | null;

    if (!response.ok) {
      const mensagem = body?.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(
        `Falha ao enviar DM via Graph API (conta ${account.id}, canal ${account.canal}): status=${response.status} error=${JSON.stringify(body?.error ?? body)}`,
      );
      throw new BadRequestException(`Falha ao enviar mensagem via ${account.canal}: ${mensagem}`);
    }

    await this.socialMessageRepository.create({
      tenantId: input.tenantId,
      socialAccountId: account.id,
      direction: 'OUT',
      identificadorExterno: input.destinatarioExternalId,
      body: input.conteudo,
      timestamp: new Date(),
    });
  }
}
