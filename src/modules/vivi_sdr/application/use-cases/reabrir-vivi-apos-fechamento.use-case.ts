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
import { isMotivoFechamentoValido } from '../../../atendimento/domain/services/motivo-fechamento';
import { IViviConversationRepository } from '../../domain/repositories/vivi-conversation-repository.interface';

interface ReabrirViviAposFechamentoInput {
  tenantId: string;
  whatsappSessionId: string;
  remoteJid: string;
  phoneNumber: string;
  motivoFechamento: string | null;
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
    // Filtro adicional (I8a da auditoria): motivoFechamento de NEGOCIO
    // (venda_concluida/desistencia/finalizacao_normal) nunca reabre a VIVI,
    // mesmo que o sinal tecnico (status=encaminhado_fila) esteja presente -
    // o fechamento foi uma decisao humana deliberada, nao uma falha tecnica
    // que justificasse liberar a IA de novo para este contato. Checado
    // ANTES de qualquer consulta a repositorio, de proposito (mais barato,
    // e nao muda o resultado final).
    if (input.motivoFechamento && isMotivoFechamentoValido(input.motivoFechamento)) {
      return;
    }

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
