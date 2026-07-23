// src/modules/gestao_imobiliaria/application/use-cases/publicar-empreendimento.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';

// Fatia 4: publicado hoje NAO controla visibilidade no Espelho de Vendas
// interno (corretor sempre ve/gerencia todos os empreendimentos do tenant
// ali, publicado ou nao) - e um campo pensado para um futuro catalogo
// publico/cliente, que ainda nao existe (ver comentario em
// EmpreendimentoRecord.publicado). Este use case so alterna o campo.
@Injectable()
export class PublicarEmpreendimentoUseCase {
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

    return this.empreendimentoRepository.update(input.empreendimentoId, { publicado: true });
  }
}
