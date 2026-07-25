// src/modules/vendas_kanban/application/use-cases/capturar-lead-minimo.use-case.ts
// Captura automatica de lead minimo (nome via pushName do WhatsApp +
// telefone) na primeira mensagem de um contato que ainda nao tem NENHUM
// Card em nenhum pipeline do tenant - garante que nenhum lead se perca
// mesmo quando a conversa com a VIVI nunca chega a chamar
// "transferir_para_corretor"/"agendar_visita" (ex: lead some no meio da
// qualificacao). Deposita num pipeline SEPARADO ("Leads Nao Qualificados"),
// nunca no funil de vendas real - ver PromoverLeadMinimoUseCase para a
// promocao (mutacao do mesmo Card) quando o lead depois qualifica de
// verdade.
//
// Chamado incondicionalmente no inicio de ProcessIncomingMessageUseCase,
// ANTES de qualquer chamada a IA - nunca deve lancar excecao nem atrasar o
// fluxo principal da VIVI (mesmo padrao de resiliencia ja usado por
// RegistrarUsoViviUseCase), por isso todo erro e apenas logado aqui dentro.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { GetOrCreateRemarketingPipelineUseCase } from './get-or-create-remarketing-pipeline.use-case';

interface CapturarLeadMinimoInput {
  tenantId: string;
  phoneNumber: string;
  pushName?: string | null;
}

// Origem propria (distinta de "webhook"/"manual"/"roleta_online") para o
// frontend (KanbanCard.tsx) rotular com um selo dedicado - ver CLAUDE.md.
export const ORIGEM_CAPTURA_AUTOMATICA_VIVI = 'captura_auto_vivi';

@Injectable()
export class CapturarLeadMinimoUseCase {
  private readonly logger = new Logger(CapturarLeadMinimoUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly getOrCreateRemarketingPipelineUseCase: GetOrCreateRemarketingPipelineUseCase,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
  ) {}

  async execute(input: CapturarLeadMinimoInput): Promise<CardRecord | null> {
    if (!input.phoneNumber) return null;

    try {
      const jaExiste = await this.cardRepository.existsByTenantAndPhone(
        input.tenantId,
        input.phoneNumber,
      );
      if (jaExiste) {
        // Ja rastreado em algum pipeline (remarketing, vendas, Repique
        // etc.) - nao captura de novo, idempotente por natureza (nao
        // precisa de nenhuma flag extra de "ja processado").
        return null;
      }

      const { pipelineId, stageId } = await this.getOrCreateRemarketingPipelineUseCase.execute({
        tenantId: input.tenantId,
      });

      const nome = input.pushName?.trim() || input.phoneNumber;

      const card = await this.createQuickCardUseCase.execute({
        tenantId: input.tenantId,
        pipelineId,
        stageId,
        title: nome,
        origem: ORIGEM_CAPTURA_AUTOMATICA_VIVI,
        phone: input.phoneNumber,
      });

      this.logger.log(
        `[Remarketing] Lead minimo capturado automaticamente para ${input.phoneNumber} (card ${card.id}, nome="${nome}").`,
      );
      return card;
    } catch (error) {
      this.logger.error(
        `[Remarketing] Falha ao capturar lead minimo para ${input.phoneNumber}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }
}
