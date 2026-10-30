// src/modules/gestao_imobiliaria/application/use-cases/create-empreendimento.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { ResolverConstrutoraService } from '../services/resolver-construtora.service';

interface CreateEmpreendimentoInput {
  tenantId: string;
  name: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  tipo?: string;
  // Construtoras (Fatia A): construtoraId do proprio tenant (senao 404) OU
  // so o texto (compatibilidade e book) - acha pelo nome normalizado ou cria.
  construtoraId?: string;
  construtora?: string;
  statusObra?: string;
  precoMinimo?: number;
  precoMaximo?: number;
  description?: string;
}

@Injectable()
export class CreateEmpreendimentoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    private readonly resolverConstrutora: ResolverConstrutoraService,
  ) {}

  async execute(input: CreateEmpreendimentoInput): Promise<EmpreendimentoRecord> {
    const { construtoraId, construtora, ...dados } = input;
    const resolvida = await this.resolverConstrutora.resolver({
      tenantId: input.tenantId,
      construtoraId: construtoraId || undefined,
      construtoraTexto: construtora,
    });
    return this.empreendimentoRepository.create({
      ...dados,
      construtoraId: resolvida?.construtoraId ?? null,
      construtora: resolvida?.construtora ?? null,
    });
  }
}
