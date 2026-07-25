// src/modules/vivi_sdr/application/use-cases/process-incoming-social-message.use-case.ts
// Papel paralelo ao de ProcessIncomingMessageUseCase (WhatsApp), para DMs
// recebidas via Instagram Direct/Facebook Messenger (ver
// SocialMessageReceivedListener). Reaproveita a MESMA "mente" da VIVI -
// IAiConversationService, o mesmo conjunto de tools/prompt
// (buildViviSystemPrompt), classificarRenda, buildResumoAtendimento,
// CreateQuickCardUseCase/CreateNoteUseCase, AgendarVisitaUseCase,
// BuscarEmpreendimentoPorEnderecoUseCase/IEnderecoBuscaLogRepository - mas
// com persistencia PROPRIA (SocialConversation/SocialMessage, ver schema.prisma)
// e envio de resposta via IMessageDispatcher (Canal.INSTAGRAM/FACEBOOK) em
// vez de SendWhatsAppMessageUseCase.
//
// DECISAO DELIBERADA (confirmada com o usuario antes de implementar): a
// tool "transferir_para_fila" (escalonamento para a Central de Atendimento
// humana) NAO cria/atualiza nenhum Atendimento aqui - esse modulo continua
// 100% acoplado ao WhatsApp (whatsappSessionId/remoteJid obrigatorios no
// schema, ver CLAUDE.md). Para leads via Instagram/Facebook, a escalacao e
// so LOGADA (visibilidade futura) e a VIVI CONTINUA a conversa normalmente,
// sozinha - por isso, ao contrario do WhatsApp, este branch NAO marca a
// conversa como "encaminhado_fila" (isso interromperia a VIVI para sempre
// neste lead, ja que nao existe fila humana real para "devolver" a
// conversa depois).
//
// Identificador do lead (PSID do Messenger / IGSID do Instagram) e reutilizado
// como "phone"/"phoneNumber" em toda a integracao com vendas_kanban (Card.phone,
// ICardRepository.existsByTenantAndPhoneWithOwner/findRepiqueCardByTenantAndPhone)
// e EnderecoBuscaLog - esses campos ja sao texto livre, sem validacao de
// formato de telefone, entao reaproveitar o mesmo "encaixe" evita duplicar
// metodos de repositorio so para trocar o nome do parametro. O guard de
// opt-out de campanha de Repique (fluxo exclusivo de WhatsApp/E-mail - ver
// RepiqueCampanhaEnvio.canal em schema.prisma) e deliberadamente OMITIDO
// aqui (nao existe campanha de Repique via Instagram/Facebook nesta fatia).
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ISocialConversationRepository,
  SocialConversationRecord,
  SocialConversationUpdateInput,
} from '../../domain/repositories/social-conversation-repository.interface';
import { ISocialMessageRepository } from '../../../social_media/domain/repositories/social-message-repository.interface';
import {
  IAiConversationService,
  AiConversationTurn,
} from '../../../../shared/domain/services/ai-conversation.interface';
import { IMessageDispatcher } from '../../../../shared/domain/services/message-dispatcher.interface';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { CreateNoteUseCase } from '../../../vendas_kanban/application/use-cases/create-note.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IStageRepository } from '../../../vendas_kanban/domain/repositories/stage-repository.interface';
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

const STAGE_REPIQUE_NOME = 'Repique';
const HISTORY_LIMIT = 21; // 20 mensagens de historico + a mensagem atual

interface ProcessIncomingSocialMessageInput {
  tenantId: string;
  canal: Canal.INSTAGRAM | Canal.FACEBOOK;
  socialAccountId: string;
  identificadorExterno: string;
  mensagem: string;
}

interface EnderecoBuscaResultado {
  enderecoBuscado: string;
  encontradoCatalogo: boolean;
  nomeEncontradoCatalogo: string | null;
  precisouBuscaExterna: boolean;
  confirmadoExternamente: boolean | null;
  nomeEncontradoExterno: string | null;
}

function canalDescricao(canal: Canal.INSTAGRAM | Canal.FACEBOOK): string {
  return canal === Canal.INSTAGRAM ? 'via Direct do Instagram' : 'via Messenger do Facebook';
}

