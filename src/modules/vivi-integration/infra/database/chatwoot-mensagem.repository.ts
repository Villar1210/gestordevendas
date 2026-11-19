// WhatsApp integrado - Etapa 1, parte 2 (19/11/2026): grava a copia das
// mensagens do numero oficial (tabela chatwoot_mensagens).
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../config/prisma.service';
import { MensagemChatwoot } from '../../services/evento-chatwoot';

export interface NovaMensagemChatwoot extends MensagemChatwoot {
  tenantId: string;
  cardId: string | null;
  telefoneChave: string;
}

@Injectable()
export class ChatwootMensagemRepository {
  constructor(private readonly prisma: PrismaService) {}

  // true = gravada agora; false = ja existia (mesmo chatwootMessageId - o
  // Chatwoot reenviou o aviso). skipDuplicates usa o indice unico, entao
  // dois avisos simultaneos da mesma mensagem tambem nao duplicam.
  async inserirSeNova(m: NovaMensagemChatwoot): Promise<boolean> {
    const r = await this.prisma.chatwootMensagem.createMany({
      data: [
        {
          tenantId: m.tenantId,
          cardId: m.cardId,
          telefone: m.telefone,
          telefoneChave: m.telefoneChave,
          chatwootMessageId: m.chatwootMessageId,
          chatwootConversationId: m.chatwootConversationId,
          chatwootInboxId: m.chatwootInboxId,
          direcao: m.direcao,
          autorTipo: m.autorTipo,
          autorNome: m.autorNome,
          conteudo: m.conteudo,
          anexos: m.anexos.length ? (m.anexos as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          enviadaEm: m.enviadaEm,
        },
      ],
      skipDuplicates: true,
    });
    return r.count === 1;
  }
}
