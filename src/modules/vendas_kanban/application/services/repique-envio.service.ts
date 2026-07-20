// src/modules/vendas_kanban/application/services/repique-envio.service.ts
// Logica de envio de UMA mensagem de campanha do Repique (canal/template/
// registro), compartilhada entre o job automatico
// (ProcessarCampanhaRepiqueUseCase, que decide SE deve enviar hoje - regra
// dos 2 dias) e o disparo manual pelo corretor
// (DispararRepiqueManualUseCase, que ignora essa espera de proposito).
// Ambos escrevem na MESMA tabela RepiqueCampanhaEnvio, entao a alternancia
// de canal e a cadencia continuam corretas independente de quem disparou -
// nao precisa de nenhuma logica extra para isso (ver PROGRESS.md).
import { randomBytes } from 'crypto';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import {
  IRepiqueCampanhaEnvioRepository,
  RepiqueCampanhaEnvioRecord,
} from '../../domain/repositories/repique-campanha-envio-repository.interface';
import { IMessageDispatcher } from '../../../../shared/domain/services/message-dispatcher.interface';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { buildRepiqueMensagem } from '../../domain/services/repique-mensagem-template';

@Injectable()
export class RepiqueEnvioService {
  private readonly logger = new Logger(RepiqueEnvioService.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IRepiqueCampanhaEnvioRepository')
    private readonly envioRepository: IRepiqueCampanhaEnvioRepository,
    @Inject('IMessageDispatcher') private readonly messageDispatcher: IMessageDispatcher,
  ) {}

  // Canal do PROXIMO envio deste card - primeiro envio (nenhum registro
  // ainda) sempre comeca por EMAIL; dos demais, alterna a partir do ultimo
  // registrado (manual ou automatico, nao importa).
  async determinarProximoCanal(cardId: string): Promise<Canal> {
    const ultimoEnvio = await this.envioRepository.findUltimoPorCard(cardId);
    if (!ultimoEnvio) {
      return Canal.EMAIL;
    }
    return ultimoEnvio.canal === Canal.EMAIL ? Canal.WHATSAPP : Canal.EMAIL;
  }

  // Monta o template certo (motivoRepique + canal), envia via
  // MessageDispatcher (nunca chama providers diretamente) e registra a
  // tentativa (sucesso ou falha) em RepiqueCampanhaEnvio. Nao decide SE
  // deve enviar agora (isso e responsabilidade de quem chama) - so faz o
  // envio em si, sempre que chamado.
  async enviarProximo(
    card: CardRecord,
    whatsappSessionId: string | null,
  ): Promise<RepiqueCampanhaEnvioRecord> {
    const canal = await this.determinarProximoCanal(card.id);
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

    const envio = await this.envioRepository.create({
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

    return envio;
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
