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
  AiToolCall,
} from '../../../../shared/domain/services/ai-conversation.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { CapturarLeadMinimoUseCase } from '../../../vendas_kanban/application/use-cases/capturar-lead-minimo.use-case';
import { PromoverLeadMinimoUseCase } from '../../../vendas_kanban/application/use-cases/promover-lead-minimo.use-case';
import { CreateNoteUseCase } from '../../../vendas_kanban/application/use-cases/create-note.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from '../../../atendimento/application/use-cases/classify-and-route-atendimento.use-case';
import {
  CATEGORIA_TO_FILA_NOME,
  FILA_ATENDIMENTO_PRIORITARIO_NOME,
} from '../../../atendimento/domain/services/fila-categorias';
import { AgendarVisitaUseCase } from './agendar-visita.use-case';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';
import { RegistrarUsoViviUseCase } from './registrar-uso-vivi.use-case';
import { classificarRenda, FaixasRenda } from '../../domain/services/classificar-renda';
import { buildResumoAtendimento } from '../../domain/services/build-resumo-atendimento';
import { buildViviSystemPrompt } from '../../constants/vivi-prompt';
import {
  BuscarEmpreendimentoPorEnderecoUseCase,
  BuscaEmpreendimentoResultado,
} from '../../../gestao_imobiliaria/application/use-cases/buscar-empreendimento-por-endereco.use-case';
import { IEnderecoBuscaLogRepository } from '../../domain/repositories/endereco-busca-log-repository.interface';
import { ehPedidoDeOptOut } from '../../../vendas_kanban/domain/services/repique-optout-detector';

// Nome fixo da coluna de deposito estrategico de leads sem perfil de renda
// para nenhuma faixa de financiamento hoje - ver
// create-default-pipeline.use-case.ts (modulo vendas_kanban).
const STAGE_REPIQUE_NOME = 'Repique';

interface ProcessIncomingMessageInput {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  messageBody: string;
  // Nome de exibicao do WhatsApp do contato (ver BaileysWhatsAppProvider) -
  // usado pela captura automatica de lead minimo (funil de remarketing) e
  // pelo Nivel 2 do prompt da VIVI (confirmar o nome em vez de perguntar do
  // zero). Ausente em chamadas antigas/testes que nao o preenchem.
  pushName?: string | null;
}

// Resultado de UMA chamada da tool "buscar_empreendimento_por_endereco" -
// coletado durante o resolveTool (ver execute()) e so gravado no
// EnderecoBuscaLog depois, quando ja sabemos se a mesma resposta tambem
// escalou para corretor/fila (ver bloco de log no fim de execute()).
interface EnderecoBuscaResultado {
  enderecoBuscado: string;
  encontradoCatalogo: boolean;
  nomeEncontradoCatalogo: string | null;
  precisouBuscaExterna: boolean;
  confirmadoExternamente: boolean | null;
  nomeEncontradoExterno: string | null;
}

const HISTORY_LIMIT = 21; // 20 mensagens de historico + a mensagem atual

