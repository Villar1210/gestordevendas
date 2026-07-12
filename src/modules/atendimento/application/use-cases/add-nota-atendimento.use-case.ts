// src/modules/atendimento/application/use-cases/add-nota-atendimento.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import {
  IAtendimentoEventoRepository,
  AtendimentoEventoRecord,
} from '../../domain/repositories/atendimento-evento-repository.interface';

interface AddNotaAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  userId: string;
  texto: string;
}

@Injectable()
export class AddNotaAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: AddNotaAtendimentoInput): Promise<AtendimentoEventoRecord> {
    const texto = input.texto.trim();
    if (!texto) {
      throw new BadRequestException('Informe o texto da nota.');
    }

    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }

    return this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'nota',
      userId: input.userId,
      detalhe: texto,
    });
  }
}
