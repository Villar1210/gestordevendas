import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { addDays, addHours, subDays, subHours, subMinutes, isWithinInterval, startOfHour } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TZ = 'America/Sao_Paulo';

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwoot: ChatwootWhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async verificarFollowUps() {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID');
    if (!tenantId) return;

    const agora = toZonedTime(new Date(), TZ);
    const horaAtual = startOfHour(agora);
    this.logger.log('Verificando follow-ups');

    const atividades = await this.prisma.activity.findMany({
      where: {
        tenantId,
        type: 'visita',
        scheduledAt: {
          gte: fromZonedTime(subDays(agora, 5), TZ),
          lte: fromZonedTime(addDays(agora, 2), TZ),
        },
      },
      include: {
        card: {
          include: {
            viviConversations: { orderBy: { createdAt: 'desc' }, take: 1 },
            owner: true,
          },
        },
      },
    });

    for (const atividade of atividades) {
      await this.processarFollowUp(atividade, horaAtual);
    }
  }

  private async processarFollowUp(atividade: any, horaAtual: Date) {
    const visita = toZonedTime(new Date(atividade.scheduledAt), TZ);
    const card = atividade.card;
    if (!card) return;

    const viviConv = card.viviConversations?.[0];
    const telefoneCliente = viviConv?.phoneNumber;
    if (!telefoneCliente) return;

    const nomeCliente = viviConv?.nomeColetado || 'cliente';
    const nomeCorretor = card.owner?.name || 'nosso corretor';
    const followUps: string[] = (card.followUpsEnviados as string[]) || [];

    const dataFormatada = visita.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const horaFormatada = visita.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (!followUps.includes('t_minus_30m')) {
      const alvo = subMinutes(visita, 30);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        let enderecoPlantao = '';
        if (card.empreendimentoId) {
          const emp = await this.prisma.empreendimento.findUnique({
            where: { id: card.empreendimentoId },
            select: { plantaoEndereco: true },
          });
          if (emp?.plantaoEndereco) enderecoPlantao = '\n\uD83D\uDCCD Local: ' + emp.plantaoEndereco;
        }
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: '\uD83C\uDFE0 Ol\u00e1, ' + nomeCliente + '! Sua visita come\u00e7a em *30 minutos*!\n\n\u23F0 ' + horaFormatada + 'h\n\uD83D\uDC64 ' + nomeCorretor + ' j\u00e1 est\u00e1 a postos para te receber.' + enderecoPlantao + '\n\nAt\u00e9 j\u00e1! \uD83D\uDE0A',
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_minus_30m');
      }
    }

    if (!followUps.includes('t_minus_1d')) {
      const alvo = subDays(visita, 1);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: '\u23F0 Ol\u00e1, ' + nomeCliente + '! S\u00f3 passando para lembrar que *amanh\u00e3 \u00e9 sua visita* \uD83C\uDFE0\n\n\uD83D\uDCC5 ' + dataFormatada + ' \u00e0s ' + horaFormatada + '\n\uD83D\uDC64 Seu corretor: *' + nomeCorretor + '*\n\nCaso precise reagendar, me avise aqui! \uD83D\uDE0A',
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_minus_1d');
      }
    }

    if (!followUps.includes('t_minus_2h')) {
      const alvo = subHours(visita, 2);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: '\uD83C\uDFE0 Sua visita come\u00e7a em *2 horas*!\n\n\u23F0 ' + horaFormatada + 'h\n\uD83D\uDC64 ' + nomeCorretor + ' est\u00e1 te aguardando.\n\nPrecisa de alguma informa\u00e7\u00e3o? \uD83D\uDCF2',
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_minus_2h');
      }
    }

    if (!followUps.includes('t_plus_1d')) {
      const alvo = addDays(visita, 1);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: 'Oi, ' + nomeCliente + '! \uD83D\uDE0A Como foi a visita ontem?\n\nFicou com alguma d\u00favida? Pode responder aqui! \uD83C\uDFE0',
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_plus_1d');
      }
    }

    if (!followUps.includes('t_plus_4d')) {
      const alvo = addDays(visita, 4);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: 'Oi, ' + nomeCliente + '! Tudo bem? \uD83D\uDE0A\n\nAinda est\u00e1 pensando no im\u00f3vel que visitou? Posso ajudar com simula\u00e7\u00e3o ou tirar qualquer d\u00favida.\n\n\u00c9 s\u00f3 me chamar! \uD83C\uDFE0',
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_plus_4d');
      }
    }
  }

  private async marcarEnviado(atividadeId: string, cardId: string, atual: string[], chave: string) {
    const novos = [...atual, chave];
    this.logger.log('Follow-up [' + chave + '] enviado para atividade ' + atividadeId);
    await this.prisma.card.update({ where: { id: cardId }, data: { followUpsEnviados: novos } });
  }

  // ─── Item 3: Resumo diario 8h ─────────────────────────────────────────────

  @Cron('0 8 * * *')
  async resumoDiario() {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID');
    if (!tenantId) return;

    const agora = toZonedTime(new Date(), TZ);
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
    const limite48h = subDays(agora, 2);
    const limite7d = subDays(agora, 7);

    this.logger.log('Resumo diario');

    const usuarios = await this.prisma.user.findMany({
      where: { tenantId, whatsapp: { not: null } },
      select: { id: true, name: true, whatsapp: true },
    });
    if (!usuarios.length) return;

    const visitasHoje = await this.prisma.activity.findMany({
      where: {
        tenantId,
        type: 'visita',
        done: false,
        scheduledAt: { gte: fromZonedTime(inicioDia, TZ), lte: fromZonedTime(fimDia, TZ) },
      },
      include: {
        card: {
          include: {
            viviConversations: { orderBy: { createdAt: 'desc' }, take: 1 },
            owner: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const leadsParados = await this.prisma.viviConversation.findMany({
      where: { tenantId, status: 'em_andamento', updatedAt: { lte: limite48h }, card: { isNot: null } },
      include: { card: { include: { owner: { select: { id: true, name: true } } } } },
    });

    const cardsParados = await this.prisma.card.findMany({
      where: { tenantId, stageId: { not: null }, updatedAt: { lte: limite7d } },
      include: {
        owner: { select: { id: true, name: true } },
        stage: { select: { name: true } },
      },
    });

    const hoje = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

    for (const usuario of usuarios) {
      const minhasVisitas = visitasHoje.filter((a) => a.card?.owner?.id === usuario.id);
      const meusLeads = leadsParados.filter((c) => c.card?.owner?.id === usuario.id);
      const meusCards = cardsParados.filter((c) => c.owner?.id === usuario.id);

      const linhas: string[] = [];
      linhas.push('\uD83C\uDF05 *Bom dia, ' + usuario.name.split(' ')[0] + '!* Resumo de hoje (' + hoje + '):\n');

      if (minhasVisitas.length) {
        linhas.push('\uD83C\uDFE0 *Visitas agendadas hoje (' + minhasVisitas.length + '):*');
        for (const v of minhasVisitas) {
          const hora = toZonedTime(new Date(v.scheduledAt!), TZ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const nome = v.card?.viviConversations?.[0]?.nomeColetado || v.card?.title || 'Lead';
          linhas.push('  \u2022 ' + hora + 'h \u2014 ' + nome);
        }
      } else {
        linhas.push('\uD83C\uDFE0 Nenhuma visita agendada para hoje.');
      }

      if (meusLeads.length) {
        linhas.push('\n\u23F3 *Leads sem resposta h\u00e1 48h+ (' + meusLeads.length + '):*');
        for (const c of meusLeads.slice(0, 5)) {
          linhas.push('  \u2022 ' + (c.nomeColetado || c.card?.title || 'Lead'));
        }
        if (meusLeads.length > 5) linhas.push('  ...e mais ' + (meusLeads.length - 5));
      }

      if (meusCards.length) {
        linhas.push('\n\uD83D\uDCC5 *Cards parados h\u00e1 7+ dias (' + meusCards.length + '):*');
        for (const c of meusCards.slice(0, 5)) {
          linhas.push('  \u2022 ' + c.title + ' (' + (c.stage?.name || 'sem etapa') + ')');
        }
        if (meusCards.length > 5) linhas.push('  ...e mais ' + (meusCards.length - 5));
      }

      linhas.push('\n\uD83D\uDCAA Bora vender! \uD83C\uDFE0');

      await this.chatwoot.enviarMensagem({
        telefone: usuario.whatsapp!,
        nomeContato: usuario.name,
        mensagem: linhas.join('\n'),
      });
    }
  }

  // ─── Item 4: Deteccao de sinais (hourly) ──────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async detectarSinais() {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID');
    if (!tenantId) return;

    const agora = toZonedTime(new Date(), TZ);
    this.logger.log('Detectando sinais');
    await this.alertarVisitaNaoConfirmada(tenantId, agora);
  }

  private async alertarVisitaNaoConfirmada(tenantId: string, agora: Date) {
    const em24h = addDays(agora, 1);

    const atividades = await this.prisma.activity.findMany({
      where: {
        tenantId,
        type: 'visita',
        done: false,
        scheduledAt: { gte: fromZonedTime(agora, TZ), lte: fromZonedTime(em24h, TZ) },
      },
      include: {
        card: {
          include: {
            owner: { select: { name: true, whatsapp: true } },
            viviConversations: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    for (const atividade of atividades) {
      const card = atividade.card;
      if (!card?.owner?.whatsapp) continue;

      const followUps: string[] = (card.followUpsEnviados as string[]) || [];
      if (followUps.length > 0) continue;

      const chave = 'sinal_visita_nao_confirmada_' + atividade.id;
      if (followUps.includes(chave)) continue;

      const nomeCliente = card.viviConversations?.[0]?.nomeColetado || card.title;
      const visita = toZonedTime(new Date(atividade.scheduledAt!), TZ);
      const horaFormatada = visita.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      await this.chatwoot.enviarMensagem({
        telefone: card.owner.whatsapp,
        nomeContato: card.owner.name,
        mensagem: '\u26A0\uFE0F *Aten\u00e7\u00e3o!* A visita de *' + nomeCliente + '* est\u00e1 marcada para *hoje \u00e0s ' + horaFormatada + 'h*, mas nenhuma confirma\u00e7\u00e3o foi recebida do lead.\n\nRecomendo entrar em contato antes! \uD83D\uDCF2',
      });

      await this.prisma.card.update({
        where: { id: card.id },
        data: { followUpsEnviados: [...followUps, chave] },
      });
    }
  }
}
