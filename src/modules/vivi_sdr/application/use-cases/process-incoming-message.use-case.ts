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
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from '../../../atendimento/application/use-cases/classify-and-route-atendimento.use-case';
import { CATEGORIA_TO_FILA_NOME } from '../../../atendimento/domain/services/fila-categorias';
import { AgendarVisitaUseCase } from './agendar-visita.use-case';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';
import { classificarRenda, FaixasRenda } from '../../domain/services/classificar-renda';
import { buildResumoAtendimento } from '../../domain/services/build-resumo-atendimento';
import { buildViviSystemPrompt } from '../../constants/vivi-prompt';

// Nome fixo da coluna de deposito estrategico de leads sem perfil de renda
// para nenhuma faixa de financiamento hoje - ver
// create-default-pipeline.use-case.ts (modulo vendas_kanban).
const STAGE_REPIQUE_NOME = 'Repique';

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
    @Inject('IStageRepository')
    private readonly stageRepository: IStageRepository,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
    private readonly classifyAndRouteAtendimentoUseCase: ClassifyAndRouteAtendimentoUseCase,
    private readonly agendarVisitaUseCase: AgendarVisitaUseCase,
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
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
    const viviConfig = await this.getOrCreateViviConfigUseCase.execute({ tenantId: input.tenantId });

    const { history, remoteJid } = await this.buildHistory(input);
    // Sem isso, o modelo nao sabe a data de hoje e pode chutar o ano errado
    // ao interpretar uma data relativa/sem ano dita pelo lead (ex: "dia 17/07"
    // virou 2024 num teste real da Fatia 1 de agendar_visita).
    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const systemPrompt = `Hoje é ${today}.\n\n${buildViviSystemPrompt(viviConfig)}`;
    const { replyText, toolCalls } = await this.aiConversationService.generateReply({
      systemPrompt,
      history,
      userMessage: input.messageBody,
    });

    const collected = this.mergeCollectedData(conversation, toolCalls, viviConfig);
    const agendarVisitaCall = toolCalls.find((call) => call.name === 'agendar_visita');
    const transferCall = toolCalls.find((call) => call.name === 'transferir_para_corretor');
    const filaCall = toolCalls.find((call) => call.name === 'transferir_para_fila');
    const posVisitaCall = toolCalls.find((call) => call.name === 'salvar_dados_pos_visita');

    const updates: ViviConversationUpdateInput = { ...collected };

    if (posVisitaCall) {
      // Defesa em profundidade: mesmo que o prompt instrua a IA a so chamar
      // esta tool depois de agendar_visita, o codigo REJEITA (nao aplica
      // nenhum campo) se a conversa ainda nao tem visita agendada. So
      // registra um aviso - nunca derruba o processamento da mensagem.
      if (conversation.visitaAgendadaEm) {
        this.applyPostVisitaData(updates, posVisitaCall);
      } else {
        this.logger.warn(
          `[VIVI] Tool salvar_dados_pos_visita chamada para ${input.phoneNumber} (conversa ${conversation.id}) SEM visita agendada ainda - dados REJEITADOS.`,
        );
      }
    }

    if (agendarVisitaCall) {
      // Meta absoluta da VIVI (ver vivi-prompt.ts) - tem prioridade sobre as
      // demais tools se o modelo chamar mais de uma na mesma resposta.
      // Deliberadamente NAO seta updates.status: ao contrario de
      // transferir_para_corretor/transferir_para_fila, agendar uma visita
      // NAO encerra a conversa - a VIVI continua no "em_andamento" para
      // coletar os dados pos-visita (nascimento/email/tipo de renda/IR)
      // numa fatia futura.
      const dataVisita = String(agendarVisitaCall.input.dataVisita ?? '');
      const horario = String(agendarVisitaCall.input.horario ?? '');
      const imovelInteresse =
        typeof agendarVisitaCall.input.imovelInteresse === 'string'
          ? agendarVisitaCall.input.imovelInteresse
          : undefined;

      const resumo = buildResumoAtendimento({
        motivo: 'visita agendada',
        nome: collected.nomeColetado ?? conversation.nomeColetado,
        phoneNumber: input.phoneNumber,
        tipoImovel: collected.tipoImovelColetado ?? conversation.tipoImovelColetado,
        orcamento: collected.orcamentoColetado ?? conversation.orcamentoColetado,
        rendaDeclarada: collected.rendaDeclarada ?? conversation.rendaDeclarada,
        categoriaHabitacional: collected.categoriaHabitacional ?? conversation.categoriaHabitacional,
        regiao: collected.regiaoColetado ?? conversation.regiaoColetado,
        finalidade: collected.finalidadeColetado ?? conversation.finalidadeColetado,
        // Ainda nao temos o Date parseado (isso acontece dentro de
        // AgendarVisitaUseCase) - mostra o texto bruto extraido pela IA,
        // legivel do mesmo jeito para o corretor.
        visitaAgendadaEm: `${dataVisita} as ${horario}`,
        dataNascimento: collected.dataNascimento ?? conversation.dataNascimento,
        email: collected.email ?? conversation.email,
        tipoRenda: collected.tipoRenda ?? conversation.tipoRenda,
        fezDeclaracaoIR: collected.fezDeclaracaoIR ?? conversation.fezDeclaracaoIR,
        urgente: false,
      });

      const result = await this.agendarVisitaUseCase.execute({
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        dataVisita,
        horario,
        imovelInteresse,
        // Evita Card duplicado se a IA re-chamar agendar_visita num turno
        // seguinte da mesma conversa (observado em teste real) - ver
        // comentario em AgendarVisitaUseCase.
        existingCardId: conversation.cardId,
        resumo,
      });
      if (result) {
        updates.cardId = result.cardId;
        updates.visitaAgendadaEm = result.visitaAgendadaEm;
        // Nota de auditoria com o mesmo resumo (mesmo padrao ja usado em
        // transferToBroker) - reconfirmacoes em turnos seguintes acumulam
        // mais de uma nota, aceitavel (historico de cada confirmacao).
        await this.createNoteUseCase.execute({
          tenantId: input.tenantId,
          cardId: result.cardId,
          body: resumo,
        });
      }
    } else if (transferCall) {
      const motivo = String(transferCall.input.motivo ?? 'lead qualificado');
      updates.status =
        motivo === 'duvida especifica'
          ? 'duvida_transferido'
          : motivo === 'sem_perfil'
            ? 'repique'
            : 'qualificado_transferido';

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
    const toolsCalled =
      [
        agendarVisitaCall && 'agendar_visita',
        transferCall && 'transferir_para_corretor',
        filaCall && 'transferir_para_fila',
        posVisitaCall && 'salvar_dados_pos_visita',
      ]
        .filter((name): name is string => !!name)
        .join(',') || 'nenhuma';
    this.logger.log(
      `[VIVI] Mensagem de ${input.phoneNumber} processada (conversa ${conversation.id}): tool=${toolsCalled}`,
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
    faixasRenda: FaixasRenda,
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

      // Classificacao SEMPRE em codigo puro (classificarRenda), nunca
      // decidida pela IA - a IA so extrai o numero da conversa. Aceita
      // tanto number (o schema da tool pede number) quanto string (defesa
      // contra o modelo mandar "3500" como texto).
      const renda = this.parseRenda(call.input.rendaDeclarada);
      if (renda !== null) {
        collected.rendaDeclarada = renda;
        collected.categoriaHabitacional = classificarRenda(renda, faixasRenda);
      }
    }

    return collected;
  }

  private applyPostVisitaData(
    updates: ViviConversationUpdateInput,
    call: { name: string; input: Record<string, unknown> },
  ): void {
    const dataNascimento = call.input.dataNascimento;
    const email = call.input.email;
    const tipoRenda = call.input.tipoRenda;
    const fezDeclaracaoIR = call.input.fezDeclaracaoIR;

    if (typeof dataNascimento === 'string' && dataNascimento.trim())
      updates.dataNascimento = dataNascimento.trim();
    if (typeof email === 'string' && email.trim()) updates.email = email.trim();
    if (tipoRenda === 'CLT' || tipoRenda === 'AUTONOMO') updates.tipoRenda = tipoRenda;
    // So faz sentido preencher fezDeclaracaoIR quando tipoRenda e AUTONOMO
    // (ver vivi-prompt.ts, Passo 3 do loop de captura) - mas nao bloqueamos
    // aqui se a IA mandar fora de ordem, so aceitamos o boolean como veio.
    if (typeof fezDeclaracaoIR === 'boolean') updates.fezDeclaracaoIR = fezDeclaracaoIR;
  }

  private parseRenda(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
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
          `Stage "${STAGE_REPIQUE_NOME}" nao encontrada para tenant ${input.tenantId} - Card criado na Caixa de Entrada normalmente.`,
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
      phoneNumber: input.phoneNumber,
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

    const card = await this.createQuickCardUseCase.execute({
      tenantId: input.tenantId,
      pipelineId: pipeline.id,
      stageId,
      title: nome || 'Lead via VIVI',
      origem: motivo === 'sem_perfil' ? 'vivi_repique' : 'roleta_online',
      phone: input.phoneNumber,
      description: resumo,
    });

    await this.createNoteUseCase.execute({
      tenantId: input.tenantId,
      cardId: card.id,
      body: resumo,
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
    const urgente = filaCall.input.urgente === true;
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
      urgente,
    });
  }
}
