// src/modules/vivi_sdr/application/use-cases/reabrir-vivi-apos-fechamento.use-case.ts
// Corrige um comportamento confirmado em producao: ViviConversation.status
// ficava travada em "encaminhado_fila" para sempre, mesmo depois do
// Atendimento associado (criado por uma falha tecnica da IA, ver
// ProcessIncomingMessageUseCase.handleAiFailure) ser fechado - o Guard 1 de
// ProcessIncomingMessageUseCase nunca mais deixava a VIVI responder aquele
// numero. Chamado pelo AtendimentoFechadoListener (evento
// 'atendimento.fechado', emitido por CloseAtendimentoUseCase).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IAtendimentoRepository } from '../../../atendimento/domain/repositories/atendimento-repository.interface';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';

interface ReabrirViviAposFechamentoInput {
  tenantId: string;
  whatsappSessionId: string;
  remoteJid: string;
  phoneNumber: string;
}

@Injectable()
export class ReabrirViviAposFechamentoUseCase {
  private readonly logger = new Logger(ReabrirViviAposFechamentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IViviConversationRepository')
    private readonly viviConversationRepository: IViviConversationRepository,
  ) {}

  async execute(input: ReabrirViviAposFechamentoInput): Promise<void> {
    // Se ainda houver OUTRO atendimento em aberto para o mesmo contato
    // (mesma sessao/remoteJid), NAO reabre - evita a VIVI atropelar um
    // segundo atendimento simultaneo que ainda esta em andamento. Chamado
    // depois do fechamento ja persistido (ver CloseAtendimentoUseCase), o
    // proprio atendimento que acabou de fechar ja fica de fora dessa busca
    // (findActiveBySessionAndRemoteJid filtra status != "fechado").
    const outroAtendimentoAberto = await this.atendimentoRepository.findActiveBySessionAndRemoteJid(
      input.whatsappSessionId,
      input.remoteJid,
    );
    if (outroAtendimentoAberto) {
      return;
    }

    const conversation = await this.viviConversationRepository.findLatestBySessionAndPhone(
      input.whatsappSessionId,
      input.phoneNumber,
    );
    // So reverte quando o motivo do encaminhamento foi tratado nesta
    // correcao (falha tecnica -> "encaminhado_fila"). Os demais status de
    // encerramento (qualificado_transferido/duvida_transferido/repique)
    // representam um handoff bem-sucedido de verdade (decisao de negocio,
    // nao uma falha) - ficam fora do escopo desta correcao de proposito.
    if (!conversation || conversation.status !== 'encaminhado_fila') {
      return;
    }

    // "encerrada", nao "em_andamento" diretamente: e o status que ja faz o
    // Guard 1 (ProcessIncomingMessageUseCase) permitir responder de novo, e
    // findActiveBySessionAndPhone (que so busca status="em_andamento") nao
    // vai reaproveitar esta linha - a proxima mensagem cria uma
    // ViviConversation NOVA e limpa, sem carregar dados coletados de um
    // ciclo que foi interrompido por uma falha tecnica no meio do caminho.
    await this.viviConversationRepository.update(conversation.id, { status: 'encerrada' });
    this.logger.log(
      `Conversa da VIVI liberada para ${input.phoneNumber} apos fechamento do atendimento escalado (sem outros atendimentos abertos para este contato).`,
    );
  }
}
