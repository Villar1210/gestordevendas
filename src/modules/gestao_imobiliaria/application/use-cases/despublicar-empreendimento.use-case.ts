// src/modules/gestao_imobiliaria/application/use-cases/despublicar-empreendimento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';

@Injectable()
export class DespublicarEmpreendimentoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
  ) {}

  async execute(input: { tenantId: string; empreendimentoId: string }): Promise<EmpreendimentoRecord> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    return this.empreendimentoRepository.update(input.empreendimentoId, { publicado: false });
  }
}
