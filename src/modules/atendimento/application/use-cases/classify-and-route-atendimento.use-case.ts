// src/modules/atendimento/application/use-cases/classify-and-route-atendimento.use-case.ts
import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface ClassifyAndRouteAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  filaNome: string;
  resumo?: string | null;
  // Preenchido quando a classificacao e manual (Administrador escolhendo a
  // fila pela UI) - nulo quando quem classifica e a VIVI.
  userId?: string | null;
  // Marcado pela VIVI quando o lead pede para falar com um humano AGORA
  // (ver ProcessIncomingMessageUseCase) - vira badge visual na UI.
  urgente?: boolean;
}

@Injectable()
export class ClassifyAndRouteAtendimentoUseCase {
  private readonly logger = new Logger(ClassifyAndRouteAtendimentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: ClassifyAndRouteAtendimentoInput): Promise<AtendimentoRecord> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }

    const nome = input.filaNome.trim();
    let fila = await this.filaRepository.findByTenantAndNome(input.tenantId, nome);
    if (!fila) {
      // Categoria nao bate com nenhuma fila padrao existente (ex: renomeada
      // ou removida pelo tenant) - cria uma nova em vez de falhar a
      // classificacao.
      fila = await this.filaRepository.create({ tenantId: input.tenantId, nome });
      this.logger.warn(
        `[Atendimento] Fila "${nome}" nao existia para tenant ${input.tenantId} - criada automaticamente ao classificar atendimento ${atendimento.id}.`,
      );
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      filaId: fila.id,
      ...(input.urgente ? { urgente: true } : {}),
    });

    const resumo = input.resumo?.trim();
    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'criado',
      userId: input.userId ?? null,
      detalhe: `Classificado na fila "${fila.nome}"${input.urgente ? ' [URGENTE]' : ''}${resumo ? `: ${resumo}` : ''}`,
    });

    // Hoje o UNICO chamador deste use case e ProcessIncomingMessageUseCase
    // (VIVI, tool "transferir_para_fila") - uma classificacao/transferencia
    // manual feita por um Administrador passa por TransferAtendimentoUseCase,
    // um caminho de codigo separado que nunca chega aqui (ver investigacao
    // do handoff VIVI -> Corretor). Por isso o evento nao precisa checar
    // input.userId para saber se "foi a VIVI" - sempre e. emit() nao aguarda
    // o listener, mesmo padrao ja usado por CreateQuickCardUseCase para
    // 'card.sem_dono.criado'.
    this.eventEmitter.emit('atendimento.classificado', {
      tenantId: input.tenantId,
      atendimentoId: atendimento.id,
      filaId: fila.id,
      filaNome: fila.nome,
      urgente: !!input.urgente,
    });

    this.logger.log(
      `[Atendimento] Atendimento ${atendimento.id} classificado na fila "${fila.nome}"${input.urgente ? ' [URGENTE]' : ''}.`,
    );
    return updated;
  }
}
