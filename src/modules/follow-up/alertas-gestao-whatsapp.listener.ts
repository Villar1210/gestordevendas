// src/modules/follow-up/alertas-gestao-whatsapp.listener.ts
// Fase B (27/10/2026, Etapa 2 do mapa de processos): alertas de lead parado
// vao para o WhatsApp da gestao (alem do sino), pelo mesmo canal ja usado
// pelos avisos do follow-up (Chatwoot -> numero oficial da VIVI).
// - 'cards.sem_dono.resumo' (leads na Caixa de Entrada ha 15 min sem
//   corretor, UM resumo por empresa por rodada): coordenadores e gerentes do
//   tenant com WhatsApp cadastrado; sem nenhum, os Administradores.
// - 'lead.escalado_gestao' (ninguem aceitou e nao ha outro corretor - o lead
//   foi para o gestor): o proprio gestor.
// Contrato so por nome de evento + payload (modulo nao importa modulo).
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../config/prisma.service';
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';
import { normalizarTelefoneBR } from '../vivi-integration/services/aviso-agendamento';

const CARGOS_GESTAO_DE_PLANTAO = ['coordenador', 'gerente', 'gerente_regional', 'superintendente'];
const ADMINISTRADOR_ROLE_NAME = 'Administrador';
const LINK_KANBAN = 'https://gestordevendas.ivillar.com.br/dashboard/kanban';

interface CardsSemDonoResumoEvent {
  tenantId: string;
  cards: Array<{ cardId: string; title: string; minutosAguardando: number }>;
}
const MAX_LINHAS_RESUMO = 10;

interface LeadEscaladoGestaoEvent {
  tenantId: string;
  cardId: string;
  corretorAnteriorId: string | null;
  gestorId: string;
}

interface Destinatario {
  name: string;
  whatsapp: string | null;
}

@Injectable()
export class AlertasGestaoWhatsappListener {
  private readonly logger = new Logger(AlertasGestaoWhatsappListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwoot: ChatwootWhatsappService,
  ) {}

  @OnEvent('cards.sem_dono.resumo')
  async leadsParadosSemDono(event: CardsSemDonoResumoEvent): Promise<void> {
    try {
      if (!event.cards.length) return;
      let destinatarios: Destinatario[] = await this.prisma.user.findMany({
        where: {
          tenantId: event.tenantId,
          statusCadastro: 'aprovado',
          cargoHierarquico: { in: CARGOS_GESTAO_DE_PLANTAO },
          whatsapp: { not: null },
        },
        select: { name: true, whatsapp: true },
      });
      if (destinatarios.length === 0) {
        destinatarios = await this.prisma.user.findMany({
          where: {
            tenantId: event.tenantId,
            statusCadastro: 'aprovado',
            role: { name: ADMINISTRADOR_ROLE_NAME },
            whatsapp: { not: null },
          },
          select: { name: true, whatsapp: true },
        });
      }
      const linhas = event.cards
        .slice(0, MAX_LINHAS_RESUMO)
        .map((c) => `• ${c.title} (há ${c.minutosAguardando} min)`);
      const resto = event.cards.length > MAX_LINHAS_RESUMO ? `\n...e mais ${event.cards.length - MAX_LINHAS_RESUMO}` : '';
      const mensagem =
        `⚠️ *${event.cards.length} lead(s) sem corretor*\n` +
        `${linhas.join('\n')}${resto}\n` +
        `Ninguém assumiu ainda. Distribua pela Caixa de Entrada:\n${LINK_KANBAN}`;
      await this.enviarParaTodos(destinatarios, mensagem);
    } catch (error) {
      this.logger.error(`Falha no alerta de leads sem dono (tenant ${event.tenantId}): ${(error as Error).message}`);
    }
  }

  @OnEvent('lead.escalado_gestao')
  async leadEscaladoParaGestao(event: LeadEscaladoGestaoEvent): Promise<void> {
    try {
      const [gestor, card] = await Promise.all([
        this.prisma.user.findFirst({
          where: { id: event.gestorId, tenantId: event.tenantId },
          select: { name: true, whatsapp: true },
        }),
        this.prisma.card.findFirst({
          where: { id: event.cardId, tenantId: event.tenantId },
          select: { title: true, pipelineId: true },
        }),
      ]);
      if (!gestor || !card) return;
      const mensagem =
        `⚠️ *Lead repassado para você*\n` +
        `${card.title}\n` +
        `O corretor sorteado não aceitou no prazo e não havia outro corretor disponível. ` +
        `Atenda ou repasse para alguém da equipe:\n${LINK_KANBAN}?pipelineId=${card.pipelineId}&cardId=${event.cardId}`;
      await this.enviarParaTodos([gestor], mensagem);
    } catch (error) {
      this.logger.error(`Falha no alerta de lead escalado (card ${event.cardId}): ${(error as Error).message}`);
    }
  }

  private async enviarParaTodos(destinatarios: Destinatario[], mensagem: string): Promise<void> {
    for (const d of destinatarios) {
      const telefone = normalizarTelefoneBR(d.whatsapp);
      if (!telefone) continue;
      await this.chatwoot.enviarMensagem({ telefone, nomeContato: d.name, mensagem });
    }
  }
}