// Rede de seguranca para falha tecnica da IA (auditoria de producao,
// Critico #1) - enviada ao lead quando generateReply falha mesmo apos o
// SDK esgotar as tentativas de retry automatico (ver
// AnthropicConversationService, comentario no construtor). Texto
// confirmado com o usuario antes de implementar (nao technical-sounding,
// define expectativa sem prometer prazo especifico).
const AI_FALLBACK_MESSAGE =
  'Estou com uma instabilidade no momento. Um de nossos atendentes vai te responder em breve.';

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
    private readonly capturarLeadMinimoUseCase: CapturarLeadMinimoUseCase,
    private readonly promoverLeadMinimoUseCase: PromoverLeadMinimoUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
    private readonly classifyAndRouteAtendimentoUseCase: ClassifyAndRouteAtendimentoUseCase,
    private readonly agendarVisitaUseCase: AgendarVisitaUseCase,
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
    private readonly registrarUsoViviUseCase: RegistrarUsoViviUseCase,
    private readonly buscarEmpreendimentoPorEnderecoUseCase: BuscarEmpreendimentoPorEnderecoUseCase,
    @Inject('IEnderecoBuscaLogRepository')
    private readonly enderecoBuscaLogRepository: IEnderecoBuscaLogRepository,
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

    // Captura automatica de lead minimo (funil de remarketing) - roda
    // INDEPENDENTE de qualquer tool call da IA (por isso aqui, antes de
    // qualquer chamada a IA), so cria o Card se este telefone ainda nao
    // tiver NENHUM Card em NENHUM pipeline (checagem interna,
    // idempotente). Nunca lanca excecao nem atrasa a resposta - ver
    // CapturarLeadMinimoUseCase.
    await this.capturarLeadMinimoUseCase.execute({
      tenantId: input.tenantId,
      phoneNumber: input.phoneNumber,
      pushName: input.pushName,
    });

    const conversation = await this.findOrCreateConversation(input);
    const viviConfig = await this.getOrCreateViviConfigUseCase.execute({ tenantId: input.tenantId });

    const { history, remoteJid } = await this.buildHistory(input);

    // Guarda 3: pedido de descadastro (opt-out, LGPD) de uma campanha de
    // Repique ativa - verificado ANTES de qualquer outro fluxo da VIVI
    // (nem chama a IA). So se aplica a numeros com card ATIVO na stage
    // "Repique" e ainda nao descadastrado - mensagens de leads em
    // qualificacao normal nao passam por aqui. Deteccao por palavra-chave
    // (nao pela IA) de proposito - decisao de compliance precisa ser
    // deterministica, ver domain/services/repique-optout-detector.ts.
    if (input.phoneNumber) {
      const repiqueCard = await this.cardRepository.findRepiqueCardByTenantAndPhone(
        input.tenantId,
        input.phoneNumber,
      );
      if (repiqueCard && !repiqueCard.repiqueOptOut && ehPedidoDeOptOut(input.messageBody)) {
        await this.cardRepository.markRepiqueOptOut(repiqueCard.id);
        this.logger.log(
          `[VIVI] Opt-out de campanha de Repique confirmado para ${input.phoneNumber} (card ${repiqueCard.id}).`,
        );
        await this.sendWhatsAppMessageUseCase.execute({
          sessionId: input.sessionId,
          tenantId: input.tenantId,
          to: remoteJid ?? input.phoneNumber,
          phoneNumber: input.phoneNumber,
          body: 'Combinado! Você não vai mais receber nossas mensagens de remarketing. Se mudar de ideia, é só chamar por aqui.',
        });
        return;
      }
    }

    // Sem isso, o modelo nao sabe a data de hoje e pode chutar o ano errado
    // ao interpretar uma data relativa/sem ano dita pelo lead (ex: "dia 17/07"
    // virou 2024 num teste real da Fatia 1 de agendar_visita).
    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // Nivel 2 da captura automatica: so sugere o nome via pushName se o
    // lead ainda nao confirmou o proprio nome nesta conversa (evita a VIVI
    // "confirmar" um nome que ja foi confirmado ha turnos atras).
    const nomeSugerido = conversation.nomeColetado ? null : input.pushName?.trim() || null;
    const systemPrompt = `Hoje é ${today}.\n\n${buildViviSystemPrompt(viviConfig, undefined, nomeSugerido)}`;

    // Coletado pelo resolveTool abaixo (buscar_empreendimento_por_endereco)
    // - so gravado no EnderecoBuscaLog depois de sabermos se esta mesma
    // resposta tambem escalou para corretor/fila (ver bloco de log adiante).
    // Array (nao um unico valor) para cobrir o caso raro do modelo chamar a
    // tool mais de uma vez na mesma resposta.
    const enderecoBuscaResultados: EnderecoBuscaResultado[] = [];

    // Contador de custo/volume (Fatia B) - conta a TENTATIVA de chamada a
    // IA, nao so as bem-sucedidas, ja que uma chamada que falha so depois de
    // esgotar os retries do SDK (ver handleAiFailure abaixo) tambem consome
    // tokens. Nunca lanca excecao nem atrasa a resposta (ver
    // RegistrarUsoViviUseCase).
    await this.registrarUsoViviUseCase.execute({ tenantId: input.tenantId, numero: input.phoneNumber });

    let generateReplyResult: { replyText: string; toolCalls: AiToolCall[] };
    try {
      generateReplyResult = await this.aiConversationService.generateReply({
        systemPrompt,
        history,
        userMessage: input.messageBody,
        resolveTool: async (toolName, toolInput) =>
          this.resolveTool(toolName, toolInput, input.tenantId, enderecoBuscaResultados),
      });
    } catch (error) {
      // A API da Anthropic ja esgotou as proprias tentativas de retry (ver
      // AnthropicConversationService) - essa excecao e definitiva. Nunca
      // deixa o lead sem resposta nenhuma: manda uma mensagem de fallback
      // e encaminha para atendimento humano prioritario (ver
      // handleAiFailure). Reaproveita o mesmo caminho de codigo de
      // transferToFila, so com uma fila e um resumo diferentes.
      await this.handleAiFailure(input, conversation, remoteJid, error);
      return;
    }
    const { replyText, toolCalls } = generateReplyResult;

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

    if (enderecoBuscaResultados.length > 0) {
      // Escalonamento e propriedade da RESPOSTA inteira, nao de cada busca
      // individual - se o modelo chamou buscar_empreendimento_por_endereco
      // e (na mesma resposta) transferir_para_fila/transferir_para_corretor,
      // TODAS as buscas desta resposta sao registradas com o mesmo motivo.
      const escalonado = Boolean(filaCall) || Boolean(transferCall);
      const motivoEscalonamento = filaCall
        ? filaCall.input.urgente === true
          ? 'urgencia/pedido explicito'
          : `fila:${String(filaCall.input.categoria ?? '')}`
        : transferCall
          ? `corretor:${String(transferCall.input.motivo ?? '')}`
          : null;

      for (const resultado of enderecoBuscaResultados) {
        await this.enderecoBuscaLogRepository.create({
          tenantId: input.tenantId,
          phoneNumber: input.phoneNumber,
          ...resultado,
          escalonado,
          motivoEscalonamento,
        });
      }
    }

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
        phoneNumber: input.phoneNumber,
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
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        targetPipelineId: pipeline.id,
        targetStageId: stageId,
        position: 0,
        title: tituloCard,
        description: resumo,
        origem,
        motivoRepique: motivo === 'sem_perfil' ? 'SEM_PERFIL' : null,
      })) ??
      (await this.createQuickCardUseCase.execute({
        tenantId: input.tenantId,
        pipelineId: pipeline.id,
        stageId,
        title: tituloCard,
        origem,
        phone: input.phoneNumber,
        description: resumo,
        // Mesmo motivo ja usado pelo modal manual e pelo job de inatividade
        // de 90 dias (ver vendas_kanban/domain/services/motivo-repique.ts) -
        // so quando o card ja nasce direto na stage "Repique" (stageId
        // preenchido acima, motivo "sem_perfil").
        motivoRepique: motivo === 'sem_perfil' ? 'SEM_PERFIL' : undefined,
      }));

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

  // Rede de seguranca para falha tecnica da IA (auditoria de producao,
  // Critico #1) - chamada quando generateReply lanca uma excecao definitiva
  // (API da Anthropic ja esgotou as proprias tentativas de retry, ver
  // AnthropicConversationService). Mesmo caminho de transferToFila
  // (getOrCreateAtendimentoUseCase + classifyAndRouteAtendimentoUseCase),
  // so com a fila dedicada FILA_ATENDIMENTO_PRIORITARIO_NOME e sempre
  // urgente=true - o lead precisa de resposta humana o quanto antes, ja que
  // a VIVI nao respondeu nada nesse turno.
  private async handleAiFailure(
    input: ProcessIncomingMessageInput,
    conversation: ViviConversationRecord,
    remoteJid: string | null,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `[VIVI] Falha definitiva na chamada a IA para ${input.phoneNumber} (conversa ${conversation.id}), apos esgotar os retries do SDK: ${errorMessage}`,
    );

    const jid = remoteJid ?? `${input.phoneNumber}@s.whatsapp.net`;

    // Nunca deixa o lead sem NENHUMA resposta - mesmo mecanismo ja usado
    // pelo opt-out de Repique acima (sendWhatsAppMessageUseCase direto,
    // sem passar por generateReply).
    try {
      await this.sendWhatsAppMessageUseCase.execute({
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        to: jid,
        phoneNumber: input.phoneNumber,
        body: AI_FALLBACK_MESSAGE,
      });
    } catch (sendError) {
      // Se ate o envio do fallback falhar (ex: sessao do WhatsApp caiu
      // junto), so registra - o roteamento para a fila prioritaria abaixo
      // ainda e o mais importante e nao pode ser bloqueado por isso.
      this.logger.error(
        `[VIVI] Falha ao enviar mensagem de fallback para ${input.phoneNumber}: ${
          sendError instanceof Error ? sendError.message : sendError
        }`,
      );
    }

    const atendimento = await this.getOrCreateAtendimentoUseCase.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      remoteJid: jid,
      phoneNumber: input.phoneNumber,
    });

    // resumo vira o detalhe do AtendimentoEvento (ver ClassifyAndRouteAtendimentoUseCase)
    // - unico rastro persistente (alem do log acima, que so sobrevive no
    // stdout) do motivo tecnico real por tras deste atendimento, visivel
    // para quem for atende-lo na Central de Atendimento.
    await this.classifyAndRouteAtendimentoUseCase.execute({
      tenantId: input.tenantId,
      atendimentoId: atendimento.id,
      filaNome: FILA_ATENDIMENTO_PRIORITARIO_NOME,
      resumo: `Falha tecnica da IA (nao decisao da VIVI): ${errorMessage}. Ultima mensagem do lead: "${input.messageBody}"`,
      urgente: true,
    });

    // Mesmo status usado por um handoff normal para fila (transferToFila) -
    // impede a VIVI de reabrir o dialogo neste numero enquanto o
    // atendimento humano nao for concluido (ver Guarda 1, inicio de
    // execute()), mesmo que a proxima mensagem chegue antes de alguem
    // assumir o atendimento prioritario.
    await this.viviConversationRepository.update(conversation.id, {
      status: 'encaminhado_fila',
    });
  }

  // Chamado pelo AnthropicConversationService (parametro resolveTool de
  // generateReply) para CADA tool_use da resposta - so
  // "buscar_empreendimento_por_endereco" tem um resultado real (as demais
  // tools continuam recebendo o "ok" generico, ver retorno null). Empilha
  // o resultado estruturado em enderecoBuscaResultados para o log ser
  // gravado depois, ja com a informacao de escalonamento da resposta inteira.
  private async resolveTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    tenantId: string,
    enderecoBuscaResultados: EnderecoBuscaResultado[],
  ): Promise<string | null> {
    if (toolName !== 'buscar_empreendimento_por_endereco') {
      return null;
    }

    const endereco = typeof toolInput.endereco === 'string' ? toolInput.endereco.trim() : '';
    if (!endereco) {
      return 'NAO FOI POSSIVEL PROCESSAR A BUSCA: endereco nao informado.';
    }
    const pularBuscaExterna = toolInput.pularBuscaExterna === true;

    const resultadoCatalogo = await this.buscarEmpreendimentoPorEnderecoUseCase.execute({
      tenantId,
      enderecoBusca: endereco,
    });

    if (resultadoCatalogo.encontrado) {
      enderecoBuscaResultados.push({
        enderecoBuscado: endereco,
        encontradoCatalogo: true,
        nomeEncontradoCatalogo: resultadoCatalogo.nome,
        precisouBuscaExterna: false,
        confirmadoExternamente: null,
        nomeEncontradoExterno: null,
      });
      return this.formatCatalogoEncontrado(resultadoCatalogo);
    }

    // Escalonamento urgente na mesma mensagem (ver secao "Atendimento
    // urgente" do prompt) - so busca no catalogo proprio, sem busca externa,
    // pra nao atrasar a transferencia para a fila/corretor humano.
    if (pularBuscaExterna) {
      enderecoBuscaResultados.push({
        enderecoBuscado: endereco,
        encontradoCatalogo: false,
        nomeEncontradoCatalogo: null,
        precisouBuscaExterna: false,
        confirmadoExternamente: null,
        nomeEncontradoExterno: null,
      });
      return (
        'NAO ENCONTRADO NO CATALOGO PROPRIO. Busca externa NAO realizada ' +
        '(escalonamento urgente tem prioridade) - o corretor humano vai verificar esse endereco.'
      );
    }

    const confirmacao = await this.aiConversationService.confirmarExistenciaEmpreendimento(endereco);
    enderecoBuscaResultados.push({
      enderecoBuscado: endereco,
      encontradoCatalogo: false,
      nomeEncontradoCatalogo: null,
      precisouBuscaExterna: true,
      confirmadoExternamente: confirmacao.confirmado,
      nomeEncontradoExterno: confirmacao.nomeEncontrado,
    });

    if (confirmacao.confirmado) {
      const nomeTexto = confirmacao.nomeEncontrado
        ? `um empreendimento chamado "${confirmacao.nomeEncontrado}"`
        : 'algum empreendimento/imovel';
      return (
        'NAO ENCONTRADO NO CATALOGO PROPRIO.\n' +
        `BUSCA EXTERNA: confirmado que existe ${nomeTexto} nesse endereco ` +
        '(fonte externa - NAO mencionar preco/condicoes/disponibilidade dessa fonte).'
      );
    }

    return (
      'NAO ENCONTRADO NO CATALOGO PROPRIO.\n' +
      'BUSCA EXTERNA: NAO foi possivel confirmar a existencia de nenhum empreendimento nesse endereco.'
    );
  }

  private formatCatalogoEncontrado(resultado: BuscaEmpreendimentoResultado): string {
    const precoTexto =
      resultado.precoDesde !== null
        ? `R$ ${resultado.precoDesde.toLocaleString('pt-BR')}`
        : 'nao informado';

    const linhas = [
      'ENCONTRADO NO CATALOGO PROPRIO.',
      `Nome: ${resultado.nome ?? 'nao informado'}`,
      `Diferenciais: ${resultado.diferenciais ?? 'nao informado'}`,
      `Status: ${resultado.statusResumo ?? 'nao informado'}`,
      resultado.tipo === 'empreendimento' ? `Unidades disponiveis: ${resultado.unidadesDisponiveis ?? 0}` : null,
      `Preco a partir de: ${precoTexto}`,
    ];

    return linhas.filter((linha): linha is string => linha !== null).join('\n');
  }
}
