// src/modules/gestao_imobiliaria/application/use-cases/update-empreendimento.use-case.ts
// PATCH /empreendimentos/:id - Construtoras (Fatia A): troca a construtora
// do empreendimento. construtoraId do proprio tenant (senao 404), null para
// desvincular, ou so o texto (acha pelo nome normalizado ou cria). O texto
// legado Empreendimento.construtora acompanha o nome da construtora.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { ResolverConstrutoraService } from '../services/resolver-construtora.service';

interface UpdateEmpreendimentoInput {
  tenantId: string;
  empreendimentoId: string;
  construtoraId?: string | null;
  construtora?: string;
}

@Injectable()
export class UpdateEmpreendimentoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    private readonly resolverConstrutora: ResolverConstrutoraService,
  ) {}

  async execute(input: UpdateEmpreendimentoInput): Promise<EmpreendimentoRecord> {
    const atual = await this.empreendimentoRepository.findByIdAndTenant(input.empreendimentoId, input.tenantId);
    if (!atual) throw new NotFoundException('Empreendimento nao encontrado.');

    const resolvida = await this.resolverConstrutora.resolver({
      tenantId: input.tenantId,
      construtoraId: input.construtoraId,
      construtoraTexto: input.construtora,
    });
    if (!resolvida) return atual;

    const atualizado = await this.empreendimentoRepository.atualizarConstrutora(atual.id, input.tenantId, resolvida);
    if (!atualizado) throw new NotFoundException('Empreendimento nao encontrado.');
    return atualizado;
  }
}
