import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { ChatwootWhatsappService } from '../vivi-integration/services/chatwoot-whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { addDays, addHours, subDays, subHours, isWithinInterval, startOfHour } from 'date-fns';
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
    this.logger.log(`Verificando follow-ups — ${horaAtual.toISOString()}`);

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
        card: true,
      },
    });

    for (const atividade of atividades) {
      await this.processarFollowUp(atividade, horaAtual);
    }
  }

  private async processarFollowUp(atividade: any, horaAtual: Date) {
    const visita = toZonedTime(new Date(atividade.scheduledAt), TZ);
    const card = (atividade as any).card;
    if (!card?.contato?.phone) return;

    const telefoneCliente = card.contato.phone.replace(/\D/g, '');
    const nomeCliente = card.contato.name || 'cliente';
    const nomeCorretor = card.corretor?.name || 'nosso corretor';
    const empreendimento = card.empreendimento?.nome || 'o imóvel';
    const followUps: string[] = card.followUpsEnviados || [];

    const dataFormatada = visita.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const horaFormatada = visita.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (!followUps.includes('t_minus_1d')) {
      const alvo = subDays(visita, 1);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: `⏰ Olá, ${nomeCliente}! Só passando para lembrar que *amanhã é sua visita* 🏠\n\n📅 ${dataFormatada} às ${horaFormatada}\n📍 ${empreendimento}\n👤 Seu corretor: *${nomeCorretor}*\n\nCaso precise reagendar, me avise aqui! 😊`,
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
          mensagem: `🏠 Sua visita começa em *2 horas*!\n\n📍 ${empreendimento} — ${horaFormatada}h\n👤 ${nomeCorretor} está te aguardando.\n\nPrecisa de alguma informação de endereço? 📲`,
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
          mensagem: `Oi, ${nomeCliente}! 😊 Como foi a visita ontem?\n\nO *${nomeCorretor}* explicou bem as condições? Ficou com alguma dúvida sobre ${empreendimento}?\n\nPode responder aqui! 🏠`,
        });
        if (card.corretor?.phone) {
          await this.chatwoot.enviarMensagem({
            telefone: card.corretor.phone.replace(/\D/g, ''),
            nomeContato: nomeCorretor,
            mensagem: `📊 *Follow-up pós-visita*\n\nO cliente *${nomeCliente}* visitou ${empreendimento} ontem.\nJá entrei em contato para colher feedback.\n\nhttps://gestordevendas.ivillar.com.br`,
          });
        }
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_plus_1d');
      }
    }

    if (!followUps.includes('t_plus_4d')) {
      const alvo = addDays(visita, 4);
      if (isWithinInterval(horaAtual, { start: alvo, end: addHours(alvo, 1) })) {
        await this.chatwoot.enviarMensagem({
          telefone: telefoneCliente,
          nomeContato: nomeCliente,
          mensagem: `Oi, ${nomeCliente}! Tudo bem? 😊\n\nAinda está pensando em *${empreendimento}*? Posso ajudar com uma simulação ou tirar qualquer dúvida que ficou.\n\nÉ só me chamar! 🏠`,
        });
        await this.marcarEnviado(atividade.id, card.id, followUps, 't_plus_4d');
      }
    }
  }

  private async marcarEnviado(atividadeId: string, cardId: string, atual: string[], chave: string) {
    const novos = [...atual, chave];
    this.logger.log(`Follow-up [${chave}] enviado para atividade ${atividadeId}`);
    await this.prisma.fila.update({ where: { id: cardId }, data: { followUpsEnviados: novos } });
  }
}
