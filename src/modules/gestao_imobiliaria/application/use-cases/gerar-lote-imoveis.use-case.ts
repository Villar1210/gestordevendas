// src/modules/gestao_imobiliaria/application/use-cases/gerar-lote-imoveis.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';
import {
  gerarLoteImoveis,
  PadraoLoteImoveis,
  UnidadeGerada,
} from '../../domain/services/gerar-lote-imoveis';

interface GerarLoteImoveisInput {
  tenantId: string;
  empreendimentoId: string;
  padrao: PadraoLoteImoveis;
}

export interface UnidadeGeradaComAviso extends UnidadeGerada {
  identificadorJaExiste: boolean;
}

export interface GerarLoteImoveisOutput {
  unidades: UnidadeGeradaComAviso[];
  identificadoresDuplicados: string[];
}

@Injectable()
export class GerarLoteImoveisUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: GerarLoteImoveisInput): Promise<GerarLoteImoveisOutput> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    if (input.padrao.andarInicial > input.padrao.andarFinal) {
      throw new BadRequestException('andarInicial nao pode ser maior que andarFinal.');
    }

    const unidadesGeradas = gerarLoteImoveis(input.padrao);

    // Colisao NAO bloqueia a geracao - so sinaliza, para o usuario decidir
    // no frontend (fatia seguinte) se ajusta o padrao ou edita o identificador
    // manualmente antes de confirmar o salvamento.
    const identificadores = unidadesGeradas.map((unidade) => unidade.identificadorExterno);
    const identificadoresDuplicados = await this.imovelRepository.findExistingIdentificadoresExternos(
      input.tenantId,
      identificadores,
    );
    const duplicadosSet = new Set(identificadoresDuplicados);

    const unidades: UnidadeGeradaComAviso[] = unidadesGeradas.map((unidade) => ({
      ...unidade,
      identificadorJaExiste: duplicadosSet.has(unidade.identificadorExterno),
    }));

    return { unidades, identificadoresDuplicados };
  }
}
