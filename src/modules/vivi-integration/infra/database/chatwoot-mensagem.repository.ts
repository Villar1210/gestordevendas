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
  autorUserId?: string | null;
}

@Injectable()
export class ChatwootMensagemRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Etapa 2 (19/11/2026): mensagens que chegaram antes de o card existir
  // (gravadas so com o telefone) passam a apontar para o card. So mexe nas
  // que estao SEM card - nunca troca o card de uma mensagem ja ligada.
  async ligarSemCardAoCard(tenantId: string, telefoneChave: string, cardId: string): Promise<number> {
    const r = await this.prisma.chatwootMensagem.updateMany({
      where: { tenantId, telefoneChave, cardId: null },
      data: { cardId },
    });
    return r.count;
  }

  // Etapa 3: completa o banco com o historico lido do Chatwoot. Nunca muda
  // o que ja existe (a linha gravada pelo envio do corretor tem o autor).
  async inserirVarias(ms: NovaMensagemChatwoot[]): Promise<number> {
    if (ms.length === 0) return 0;
    const r = await this.prisma.chatwootMensagem.createMany({
      data: ms.map((m) => ({
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
      })),
      skipDuplicates: true,
    });
    return r.count;
  }

  // Etapa 3: mensagens do card para a tela de chat (mais antigas primeiro).
  // desde: so as gravadas depois (consulta da atualizacao automatica).
  async daConversa(cardId: string, desde?: Date) {
    return this.prisma.chatwootMensagem.findMany({
      where: { cardId, ...(desde ? { createdAt: { gt: desde } } : {}) },
      orderBy: [{ enviadaEm: 'asc' }, { chatwootMessageId: 'asc' }],
      take: 2000,
      select: {
        chatwootMessageId: true,
        direcao: true,
        autorTipo: true,
        autorNome: true,
        conteudo: true,
        anexos: true,
        enviadaEm: true,
        createdAt: true,
      },
    });
  }

  async ultimaDoCliente(cardId: string): Promise<Date | null> {
    const m = await this.prisma.chatwootMensagem.findFirst({
      where: { cardId, direcao: 'entrada' },
      orderBy: { enviadaEm: 'desc' },
      select: { enviadaEm: true },
    });
    return m?.enviadaEm ?? null;
  }

  async corretorJaEscreveu(cardId: string): Promise<boolean> {
    return (await this.prisma.chatwootMensagem.count({ where: { cardId, autorTipo: 'atendente' } })) > 0;
  }

  // Ultima mensagem e nao lidas (mensagens do cliente depois da ultima
  // leitura deste usuario) de varios cards de uma vez - lista de conversas.
  async resumoPorCard(cardIds: string[], userId: string) {
    if (cardIds.length === 0) return new Map<string, { ultima: { texto: string | null; autorTipo: string; em: Date; temAnexo: boolean } | null; naoLidas: number }>();
    const ultimas = await this.prisma.chatwootMensagem.findMany({
      where: { cardId: { in: cardIds } },
      distinct: ['cardId'],
      orderBy: [{ cardId: 'asc' }, { enviadaEm: 'desc' }],
      select: { cardId: true, conteudo: true, autorTipo: true, enviadaEm: true, anexos: true },
    });
    const leituras = await this.prisma.chatLeitura.findMany({
      where: { userId, cardId: { in: cardIds } },
      select: { cardId: true, lidoAte: true },
    });
    const lidoAte = new Map(leituras.map((l) => [l.cardId, l.lidoAte]));
    const naoLidas = await Promise.all(
      cardIds.map((id) =>
        this.prisma.chatwootMensagem.count({
          where: { cardId: id, direcao: 'entrada', ...(lidoAte.has(id) ? { enviadaEm: { gt: lidoAte.get(id)! } } : {}) },
        }),
      ),
    );
    const mapa = new Map<string, { ultima: { texto: string | null; autorTipo: string; em: Date; temAnexo: boolean } | null; naoLidas: number }>();
    cardIds.forEach((id, i) => mapa.set(id, { ultima: null, naoLidas: naoLidas[i] }));
    for (const u of ultimas) {
      if (!u.cardId) continue;
      mapa.get(u.cardId)!.ultima = {
        texto: u.conteudo,
        autorTipo: u.autorTipo,
        em: u.enviadaEm,
        temAnexo: Array.isArray(u.anexos) && u.anexos.length > 0,
      };
    }
    return mapa;
  }

  async marcarLido(userId: string, cardId: string, ate: Date): Promise<void> {
    await this.prisma.chatLeitura.upsert({
      where: { userId_cardId: { userId, cardId } },
      update: { lidoAte: ate },
      create: { userId, cardId, lidoAte: ate },
    });
  }

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

  // Parte 3: mensagem que o corretor enviou pelo Gestor. O aviso do webhook
  // da mesma mensagem pode chegar ANTES ou DEPOIS desta gravacao: se ja
  // existe, so completa quem enviou (corretor) e o card; senao, cria.
  async registrarEnvio(m: NovaMensagemChatwoot & { autorUserId: string }): Promise<void> {
    await this.prisma.chatwootMensagem.upsert({
      where: { chatwootMessageId: m.chatwootMessageId },
      update: { autorUserId: m.autorUserId, autorNome: m.autorNome, autorTipo: 'atendente', cardId: m.cardId },
      create: {
        tenantId: m.tenantId,
        cardId: m.cardId,
        telefone: m.telefone,
        telefoneChave: m.telefoneChave,
        chatwootMessageId: m.chatwootMessageId,
        chatwootConversationId: m.chatwootConversationId,
        chatwootInboxId: m.chatwootInboxId,
        direcao: 'saida',
        autorTipo: 'atendente',
        autorNome: m.autorNome,
        autorUserId: m.autorUserId,
        conteudo: m.conteudo,
        anexos: Prisma.DbNull,
        enviadaEm: m.enviadaEm,
      },
    });
  }
}
