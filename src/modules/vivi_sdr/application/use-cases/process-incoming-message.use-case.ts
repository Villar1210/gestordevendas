// src/modules/vivi_sdr/application/use-cases/process-incoming-message.use-case.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IViviConversationRepository,
  ViviConversationRecord,
  ViviConversationUpdateInput,
} from '../../domain/repositories/vivi-conversation-repository.interface';
import {
  IAiConversationService,
  AiConversationTurn,
} from '../../../../shared/domain/services/ai-conversation.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { CreateNoteUseCase } from '../../../vendas_kanban/application/use-cases/create-note.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from '../../../atendimento/application/use-cases/classify-and-route-atendimento.use-case';
import { CATEGORIA_TO_FILA_NOME } from '../../../atendimento/domain/services/fila-categorias';
import { VIVI_SYSTEM_PROMPT } from '../../constants/vivi-prompt';

interface ProcessIncomingMessageInput {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  messageBody: string;
}

const HISTORY_LIMIT = 21; // 20 mensagens de historico + a mensagem atual

@Injectable()
export class ProcessIncomingMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(
    @Inject('IViviConversationRepository')
    private readonly viviConversationRepository: IViviConversationRepository,
    @Inject('IAiConversationService')
    private readonly aiConversationService: IAiConversationService,
    @Inject('IWhatsAppMessageRepository')
    private readonly whatsAppMessageRepository: IWhatsAppMessageRepository,
    @Inject('IPipelineRepository')
    private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository')
    private readonly cardRepository: ICardRepository,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
    private readonly classifyAndRouteAtendimentoUseCase: ClassifyAndRouteAtendimentoUseCase,
  ) {}

  async execute(input: ProcessIncomingMessageInput): Promise<void> {
    // Guarda 1: se a conversa mais recente neste numero/sessao ja foi
    // transferida (qualificado_transferido, duvida_transferido ou
    // encaminhado_fila), a VIVI nao deve reabrir o dialogo - o corretor
    // ou agente esta cuidando do lead. Uma nova conversa so e permitida
    // se o status anterior era "em_andamento" (conversa ainda ativa) ou
    // "encerrada" (ciclo anterior concluido, lead pode voltar a interagir).
    const latestConversation =
      await this.viviConversationRepository.findLatestBySessionAndPhone(
        input.sessionId,
        input.phoneNumber,
      );
    if (
      latestConversation &&
      latestConversation.status !== 'em_andamento' &&
      latestConversation.status !== 'encerrada'
    ) {
      this.logger.log(
        `[VIVI] Mensagem ignorada para ${input.phoneNumber}: conversa ja ${latestConversation.status} (nao reabre dialogo enquanto corretor/fila responsavel).`,
      );
      return;
    }

    // Guarda 2: se existe um Card com corretor responsavel (ownerId preenchido)
    // para este numero no Kanban (criado manualmente ou pela propria VIVI em
    // sessao anterior), a VIVI tambem nao deve responder.
    if (input.phoneNumber) {
      const hasActiveCard = await this.cardRepository.existsByTenantAndPhoneWithOwner(
        input.tenantId,
        input.phoneNumber,
      );
      if (hasActiveCard) {
        this.logger.log(
          `[VIVI] Mensagem ignorada para ${input.phoneNumber}: lead ja tem Card com corretor responsavel no Kanban.`,
        );
        return;
      }
    }

    const conversation = await this.findOrCreateConversation(input);

    const { history, remoteJid } = await this.buildHistory(input);
    const { replyText, toolCalls } = await this.aiConversationService.generateReply({
      systemPrompt: VIVI_SYSTEM_PROMPT,
      history,
      userMessage: input.messageBody,
    });

    const collected = this.mergeCollectedData(conversation, toolCalls);
    const transferCall = toolCalls.find((call) => call.name === 'transferir_para_corretor');
    const filaCall = toolCalls.find((call) => call.name === 'transferir_para_fila');

    const updates: ViviConversationUpdateInput = { ...collected };

    if (transferCall) {
      const motivo = String(transferCall.input.motivo ?? 'lead qualificado');
      updates.status = motivo === 'duvida especifica' ? 'duvida_transferido' : 'qualificado_transferido';

      const cardId = await this.transferToBroker(input, conversation, collected, motivo);
      if (cardId) {
        updates.cardId = cardId;
      }
    } else if (filaCall) {
      // Pergunta fora do fluxo de venda (suporte/financeiro/duvida generica) -
      // vai para a Central de Atendimento em vez de virar Card no Kanban.
      updates.status = 'encaminhado_fila';
      await this.transferToFila(input, remoteJid, filaCall);
    }

    // Log de auditoria: unico ponto do caminho de sucesso que registra algo -
    // sem isso, uma mensagem processada sem nenhuma tool chamada (ex: troca
    // de assunto que o modelo respondeu so conversacionalmente) fica
    // impossivel de diferenciar de "nao processou" so olhando o banco, ja
    // que Prisma nao bumpa @updatedAt quando o update() e chamado com
    // data={} (nenhum campo alterado) - achado confirmado durante a
    // investigacao do caso da Antonia (07/2026).
    const toolCalled = transferCall
      ? 'transferir_para_corretor'
      : filaCall
        ? 'transferir_para_fila'
        : 'nenhuma';
    this.logger.log(
      `[VIVI] Mensagem de ${input.phoneNumber} processada (conversa ${conversation.id}): tool=${toolCalled}`,
    );

    await this.viviConversationRepository.update(conversation.id, updates);

    if (replyText.trim()) {
      await this.sendWhatsAppMessageUseCase.execute({
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        // JID completo (com sufixo @lid ou @s.whatsapp.net) da ultima
        // mensagem recebida - reconstruir a partir so dos digitos
        // (input.phoneNumber) quebra a resposta em numeros @lid. Fallback
        // para os digitos so cobre mensagens antigas, salvas antes desse
        // campo existir.
        to: remoteJid ?? input.phoneNumber,
        body: replyText,
      });
    }
  }

  private async findOrCreateConversation(
    input: ProcessIncomingMessageInput,
  ): Promise<ViviConversationRecord> {
    const existing = await this.viviConversationRepository.findActiveBySessionAndPhone(
      input.sessionId,
      input.phoneNumber,
    );
    if (existing) {
      return existing;
    }

    return this.viviConversationRepository.create({
      tenantId: input.tenantId,
      whatsappSessionId: input.sessionId,
      phoneNumber: input.phoneNumber,
    });
  }

  private async buildHistory(
    input: ProcessIncomingMessageInput,
  ): Promise<{ history: AiConversationTurn[]; remoteJid: string | null }> {
    const messages = await this.whatsAppMessageRepository.findRecentBySessionAndNumber(
      input.sessionId,
      input.phoneNumber,
      HISTORY_LIMIT,
    );

    // A mensagem que acabou de chegar ja foi persistida pelo
    // BaileysWhatsAppProvider antes do evento ser emitido - ela e a ultima
    // da lista (ordem cronologica). Excluida do historico porque ja e
    // passada separadamente como userMessage - mas seu remoteJid e o
    // destino correto para a resposta (ver CLAUDE.md sobre @lid).
    const lastMessage = messages[messages.length - 1] ?? null;
    const history = messages.slice(0, -1).map(
      (message): AiConversationTurn => ({
        role: message.direction === 'IN' ? 'user' : 'assistant',
        content: message.body,
      }),
    );

    return { history, remoteJid: lastMessage?.remoteJid ?? null };
  }

  private mergeCollectedData(
    conversation: ViviConversationRecord,
    toolCalls: { name: string; input: Record<string, unknown> }[],
  ): ViviConversationUpdateInput {
    const collected: ViviConversationUpdateInput = {};

    for (const call of toolCalls) {
      if (call.name !== 'salvar_dados_lead') continue;

      const nome = call.input.nome;
      const tipoImovel = call.input.tipoImovel;
      const orcamento = call.input.orcamento;
      const regiao = call.input.regiao;
      const finalidade = call.input.finalidade;

      if (typeof nome === 'string' && nome.trim()) collected.nomeColetado = nome.trim();
      if (typeof tipoImovel === 'string' && tipoImovel.trim())
        collected.tipoImovelColetado = tipoImovel.trim();
      if (typeof orcamento === 'string' && orcamento.trim())
        collected.orcamentoColetado = orcamento.trim();
      if (typeof regiao === 'string' && regiao.trim()) collected.regiaoColetado = regiao.trim();
      if (typeof finalidade === 'string' && finalidade.trim())
        collected.finalidadeColetado = finalidade.trim();
    }

    return collected;
  }

  private async transferToBroker(
    input: ProcessIncomingMessageInput,
    conversation: ViviConversationRecord,
    collected: ViviConversationUpdateInput,
    motivo: string,
  ): Promise<string | null> {
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    const pipeline = pipelines[0];
    if (!pipeline) {
      // Situacao rara: tenant sem nenhum pipeline configurado ainda. A
      // conversa e marcada como transferida mesmo assim, so sem Card.
      this.logger.error(
        `Nao foi possivel criar o Card da VIVI: tenant ${input.tenantId} nao tem pipeline.`,
      );
      return null;
    }

    const nome = collected.nomeColetado ?? conversation.nomeColetado;
    const tipoImovel = collected.tipoImovelColetado ?? conversation.tipoImovelColetado;
    const orcamento = collected.orcamentoColetado ?? conversation.orcamentoColetado;
    const regiao = collected.regiaoColetado ?? conversation.regiaoColetado;
    const finalidade = collected.finalidadeColetado ?? conversation.finalidadeColetado;

    const card = await this.createQuickCardUseCase.execute({
      tenantId: input.tenantId,
      pipelineId: pipeline.id,
      title: nome || 'Lead via VIVI',
      origem: 'roleta_online',
      phone: input.phoneNumber,
    });

    const summaryLines = [
      'Lead qualificado pela VIVI (assistente de IA).',
      `Motivo da transferencia: ${motivo}.`,
      `Nome: ${nome ?? 'nao informado'}`,
      `Tipo de imovel: ${tipoImovel ?? 'nao informado'}`,
      `Orcamento: ${orcamento ?? 'nao informado'}`,
      `Regiao: ${regiao ?? 'nao informado'}`,
      `Finalidade: ${finalidade ?? 'nao informado'}`,
    ];

    await this.createNoteUseCase.execute({
      tenantId: input.tenantId,
      cardId: card.id,
      body: summaryLines.join('\n'),
    });

    return card.id;
  }

  private async transferToFila(
    input: ProcessIncomingMessageInput,
    remoteJid: string | null,
    filaCall: { name: string; input: Record<string, unknown> },
  ): Promise<void> {
    const categoria = String(filaCall.input.categoria ?? 'duvida_geral');
    const resumo = typeof filaCall.input.resumo === 'string' ? filaCall.input.resumo : undefined;
    const filaNome = CATEGORIA_TO_FILA_NOME[categoria] ?? CATEGORIA_TO_FILA_NOME.duvida_geral;

    // remoteJid deveria sempre vir preenchido a essa altura (a mensagem que
    // acabou de chegar ja foi persistida com remoteJid antes do evento ser
    // emitido) - fallback so cobre um cenario teorico de mensagem antiga.
    const jid = remoteJid ?? `${input.phoneNumber}@s.whatsapp.net`;

    const atendimento = await this.getOrCreateAtendimentoUseCase.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      remoteJid: jid,
      phoneNumber: input.phoneNumber,
    });

    await this.classifyAndRouteAtendimentoUseCase.execute({
      tenantId: input.tenantId,
      atendimentoId: atendimento.id,
      filaNome,
      resumo,
    });
  }
}
