// src/modules/gestao_imobiliaria/application/use-cases/list-empreendimentos.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';

@Injectable()
export class ListEmpreendimentosUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
  ) {}

  async execute(input: { tenantId: string; publicado?: boolean }): Promise<EmpreendimentoRecord[]> {
    return this.empreendimentoRepository.findAllByTenant(input.tenantId, {
      publicado: input.publicado,
    });
  }
}
