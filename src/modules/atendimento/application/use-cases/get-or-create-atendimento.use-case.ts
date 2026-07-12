// src/modules/atendimento/application/use-cases/get-or-create-atendimento.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { DEFAULT_FILA_NAMES } from '../../domain/services/fila-categorias';

interface GetOrCreateAtendimentoInput {
  tenantId: string;
  sessionId: string;
  remoteJid: string;
  phoneNumber: string;
}

@Injectable()
export class GetOrCreateAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: GetOrCreateAtendimentoInput): Promise<AtendimentoRecord> {
    const existing = await this.atendimentoRepository.findActiveBySessionAndRemoteJid(
      input.sessionId,
      input.remoteJid,
    );
    if (existing) {
      return existing;
    }

    await this.ensureDefaultFilas(input.tenantId);

    const atendimento = await this.atendimentoRepository.create({
      tenantId: input.tenantId,
      whatsappSessionId: input.sessionId,
      remoteJid: input.remoteJid,
      phoneNumber: input.phoneNumber,
    });

    await this.eventoRepository.create({ atendimentoId: atendimento.id, tipo: 'criado' });

    return atendimento;
  }

  // Evita depender de setup manual: a primeira vez que um tenant precisa de
  // um Atendimento e ainda nao tem nenhuma Fila, cria as 3 padrao.
  private async ensureDefaultFilas(tenantId: string): Promise<void> {
    const count = await this.filaRepository.countByTenant(tenantId);
    if (count > 0) return;

    for (const nome of DEFAULT_FILA_NAMES) {
      await this.filaRepository.create({ tenantId, nome });
    }
  }
}
