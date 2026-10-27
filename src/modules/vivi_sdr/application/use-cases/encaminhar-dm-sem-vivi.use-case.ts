// src/modules/vivi_sdr/application/use-cases/encaminhar-dm-sem-vivi.use-case.ts
// Rede de seguranca enquanto a VIVI interna esta desligada (27/10/2026, ver
// constants/vivi-interna.ts): uma DM de Instagram/Facebook nao pode ficar sem
// ninguem ver. Na PRIMEIRA mensagem de um contato, cria um card na Caixa de
// Entrada (que dispara a Roleta, via card.sem_dono.criado). Mensagens
// seguintes do mesmo contato nao criam outro card.
//
// Provisorio ate a fase B do mapa de processos (chave liga/desliga da VIVI
// por conta + tela de conversa para um humano responder as DMs).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ISocialConversationRepository } from '../../domain/repositories/social-conversation-repository.interface';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { funilDeVendasPadrao } from '../../../vendas_kanban/domain/services/remarketing-pipeline';

export interface EncaminharDmSemViviInput {
  tenantId: string;
  canal: Canal.INSTAGRAM | Canal.FACEBOOK;
  socialAccountId: string;
  identificadorExterno: string;
  mensagem: string;
}

const LIMITE_TRECHO = 500;

@Injectable()
export class EncaminharDmSemViviUseCase {
  private readonly logger = new Logger(EncaminharDmSemViviUseCase.name);

  constructor(
    @Inject('ISocialConversationRepository')
    private readonly socialConversationRepository: ISocialConversationRepository,
    @Inject('IPipelineRepository')
    private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository')
    private readonly cardRepository: ICardRepository,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
  ) {}

  async execute(input: EncaminharDmSemViviInput): Promise<string | null> {
    // Ja foi encaminhada antes (conversa marcada como transferida)?
    const ultima = await this.socialConversationRepository.findLatestByAccountAndExternalId(
      input.socialAccountId,
      input.identificadorExterno,
    );
    if (ultima && ultima.status !== 'em_andamento' && ultima.status !== 'encerrada') {
      return null;
    }

    // Contato ja tem card com corretor responsavel.
    const temDono = await this.cardRepository.existsByTenantAndPhoneWithOwner(
      input.tenantId,
      input.identificadorExterno,
    );
    if (temDono) {
      return null;
    }

    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    const pipeline = funilDeVendasPadrao(pipelines);
    if (!pipeline) {
      this.logger.error(`DM sem VIVI: tenant ${input.tenantId} sem funil de vendas - card nao criado.`);
      return null;
    }

    // Marca a conversa ANTES de criar o card: se duas mensagens chegarem
    // juntas, a segunda ja ve a conversa como encaminhada na maioria dos
    // casos (janela pequena, mesmo risco ja aceito no fluxo da VIVI).
    const conversa =
      ultima && ultima.status === 'em_andamento'
        ? ultima
        : await this.socialConversationRepository.create({
            tenantId: input.tenantId,
            socialAccountId: input.socialAccountId,
            identificadorExterno: input.identificadorExterno,
          });
    await this.socialConversationRepository.update(conversa.id, { status: 'qualificado_transferido' });

    const rede = input.canal === Canal.INSTAGRAM ? 'Instagram' : 'Facebook';
    const trecho = (input.mensagem ?? '').trim().slice(0, LIMITE_TRECHO);
    const card = await this.createQuickCardUseCase.execute({
      tenantId: input.tenantId,
      pipelineId: pipeline.id,
      isSystemCall: true,
      title: `Mensagem pelo ${rede}`,
      origem: input.canal === Canal.INSTAGRAM ? 'instagram_dm' : 'facebook_dm',
      phone: input.identificadorExterno,
      description: `Primeira mensagem recebida pelo ${rede} (sem atendimento da VIVI): "${trecho}"`,
    });

    await this.socialConversationRepository.update(conversa.id, { cardId: card.id });
    return card.id;
  }
}
