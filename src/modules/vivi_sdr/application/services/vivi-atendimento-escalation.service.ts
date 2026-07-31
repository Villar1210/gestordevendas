// src/modules/vivi_sdr/application/services/vivi-atendimento-escalation.service.ts
// Extraido de ProcessIncomingMessageUseCase (I10 da auditoria, refactor
// estrutural puro - comportamento inalterado). Consolida os dois caminhos
// que encaminham a conversa da VIVI para a Central de Atendimento: um
// handoff normal (tool "transferir_para_fila") e uma falha tecnica da IA
// (rede de seguranca, auditoria de producao, Critico #1) - ambos criam/
// buscam um Atendimento e chamam ClassifyAndRouteAtendimentoUseCase, so
// variam fila/urgencia/resumo e se um fallback e enviado ao lead.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from '../../../atendimento/application/use-cases/classify-and-route-atendimento.use-case';
import { CATEGORIA_TO_FILA_NOME, FILA_ATENDIMENTO_PRIORITARIO_NOME } from '../../../atendimento/domain/services/fila-categorias';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';

// Rede de seguranca para falha tecnica da IA (auditoria de producao,
// Critico #1) - enviada ao lead quando generateReply falha mesmo apos o
// SDK esgotar as tentativas de retry automatico (ver
// AnthropicConversationService, comentario no construtor). Texto
// confirmado com o usuario antes de implementar (nao technical-sounding,
// define expectativa sem prometer prazo especifico).
const AI_FALLBACK_MESSAGE =
  'Estou com uma instabilidade no momento. Um de nossos atendentes vai te responder em breve.';

interface TransferToFilaInput {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  remoteJid: string | null;
  filaCall: { name: string; input: Record<string, unknown> };
}

interface HandleAiFailureInput {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  messageBody: string;
  conversationId: string;
  remoteJid: string | null;
  error: unknown;
}

@Injectable()
export class ViviAtendimentoEscalationService {
  private readonly logger = new Logger(ViviAtendimentoEscalationService.name);

  constructor(
    private readonly getOrCreateAtendimentoUseCase: GetOrCreateAtendimentoUseCase,
    private readonly classifyAndRouteAtendimentoUseCase: ClassifyAndRouteAtendimentoUseCase,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    @Inject('IViviConversationRepository')
    private readonly viviConversationRepository: IViviConversationRepository,
  ) {}

  async transferToFila(input: TransferToFilaInput): Promise<void> {
    const { tenantId, sessionId, phoneNumber, remoteJid, filaCall } = input;
    const categoria = String(filaCall.input.categoria ?? 'duvida_geral');
    const resumo = typeof filaCall.input.resumo === 'string' ? filaCall.input.resumo : undefined;
    const urgente = filaCall.input.urgente === true;
    const filaNome = CATEGORIA_TO_FILA_NOME[categoria] ?? CATEGORIA_TO_FILA_NOME.duvida_geral;

    // remoteJid deveria sempre vir preenchido a essa altura (a mensagem que
    // acabou de chegar ja foi persistida com remoteJid antes do evento ser
    // emitido) - fallback so cobre um cenario teorico de mensagem antiga.
    const jid = remoteJid ?? `${phoneNumber}@s.whatsapp.net`;

    const atendimento = await this.getOrCreateAtendimentoUseCase.execute({
      tenantId,
      sessionId,
      remoteJid: jid,
      phoneNumber,
    });

    await this.classifyAndRouteAtendimentoUseCase.execute({
      tenantId,
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
  async handleAiFailure(input: HandleAiFailureInput): Promise<void> {
    const { tenantId, sessionId, phoneNumber, messageBody, conversationId, remoteJid, error } = input;
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `[VIVI] Falha definitiva na chamada a IA para ${phoneNumber} (conversa ${conversationId}), apos esgotar os retries do SDK: ${errorMessage}`,
    );

    const jid = remoteJid ?? `${phoneNumber}@s.whatsapp.net`;

    // Nunca deixa o lead sem NENHUMA resposta - mesmo mecanismo ja usado
    // pelo opt-out de Repique (sendWhatsAppMessageUseCase direto, sem
    // passar por generateReply).
    try {
      await this.sendWhatsAppMessageUseCase.execute({
        sessionId,
        tenantId,
        to: jid,
        phoneNumber,
        body: AI_FALLBACK_MESSAGE,
      });
    } catch (sendError) {
      // Se ate o envio do fallback falhar (ex: sessao do WhatsApp caiu
      // junto), so registra - o roteamento para a fila prioritaria abaixo
      // ainda e o mais importante e nao pode ser bloqueado por isso.
      this.logger.error(
        `[VIVI] Falha ao enviar mensagem de fallback para ${phoneNumber}: ${
          sendError instanceof Error ? sendError.message : sendError
        }`,
      );
    }

    const atendimento = await this.getOrCreateAtendimentoUseCase.execute({
      tenantId,
      sessionId,
      remoteJid: jid,
      phoneNumber,
    });

    // resumo vira o detalhe do AtendimentoEvento (ver ClassifyAndRouteAtendimentoUseCase)
    // - unico rastro persistente (alem do log acima, que so sobrevive no
    // stdout) do motivo tecnico real por tras deste atendimento, visivel
    // para quem for atende-lo na Central de Atendimento.
    await this.classifyAndRouteAtendimentoUseCase.execute({
      tenantId,
      atendimentoId: atendimento.id,
      filaNome: FILA_ATENDIMENTO_PRIORITARIO_NOME,
      resumo: `Falha tecnica da IA (nao decisao da VIVI): ${errorMessage}. Ultima mensagem do lead: "${messageBody}"`,
      urgente: true,
    });

    // Mesmo status usado por um handoff normal para fila (transferToFila) -
    // impede a VIVI de reabrir o dialogo neste numero enquanto o
    // atendimento humano nao for concluido (ver Guarda 1, em
    // ProcessIncomingMessageUseCase.execute()), mesmo que a proxima mensagem
    // chegue antes de alguem assumir o atendimento prioritario.
    await this.viviConversationRepository.update(conversationId, {
      status: 'encaminhado_fila',
    });
  }
}
