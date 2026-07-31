// src/modules/vivi_sdr/application/services/transfer-to-broker.service.ts
// Extraido de ProcessIncomingMessageUseCase (I10 da auditoria, refactor
// estrutural puro - comportamento inalterado). Cria (ou promove) o Card do
// Kanban quando a tool "transferir_para_corretor" e chamada pela VIVI.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { PromoverLeadMinimoUseCase } from '../../../vendas_kanban/application/use-cases/promover-lead-minimo.use-case';
import { CreateNoteUseCase } from '../../../vendas_kanban/application/use-cases/create-note.use-case';
import {
  ViviConversationRecord,
  ViviConversationUpdateInput,
} from '../../domain/repositories/vivi-conversation-repository.interface';
import { buildResumoAtendimento } from '../../domain/services/build-resumo-atendimento';

// Nome fixo da coluna de deposito estrategico de leads sem perfil de renda
// para nenhuma faixa de financiamento hoje - ver
// create-default-pipeline.use-case.ts (modulo vendas_kanban).
const STAGE_REPIQUE_NOME = 'Repique';

interface TransferToBrokerInput {
  tenantId: string;
  phoneNumber: string;
  conversation: ViviConversationRecord;
  collected: ViviConversationUpdateInput;
  motivo: string;
}

@Injectable()
export class TransferToBrokerService {
  private readonly logger = new Logger(TransferToBrokerService.name);

  constructor(
    @Inject('IPipelineRepository')
    private readonly pipelineRepository: IPipelineRepository,
    @Inject('IStageRepository')
    private readonly stageRepository: IStageRepository,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly promoverLeadMinimoUseCase: PromoverLeadMinimoUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
  ) {}

  async execute(input: TransferToBrokerInput): Promise<string | null> {
    const { tenantId, phoneNumber, conversation, collected, motivo } = input;

    const pipelines = await this.pipelineRepository.findAllByTenant(tenantId);
    const pipeline = pipelines[0];
    if (!pipeline) {
      // Situacao rara: tenant sem nenhum pipeline configurado ainda. A
      // conversa e marcada como transferida mesmo assim, so sem Card.
      this.logger.error(`Nao foi possivel criar o Card da VIVI: tenant ${tenantId} nao tem pipeline.`);
      return null;
    }

    // "sem_perfil" (renda SEM_PERFIL, ver classificar-renda.ts) deposita o
    // Card direto na coluna "Repique" em vez da Caixa de Entrada - deposito
    // estrategico para remarketing futuro, nao um lead ativo para
    // distribuir agora (por isso CreateQuickCardUseCase NAO dispara a
    // Roleta Online quando stageId vem preenchido, ver comentario la).
    let stageId: string | null = null;
    if (motivo === 'sem_perfil') {
      const stages = await this.stageRepository.findAllByPipeline(pipeline.id);
      const repiqueStage = stages.find((stage) => stage.name === STAGE_REPIQUE_NOME);
      stageId = repiqueStage?.id ?? null;
      if (!stageId) {
        this.logger.warn(
          `Stage "${STAGE_REPIQUE_NOME}" nao encontrada para tenant ${tenantId} - Card criado na Caixa de Entrada normalmente.`,
        );
      }
    }

    const nome = collected.nomeColetado ?? conversation.nomeColetado;
    const tipoImovel = collected.tipoImovelColetado ?? conversation.tipoImovelColetado;
    const orcamento = collected.orcamentoColetado ?? conversation.orcamentoColetado;
    const regiao = collected.regiaoColetado ?? conversation.regiaoColetado;
    const finalidade = collected.finalidadeColetado ?? conversation.finalidadeColetado;
    const rendaDeclarada = collected.rendaDeclarada ?? conversation.rendaDeclarada;
    const categoriaHabitacional = collected.categoriaHabitacional ?? conversation.categoriaHabitacional;

    const resumo = buildResumoAtendimento({
      motivo,
      nome,
      phoneNumber,
      tipoImovel,
      orcamento,
      rendaDeclarada,
      categoriaHabitacional,
      regiao,
      finalidade,
      visitaAgendadaEm: conversation.visitaAgendadaEm,
      dataNascimento: collected.dataNascimento ?? conversation.dataNascimento,
      email: collected.email ?? conversation.email,
      tipoRenda: collected.tipoRenda ?? conversation.tipoRenda,
      fezDeclaracaoIR: collected.fezDeclaracaoIR ?? conversation.fezDeclaracaoIR,
      urgente: false,
    });

    const origem = motivo === 'sem_perfil' ? 'vivi_repique' : 'roleta_online';
    const tituloCard = nome || 'Lead via VIVI';

    // Promove (muta) o Card de captura automatica do funil de remarketing
    // para este mesmo pipeline/stage, se existir um para este telefone -
    // ver PromoverLeadMinimoUseCase. Se nao existir (contato que qualificou
    // sem nunca ter passado pela captura automatica), cai no caminho ja
    // existente de criar um Card novo, comportamento identico ao de antes
    // desta fatia.
    const card =
      (await this.promoverLeadMinimoUseCase.execute({
        tenantId,
        phoneNumber,
        targetPipelineId: pipeline.id,
        targetStageId: stageId,
        position: 0,
        title: tituloCard,
        description: resumo,
        origem,
        motivoRepique: motivo === 'sem_perfil' ? 'SEM_PERFIL' : null,
      })) ??
      (await this.createQuickCardUseCase.execute({
        tenantId,
        pipelineId: pipeline.id,
        stageId,
        // Chamada de sistema, nao humana - nunca mira o funil de
        // remarketing (ver domain/services/remarketing-pipeline.ts).
        isSystemCall: true,
        title: tituloCard,
        origem,
        phone: phoneNumber,
        description: resumo,
        // Mesmo motivo ja usado pelo modal manual e pelo job de inatividade
        // de 90 dias (ver vendas_kanban/domain/services/motivo-repique.ts) -
        // so quando o card ja nasce direto na stage "Repique" (stageId
        // preenchido acima, motivo "sem_perfil").
        motivoRepique: motivo === 'sem_perfil' ? 'SEM_PERFIL' : undefined,
      }));

    await this.createNoteUseCase.execute({
      tenantId,
      cardId: card.id,
      body: resumo,
    });

    return card.id;
  }
}
