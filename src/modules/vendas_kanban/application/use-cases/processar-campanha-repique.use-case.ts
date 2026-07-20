// src/modules/vendas_kanban/application/use-cases/processar-campanha-repique.use-case.ts
// Corpo do job diario (ver infra/scheduler/repique-campanha.scheduler.ts):
// motor de campanha de remarketing escalonada - cards na stage "Repique"
// (sem opt-out) recebem mensagens automaticas a cada 2+ dias, alternando
// WHATSAPP/EMAIL a partir do ultimo envio registrado (primeiro envio =
// EMAIL). Usa MessageDispatcherService (nunca chama providers diretamente -
// ver CLAUDE.md/PROGRESS.md sobre a abstracao de canais).
import { randomBytes } from 'crypto';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IRepiqueCampanhaEnvioRepository } from '../../domain/repositories/repique-campanha-envio-repository.interface';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { IMessageDispatcher } from '../../../../shared/domain/services/message-dispatcher.interface';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { buildRepiqueMensagem } from '../../domain/services/repique-mensagem-template';

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProcessarCampanhaRepiqueUseCase {
  private readonly logger = new Logger(ProcessarCampanhaRepiqueUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IRepiqueCampanhaEnvioRepository')
    private readonly envioRepository: IRepiqueCampanhaEnvioRepository,
    @Inject('IWhatsAppSessionRepository')
    private readonly whatsAppSessionRepository: IWhatsAppSessionRepository,
    @Inject('IMessageDispatcher') private readonly messageDispatcher: IMessageDispatcher,
  ) {}

  async execute(): Promise<void> {
    const candidatos = await this.cardRepository.findElegiveisParaCampanhaRepique();
    if (candidatos.length === 0) {
      return;
    }

    // Uma unica consulta cross-tenant de sessoes conectadas (mesmo padrao
    // de ProcessRoletaTimeoutsUseCase) - montado em mapa para lookup O(1)
    // por tenant a cada card, sem repetir a consulta.
    const sessoesConectadas = await this.whatsAppSessionRepository.findAllConnected();
    const sessaoPorTenant = new Map(sessoesConectadas.map((sessao) => [sessao.tenantId, sessao]));

    for (const card of candidatos) {
      try {
        await this.processarCard(card, sessaoPorTenant.get(card.tenantId)?.id ?? null);
      } catch (err) {
        this.logger.error(
          `Erro processando campanha de repique do card ${card.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async processarCard(card: CardRecord, whatsappSessionId: string | null): Promise<void> {
    const ultimoEnvio = await this.envioRepository.findUltimoPorCard(card.id);

    let canal: Canal;
    if (!ultimoEnvio) {
      canal = Canal.EMAIL;
    } else {
      const decorridoMs = Date.now() - ultimoEnvio.enviadoEm.getTime();
      if (decorridoMs < DOIS_DIAS_MS) {
        return; // ainda dentro da janela de 2 dias - nao envia agora
      }
      canal = ultimoEnvio.canal === Canal.EMAIL ? Canal.WHATSAPP : Canal.EMAIL;
    }

    const token = await this.garantirTokenOptOut(card);
    const linkDescadastro = this.buildLinkDescadastro(token);

    const mensagem = buildRepiqueMensagem({
      motivoRepique: card.motivoRepique,
      canal,
      nomeLead: card.title,
      linkDescadastro,
    });

    let sucesso = true;
    let erroMensagem: string | null = null;

    try {
      if (canal === Canal.WHATSAPP) {
        if (!card.phone) {
          throw new Error('Card sem telefone cadastrado.');
        }
        if (!whatsappSessionId) {
          throw new Error('Nenhuma sessao WhatsApp conectada para este tenant.');
        }
        await this.messageDispatcher.enviar({
          canal: Canal.WHATSAPP,
          tenantId: card.tenantId,
          destinatario: card.phone,
          conteudo: mensagem.corpo,
          whatsappSessionId,
        });
      } else {
        if (!card.email) {
          throw new Error('Card sem e-mail cadastrado.');
        }
        await this.messageDispatcher.enviar({
          canal: Canal.EMAIL,
          tenantId: card.tenantId,
          destinatario: card.email,
          conteudo: mensagem.corpo,
          assunto: mensagem.assunto,
        });
      }
    } catch (err) {
      sucesso = false;
      erroMensagem = (err as Error).message;
    }

    await this.envioRepository.create({
      tenantId: card.tenantId,
      cardId: card.id,
      canal,
      motivoRepiqueNoEnvio: card.motivoRepique,
      sucesso,
      erroMensagem,
    });

    if (sucesso) {
      this.logger.log(`Campanha de repique: card ${card.id} - envio ${canal} realizado.`);
    } else {
      this.logger.warn(`Campanha de repique: card ${card.id} - falha no envio ${canal}: ${erroMensagem}`);
    }
  }

  private async garantirTokenOptOut(card: CardRecord): Promise<string> {
    if (card.repiqueOptOutToken) {
      return card.repiqueOptOutToken;
    }
    const token = randomBytes(32).toString('hex');
    await this.cardRepository.setRepiqueOptOutToken(card.id, token);
    return token;
  }

  private buildLinkDescadastro(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Rotas do backend sao expostas sob /api/ pelo nginx em producao (ver
    // /etc/nginx/sites-enabled/gestordevendas.ivillar.com.br) - o backend
    // em si nao tem prefixo /api proprio.
    return `${baseUrl}/api/public/repique/descadastro/${token}`;
  }
}
