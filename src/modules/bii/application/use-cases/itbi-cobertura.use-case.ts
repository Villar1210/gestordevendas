// src/modules/bii/application/use-cases/itbi-cobertura.use-case.ts
// GET /bii/itbi/cobertura - quanto do ITBI (dado publico global) existe, para
// a tela avisar quando nao ha dado ou falta geocodificar.
import { Inject, Injectable } from '@nestjs/common';
import { IItbiRepository, ITBI_REPOSITORY } from '../../domain/repositories/itbi-repository.interface';
import {
  IItbiImportacaoRepository,
  ITBI_IMPORTACAO_REPOSITORY,
} from '../../domain/repositories/itbi-importacao-repository.interface';
import { exigirAdministrador } from './permissoes-bii';
import { CoberturaItbiCache } from '../services/cobertura-itbi.cache';

export interface CoberturaItbiResponse {
  anos: number[];
  totalTransacoes: number;
  geocodificadas: number;
  ultimaImportacao: string | null;
}

@Injectable()
export class GetItbiCoberturaUseCase {
  constructor(
    @Inject(ITBI_REPOSITORY) private readonly itbiRepo: IItbiRepository,
    @Inject(ITBI_IMPORTACAO_REPOSITORY) private readonly importacaoRepo: IItbiImportacaoRepository,
    private readonly cache: CoberturaItbiCache,
  ) {}

  // Cache de 10 min (QA-4), invalidado ao concluir importacao/geocodificacao.
  async execute(input: { requesterRole: string }): Promise<CoberturaItbiResponse> {
    exigirAdministrador(input.requesterRole);
    return this.cache.obter(() => this.calcular());
  }

  private async calcular(): Promise<CoberturaItbiResponse> {
    const [cobertura, anos, ultima] = await Promise.all([
      this.itbiRepo.cobertura(),
      this.importacaoRepo.anosConcluidos(),
      this.importacaoRepo.ultimaConcluida(),
    ]);
    return {
      anos,
      totalTransacoes: cobertura.totalTransacoes,
      geocodificadas: cobertura.geocodificadas,
      ultimaImportacao: ultima ? ultima.toISOString() : null,
    };
  }
}
