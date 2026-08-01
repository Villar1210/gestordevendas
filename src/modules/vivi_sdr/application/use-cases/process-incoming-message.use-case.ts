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
import { CapturarLeadMinimoUseCase } from '../../../vendas_kanban/application/use-cases/capturar-lead-minimo.use-case';
import { CreateNoteUseCase } from '../../../vendas_kanban/application/use-cases/create-note.use-case';
import { AgendarVisitaUseCase } from './agendar-visita.use-case';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';
import { RegistrarUsoViviUseCase } from './registrar-uso-vivi.use-case';
import { mergeCollectedData, applyPostVisitaData } from '../../domain/services/vivi-lead-data-merger';
import { deveIgnorarPorConversaTransferida } from '../../domain/services/vivi-conversation-guard';
import { buildResumoAtendimento } from '../../domain/services/build-resumo-atendimento';
import { buildViviSystemPrompt } from '../../constants/vivi-prompt';
import {
  EnderecoBuscaToolResolverService,
  EnderecoBuscaResultado,
} from '../services/endereco-busca-tool-resolver.service';
import { TransferToBrokerService } from '../services/transfer-to-broker.service';
import { ViviAtendimentoEscalationService } from '../services/vivi-atendimento-escalation.service';
import { ViviMessageGuardsService } from '../services/vivi-message-guards.service';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';

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
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    private readonly capturarLeadMinimoUseCase: CapturarLeadMinimoUseCase,
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly agendarVisitaUseCase: AgendarVisitaUseCase,
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
    private readonly registrarUsoViviUseCase: RegistrarUsoViviUseCase,
    private readonly enderecoBuscaToolResolverService: EnderecoBuscaToolResolverService,
    private readonly transferToBrokerService: TransferToBrokerService,
    private readonly viviAtendimentoEscalationService: ViviAtendimentoEscalationService,
    private readonly viviMessageGuardsService: ViviMessageGuardsService,
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
    if (latestConversation && deveIgnorarPorConversaTransferida(latestConversation.status)) {
      this.logger.log(
        `[VIVI] Mensagem ignorada para ${input.phoneNumber}: conversa ja ${latestConversation.status} (nao reabre dialogo enquanto corretor/fila responsavel).`,
      );
      return;
    }

    // Guarda 2: se existe um Card com corretor responsavel (ownerId preenchido)
    // para este numero no Kanban (criado manualmente ou pela propria VIVI em
    // sessao anterior), a VIVI tambem nao deve responder.
    if (input.phoneNumber) {
      const hasActiveCard = await this.viviMessageGuardsService.temCardComDono(
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
      const optOutTratado = await this.viviMessageGuardsService.tratarOptOutDeRepique({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        messageBody: input.messageBody,
        remoteJid,
      });
      if (optOutTratado) {
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
          this.enderecoBuscaToolResolverService.resolveTool(
            toolName,
            toolInput,
            input.tenantId,
            enderecoBuscaResultados,
          ),
      });
    } catch (error) {
      // A API da Anthropic ja esgotou as proprias tentativas de retry (ver
      // AnthropicConversationService) - essa excecao e definitiva. Nunca
      // deixa o lead sem resposta nenhuma: manda uma mensagem de fallback
      // e encaminha para atendimento humano prioritario (ver
      // handleAiFailure). Reaproveita o mesmo caminho de codigo de
      // transferToFila, so com uma fila e um resumo diferentes.
      await this.viviAtendimentoEscalationService.handleAiFailure({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        messageBody: input.messageBody,
        conversationId: conversation.id,
        remoteJid,
        error,
      });
      return;
    }
    const { replyText, toolCalls } = generateReplyResult;

    const collected = mergeCollectedData(toolCalls, viviConfig);
    const agendarVisitaCall = toolCalls.find((call) => call.name === 'agendar_visita');
    const transferCall = toolCalls.find((call) => call.name === 'transferir_para_corretor');
    const filaCall = toolCalls.find((call) => call.name === 'transferir_para_fila');
    const posVisitaCall = toolCalls.find((call) => call.name === 'salvar_dados_pos_visita');

    // Nenhuma tool "de decisao" chamada, nem buscar_empreendimento_por_endereco
    // (resolvida via resolveTool, ver enderecoBuscaResultados acima).
    const nenhumaToolChamada =
      !agendarVisitaCall && !transferCall && !filaCall && !posVisitaCall && enderecoBuscaResultados.length === 0;

    // Achado real em producao (26/07/2026, caso "Terreno"): a chamada a IA
    // pode completar SEM lancar excecao mas devolver replyText vazio (sem
    // bloco de texto) e nenhuma tool chamada - o lead ficava sem NENHUMA
    // resposta, silenciosamente, com o mesmo log de um turno normal
    // ("tool=nenhuma"), impossivel de diferenciar de sucesso so olhando o
    // log. Trata como falha de verdade, reaproveitando o MESMO caminho ja
    // usado quando a chamada a IA lanca excecao (handleAiFailure): manda o
    // fallback ao lead e encaminha para a fila "Atendimento Prioritario" -
    // nao criamos um mecanismo novo, so tratamos essa resposta vazia como o
    // que ela e na pratica: uma falha da IA em responder.
    if (!replyText.trim() && nenhumaToolChamada) {
      await this.viviAtendimentoEscalationService.handleAiFailure({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        messageBody: input.messageBody,
        conversationId: conversation.id,
        remoteJid,
        error: new Error('Resposta da IA veio vazia - sem texto e sem nenhuma tool chamada neste turno'),
      });
      return;
    }

    const updates: ViviConversationUpdateInput = { ...collected };
    // Preenchida dentro do bloco agendarVisitaCall abaixo, enviada como
    // SEGUNDA mensagem (depois da confirmacao cordial gerada pela IA) - ver
    // final do try abaixo. Escopo de funcao (nao do bloco if) de proposito,
    // para sobreviver ate o envio, depois do resto do processamento.
    let mensagemConfirmacaoEstruturada: string | null = null;

    // Gap de resiliencia (Integracao VIVI 2026): tudo neste bloco - do
    // tratamento das tools ate os dois envios de mensagem - agora tem a
    // MESMA rede de seguranca ja usada para falha da IA (handleAiFailure,
    // ver catch acima). Antes desta mudanca, uma excecao em qualquer ponto
    // aqui dentro (ex: AgendarVisitaUseCase, CreateNoteUseCase,
    // TransferToBrokerService, ou o proprio envio da mensagem) propagava
    // sem tratamento ate WhatsAppMessageReceivedListener, que so loga o
    // erro - NENHUMA mensagem de fallback chegava ao lead, a conversa
    // "morria" silenciosamente so para aquele numero (investigado e
    // confirmado como a causa mais provavel do bug real relatado pelo
    // usuario - lead respondeu "a tarde" a um horario, VIVI nunca mais
    // respondeu). Ver AUDITORIA/notas desta sessao para o diagnostico
    // completo.
    try {
      if (posVisitaCall) {
        // Defesa em profundidade: mesmo que o prompt instrua a IA a so
        // chamar esta tool depois de agendar_visita, o codigo REJEITA (nao
        // aplica nenhum campo) se a conversa ainda nao tem visita agendada.
        // So registra um aviso - nunca derruba o processamento da mensagem.
        if (conversation.visitaAgendadaEm) {
          applyPostVisitaData(updates, posVisitaCall);
        } else {
          this.logger.warn(
            `[VIVI] Tool salvar_dados_pos_visita chamada para ${input.phoneNumber} (conversa ${conversation.id}) SEM visita agendada ainda - dados REJEITADOS.`,
          );
        }
      }

      if (agendarVisitaCall) {
        // Meta absoluta da VIVI (ver vivi-prompt.ts) - tem prioridade sobre
        // as demais tools se o modelo chamar mais de uma na mesma resposta.
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
          // Integracao VIVI (2026) - usado por AgendarVisitaUseCase so para
          // achar o plantao (endereco/horario) do Empreendimento, se algum
          // ja foi encontrado nesta conversa (ver captura mais abaixo).
          empreendimentoId: conversation.empreendimentoId,
        });
        if (result) {
          updates.cardId = result.cardId;
          updates.visitaAgendadaEm = result.visitaAgendadaEm;
          mensagemConfirmacaoEstruturada = result.mensagemConfirmacaoEstruturada;
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
              : motivo === 'fora_do_portfolio'
                ? 'fora_do_portfolio_transferido'
                : 'qualificado_transferido';

        const cardId = await this.transferToBrokerService.execute({
          tenantId: input.tenantId,
          phoneNumber: input.phoneNumber,
          conversation,
          collected,
          motivo,
        });
        if (cardId) {
          updates.cardId = cardId;
        }
      } else if (filaCall) {
        // Pergunta fora do fluxo de venda (suporte/financeiro/duvida generica) -
        // vai para a Central de Atendimento em vez de virar Card no Kanban.
        updates.status = 'encaminhado_fila';
        await this.viviAtendimentoEscalationService.transferToFila({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          phoneNumber: input.phoneNumber,
          remoteJid,
          filaCall,
        });
      }

      // Log de auditoria: unico ponto do caminho de sucesso que registra
      // algo - sem isso, uma mensagem processada sem nenhuma tool chamada
      // (ex: troca de assunto que o modelo respondeu so conversacionalmente)
      // fica impossivel de diferenciar de "nao processou" so olhando o
      // banco, ja que Prisma nao bumpa @updatedAt quando o update() e
      // chamado com data={} (nenhum campo alterado) - achado confirmado
      // durante a investigacao do caso da Antonia (07/2026).
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

      // Integracao VIVI (2026) - se alguma busca desta resposta encontrou um
      // Empreendimento no catalogo proprio (nao Imovel avulso), grava como o
      // "empreendimento atual de interesse" da conversa - usado por
      // AgendarVisitaUseCase para achar o plantao (endereco/horario) a citar
      // na mensagem de confirmacao de visita. O ULTIMO encontrado nesta
      // resposta prevalece (o modelo pode chamar a tool mais de uma vez);
      // buscas de turnos anteriores continuam gravadas se nenhuma nova
      // ocorrer agora (updates so mexe no campo quando ha algo novo a
      // sobrescrever).
      const empreendimentoEncontradoNestaResposta = enderecoBuscaResultados
        .filter((resultado) => resultado.empreendimentoId !== null)
        .at(-1)?.empreendimentoId;
      if (empreendimentoEncontradoNestaResposta) {
        updates.empreendimentoId = empreendimentoEncontradoNestaResposta;
      }

      // Escalonamento e propriedade da RESPOSTA inteira, nao de cada busca
      // individual - se o modelo chamou buscar_empreendimento_por_endereco e
      // (na mesma resposta) transferir_para_fila/transferir_para_corretor,
      // TODAS as buscas desta resposta sao registradas com o mesmo motivo.
      const escalonado = Boolean(filaCall) || Boolean(transferCall);
      const motivoEscalonamento = filaCall
        ? filaCall.input.urgente === true
          ? 'urgencia/pedido explicito'
          : `fila:${String(filaCall.input.categoria ?? '')}`
        : transferCall
          ? `corretor:${String(transferCall.input.motivo ?? '')}`
          : null;

      await this.enderecoBuscaToolResolverService.persistirLogs(
        input.tenantId,
        input.phoneNumber,
        enderecoBuscaResultados,
        escalonado,
        motivoEscalonamento,
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
          phoneNumber: input.phoneNumber,
          body: replyText,
          simularDigitando: true,
        });
      } else {
        // Chegou aqui so se uma tool FOI chamada (o caso "nenhuma tool e sem
        // texto" ja retornou antes, la em cima, como falha) - cenario
        // legitimo (ex: so salvou dado via salvar_dados_pos_visita, sem
        // necessidade de responder nada nesse turno). Log CLARO e distinto
        // do "tool=..." de sucesso normal, para nunca mais precisar
        // investigar "por que nao enviou nada" so pra descobrir que era
        // esperado.
        this.logger.log(
          `[VIVI] Resposta vazia após tool call (${toolsCalled}), nenhuma mensagem enviada - comportamento esperado (conversa ${conversation.id}, ${input.phoneNumber}).`,
        );
      }

      // Integracao VIVI (2026) - mensagem estruturada de confirmacao de
      // visita, enviada como SEGUNDA mensagem, sempre DEPOIS da confirmacao
      // cordial acima (mesmo quando replyText veio vazio - agendar_visita
      // sempre gera algum texto cordial no mesmo turno na pratica, mas o
      // envio aqui nao depende disso).
      if (mensagemConfirmacaoEstruturada) {
        await this.sendWhatsAppMessageUseCase.execute({
          sessionId: input.sessionId,
          tenantId: input.tenantId,
          to: remoteJid ?? input.phoneNumber,
          phoneNumber: input.phoneNumber,
          body: mensagemConfirmacaoEstruturada,
          simularDigitando: true,
        });
      }
    } catch (error) {
      // Mesmo tratamento ja usado para falha da chamada a IA (handleAiFailure,
      // ver catch acima) - nunca deixa o lead sem resposta nenhuma, mesmo
      // quando o que falhou foi o processamento POS-resposta da IA (tool,
      // nota, log, ou o proprio envio da mensagem).
      await this.viviAtendimentoEscalationService.handleAiFailure({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        messageBody: input.messageBody,
        conversationId: conversation.id,
        remoteJid,
        error,
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

    try {
      return await this.viviConversationRepository.create({
        tenantId: input.tenantId,
        whatsappSessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        // Race condition (achado C2): uma mensagem concorrente do mesmo
        // lead ja criou a ViviConversation entre o find acima e este create
        // (indice unico parcial "vivi_conversations_active_session_phone_key",
        // ver schema.prisma) - busca de novo a conversa ja criada por ela em
        // vez de propagar o erro ou duplicar. NUNCA descarta a mensagem
        // atual: o processamento continua normalmente sobre a conversa
        // retornada aqui.
        const concorrente = await this.viviConversationRepository.findActiveBySessionAndPhone(
          input.sessionId,
          input.phoneNumber,
        );
        if (concorrente) {
          this.logger.log(
            `[VIVI] Corrida detectada para ${input.phoneNumber} (sessao ${input.sessionId}) - reaproveitando conversa ${concorrente.id} criada por mensagem concorrente.`,
          );
          return concorrente;
        }
        // Extremamente improvavel (ex: a conversa concorrente mudou de
        // status no intervalo entre o catch e este refetch) - deixa
        // propagar em vez de arriscar um loop de retry.
      }
      throw error;
    }
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

}