function contatoLabel(canal: Canal.INSTAGRAM | Canal.FACEBOOK): string {
  return canal === Canal.INSTAGRAM ? 'ID Instagram' : 'ID Facebook';
}

function origemLead(canal: Canal.INSTAGRAM | Canal.FACEBOOK): string {
  return canal === Canal.INSTAGRAM ? 'instagram_dm' : 'facebook_dm';
}

@Injectable()
export class ProcessIncomingSocialMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingSocialMessageUseCase.name);

  constructor(
    @Inject('ISocialConversationRepository')
    private readonly socialConversationRepository: ISocialConversationRepository,
    @Inject('ISocialMessageRepository')
    private readonly socialMessageRepository: ISocialMessageRepository,
    @Inject('IAiConversationService')
    private readonly aiConversationService: IAiConversationService,
    @Inject('IMessageDispatcher')
    private readonly messageDispatcher: IMessageDispatcher,
    @Inject('IPipelineRepository')
    private readonly pipelineRepository: IPipelineRepository,
    @Inject('ICardRepository')
    private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository')
    private readonly stageRepository: IStageRepository,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly agendarVisitaUseCase: AgendarVisitaUseCase,
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
    private readonly registrarUsoViviUseCase: RegistrarUsoViviUseCase,
    private readonly buscarEmpreendimentoPorEnderecoUseCase: BuscarEmpreendimentoPorEnderecoUseCase,
    @Inject('IEnderecoBuscaLogRepository')
    private readonly enderecoBuscaLogRepository: IEnderecoBuscaLogRepository,
  ) {}

  async execute(input: ProcessIncomingSocialMessageInput): Promise<void> {
    // Guarda 1: mesma logica do WhatsApp (ver ProcessIncomingMessageUseCase)
    // - nao reabre dialogo se a conversa mais recente ja foi transferida
    // para um corretor (status diferente de em_andamento/encerrada). Como
    // "encaminhado_fila" nunca e setado por este use case (ver decisao no
        // topo do arquivo), essa guarda so bloqueia apos transferir_para_corretor.
    const latestConversation = await this.socialConversationRepository.findLatestByAccountAndExternalId(
      input.socialAccountId,
      input.identificadorExterno,
    );
    if (
      latestConversation &&
      latestConversation.status !== 'em_andamento' &&
      latestConversation.status !== 'encerrada'
    ) {
      this.logger.log(
        `[VIVI-SOCIAL] Mensagem ignorada para ${input.identificadorExterno} (${input.canal}): conversa ja ${latestConversation.status}.`,
      );
      return;
    }

    // Guarda 2: mesma logica do WhatsApp - lead ja tem Card com corretor
    // responsavel (Card.phone reaproveitado com o identificadorExterno,
    // ver comentario no topo do arquivo).
    const hasActiveCard = await this.cardRepository.existsByTenantAndPhoneWithOwner(
      input.tenantId,
      input.identificadorExterno,
    );
    if (hasActiveCard) {
      this.logger.log(
        `[VIVI-SOCIAL] Mensagem ignorada para ${input.identificadorExterno} (${input.canal}): lead ja tem Card com corretor responsavel.`,
      );
      return;
    }

    const conversation = await this.findOrCreateConversation(input);
    const viviConfig = await this.getOrCreateViviConfigUseCase.execute({ tenantId: input.tenantId });
    const history = await this.buildHistory(input.socialAccountId, input.identificadorExterno);

    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const systemPrompt = `Hoje é ${today}.\n\n${buildViviSystemPrompt(viviConfig, canalDescricao(input.canal))}`;

    const enderecoBuscaResultados: EnderecoBuscaResultado[] = [];

    // Contador de custo/volume (Fatia B) - mesmo total diario do tenant
    // somado pelo canal WhatsApp (ver ProcessIncomingMessageUseCase), ja que
    // o custo na Anthropic nao distingue canal. Nunca lanca excecao nem
    // atrasa a resposta (ver RegistrarUsoViviUseCase).
    await this.registrarUsoViviUseCase.execute({
      tenantId: input.tenantId,
      numero: input.identificadorExterno,
    });

    const { replyText, toolCalls } = await this.aiConversationService.generateReply({
      systemPrompt,
      history,
      userMessage: input.mensagem,
      resolveTool: async (toolName, toolInput) =>
        this.resolveTool(toolName, toolInput, input.tenantId, input.identificadorExterno, enderecoBuscaResultados),
    });

    const collected = this.mergeCollectedData(conversation, toolCalls, viviConfig);
    const agendarVisitaCall = toolCalls.find((call) => call.name === 'agendar_visita');
    const transferCall = toolCalls.find((call) => call.name === 'transferir_para_corretor');
    const filaCall = toolCalls.find((call) => call.name === 'transferir_para_fila');
    const posVisitaCall = toolCalls.find((call) => call.name === 'salvar_dados_pos_visita');

    const updates: SocialConversationUpdateInput = { ...collected };

    if (posVisitaCall) {
      if (conversation.visitaAgendadaEm) {
        this.applyPostVisitaData(updates, posVisitaCall);
      } else {
        this.logger.warn(
          `[VIVI-SOCIAL] Tool salvar_dados_pos_visita chamada para ${input.identificadorExterno} (conversa ${conversation.id}) SEM visita agendada ainda - dados REJEITADOS.`,
        );
      }
    }

    if (agendarVisitaCall) {
      const dataVisita = String(agendarVisitaCall.input.dataVisita ?? '');
      const horario = String(agendarVisitaCall.input.horario ?? '');
      const imovelInteresse =
        typeof agendarVisitaCall.input.imovelInteresse === 'string'
          ? agendarVisitaCall.input.imovelInteresse
          : undefined;

      const resumo = buildResumoAtendimento({
        motivo: 'visita agendada',
        nome: collected.nomeColetado ?? conversation.nomeColetado,
        phoneNumber: input.identificadorExterno,
        contatoLabel: contatoLabel(input.canal),
        tipoImovel: collected.tipoImovelColetado ?? conversation.tipoImovelColetado,
        orcamento: collected.orcamentoColetado ?? conversation.orcamentoColetado,
        rendaDeclarada: collected.rendaDeclarada ?? conversation.rendaDeclarada,
        categoriaHabitacional: collected.categoriaHabitacional ?? conversation.categoriaHabitacional,
        regiao: collected.regiaoColetado ?? conversation.regiaoColetado,
        finalidade: collected.finalidadeColetado ?? conversation.finalidadeColetado,
        visitaAgendadaEm: `${dataVisita} as ${horario}`,
        dataNascimento: collected.dataNascimento ?? conversation.dataNascimento,
        email: collected.email ?? conversation.email,
        tipoRenda: collected.tipoRenda ?? conversation.tipoRenda,
        fezDeclaracaoIR: collected.fezDeclaracaoIR ?? conversation.fezDeclaracaoIR,
        urgente: false,
      });

      const result = await this.agendarVisitaUseCase.execute({
        tenantId: input.tenantId,
        phoneNumber: input.identificadorExterno,
        dataVisita,
        horario,
        imovelInteresse,
        existingCardId: conversation.cardId,
        resumo,
      });
      if (result) {
        updates.cardId = result.cardId;
        updates.visitaAgendadaEm = result.visitaAgendadaEm;
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
      // Ver decisao registrada no topo do arquivo: NAO cria/atualiza
      // Atendimento (modulo acoplado a WhatsApp) e NAO encerra a conversa -
      // so loga a escalacao para visibilidade futura. A VIVI continua
      // respondendo normalmente (replyText desta mesma resposta, enviado
      // no fim do metodo).
      const categoria = String(filaCall.input.categoria ?? 'duvida_geral');
      const urgente = filaCall.input.urgente === true;
      this.logger.warn(
        `[VIVI-SOCIAL] Escalacao solicitada (categoria=${categoria}, urgente=${urgente}) para lead ${input.identificadorExterno} via ${input.canal} - Central de Atendimento so suporta WhatsApp nesta fatia, conversa continua normalmente com a VIVI.`,
      );
    }

    const toolsCalled =
      [
        agendarVisitaCall && 'agendar_visita',
        transferCall && 'transferir_para_corretor',
        filaCall && 'transferir_para_fila (log-only)',
        posVisitaCall && 'salvar_dados_pos_visita',
      ]
        .filter((name): name is string => !!name)
        .join(',') || 'nenhuma';
    this.logger.log(
      `[VIVI-SOCIAL] Mensagem de ${input.identificadorExterno} (${input.canal}) processada (conversa ${conversation.id}): tool=${toolsCalled}`,
    );

    if (enderecoBuscaResultados.length > 0) {
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
          phoneNumber: input.identificadorExterno,
          ...resultado,
          escalonado,
          motivoEscalonamento,
        });
      }
    }

    await this.socialConversationRepository.update(conversation.id, updates);

    if (replyText.trim()) {
      await this.messageDispatcher.enviar({
        canal: input.canal,
        tenantId: input.tenantId,
        destinatario: input.identificadorExterno,
        conteudo: replyText,
        socialAccountId: input.socialAccountId,
      });
    }
  }

  private async findOrCreateConversation(
    input: ProcessIncomingSocialMessageInput,
  ): Promise<SocialConversationRecord> {
    const existing = await this.socialConversationRepository.findActiveByAccountAndExternalId(
      input.socialAccountId,
      input.identificadorExterno,
    );
    if (existing) {
      return existing;
    }

    return this.socialConversationRepository.create({
      tenantId: input.tenantId,
      socialAccountId: input.socialAccountId,
      identificadorExterno: input.identificadorExterno,
    });
  }

  private async buildHistory(
    socialAccountId: string,
    identificadorExterno: string,
  ): Promise<AiConversationTurn[]> {
    const messages = await this.socialMessageRepository.findRecentByAccountAndExternalId(
      socialAccountId,
      identificadorExterno,
      HISTORY_LIMIT,
    );

    // A mensagem que acabou de chegar ja foi persistida (IN) pelo
    // ProcessMetaWebhookEventUseCase antes do evento 'mensagem.recebida'
    // ser emitido - e a ultima da lista (ordem cronologica), excluida aqui
    // porque ja e passada separadamente como userMessage.
    return messages.slice(0, -1).map(
      (message): AiConversationTurn => ({
        role: message.direction === 'IN' ? 'user' : 'assistant',
        content: message.body,
      }),
    );
  }

  private mergeCollectedData(
    conversation: SocialConversationRecord,
    toolCalls: { name: string; input: Record<string, unknown> }[],
    faixasRenda: FaixasRenda,
  ): SocialConversationUpdateInput {
    const collected: SocialConversationUpdateInput = {};

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

      const renda = this.parseRenda(call.input.rendaDeclarada);
      if (renda !== null) {
        collected.rendaDeclarada = renda;
        collected.categoriaHabitacional = classificarRenda(renda, faixasRenda);
      }
    }

    return collected;
  }

  private applyPostVisitaData(
    updates: SocialConversationUpdateInput,
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
    input: ProcessIncomingSocialMessageInput,
    conversation: SocialConversationRecord,
    collected: SocialConversationUpdateInput,
    motivo: string,
  ): Promise<string | null> {
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    const pipeline = pipelines[0];
    if (!pipeline) {
      this.logger.error(
        `Nao foi possivel criar o Card da VIVI (social): tenant ${input.tenantId} nao tem pipeline.`,
      );
      return null;
    }

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
      phoneNumber: input.identificadorExterno,
      contatoLabel: contatoLabel(input.canal),
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
      title: nome || `Lead via VIVI (${input.canal})`,
      origem: motivo === 'sem_perfil' ? 'vivi_repique' : origemLead(input.canal),
      phone: input.identificadorExterno,
      description: resumo,
      motivoRepique: motivo === 'sem_perfil' ? 'SEM_PERFIL' : undefined,
    });

    await this.createNoteUseCase.execute({
      tenantId: input.tenantId,
      cardId: card.id,
      body: resumo,
    });

    return card.id;
  }

  private async resolveTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    tenantId: string,
    identificadorExterno: string,
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
