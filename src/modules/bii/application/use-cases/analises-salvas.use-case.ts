// src/modules/bii/application/use-cases/analises-salvas.use-case.ts
// GET /bii/analises (ultimas 50 do tenant) e GET /bii/analises/:id (snapshot
// salvo; de outro tenant -> 404). Sempre por { id, tenantId }.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BII_ANALISE_REPOSITORY, IBiiAnaliseRepository } from '../../domain/repositories/bii-analise-repository.interface';
import { exigirAdministrador } from './permissoes-bii';

export const LIMITE_LISTA_ANALISES = 50;

export interface AnaliseListaItem {
  id: string;
  endereco: string;
  enderecoFormatado: string;
  raioMetros: number;
  meses: number;
  transacoes: number;
  precoM2Mediano: number | null;
  criadoEm: string;
}

@Injectable()
export class ListAnalisesUseCase {
  constructor(@Inject(BII_ANALISE_REPOSITORY) private readonly repo: IBiiAnaliseRepository) {}

  async execute(input: { tenantId: string; requesterRole: string }): Promise<AnaliseListaItem[]> {
    exigirAdministrador(input.requesterRole);
    const lista = await this.repo.listarPorTenant(input.tenantId, LIMITE_LISTA_ANALISES);
    return lista.map((a) => ({
      id: a.id,
      endereco: a.enderecoDigitado,
      enderecoFormatado: a.enderecoFormatado,
      raioMetros: a.raioMetros,
      meses: a.meses,
      transacoes: a.transacoes,
      precoM2Mediano: a.precoM2Mediano,
      criadoEm: a.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class GetAnaliseUseCase {
  constructor(@Inject(BII_ANALISE_REPOSITORY) private readonly repo: IBiiAnaliseRepository) {}

  async execute(input: { tenantId: string; requesterRole: string; id: string }): Promise<Record<string, unknown>> {
    exigirAdministrador(input.requesterRole);
    const a = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!a) throw new NotFoundException('Análise não encontrada.');
    return { id: a.id, ...a.resultado, criadoEm: a.createdAt.toISOString() };
  }
}
