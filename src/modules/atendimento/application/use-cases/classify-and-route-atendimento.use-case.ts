// src/modules/atendimento/application/use-cases/classify-and-route-atendimento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
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

    return updated;
  }
}
