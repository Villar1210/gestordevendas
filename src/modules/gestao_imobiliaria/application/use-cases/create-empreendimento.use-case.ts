// src/modules/gestao_imobiliaria/application/use-cases/create-empreendimento.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';

interface CreateEmpreendimentoInput {
  tenantId: string;
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description?: string;
}

@Injectable()
export class CreateEmpreendimentoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
  ) {}

  async execute(input: CreateEmpreendimentoInput): Promise<EmpreendimentoRecord> {
    return this.empreendimentoRepository.create(input);
  }
}
