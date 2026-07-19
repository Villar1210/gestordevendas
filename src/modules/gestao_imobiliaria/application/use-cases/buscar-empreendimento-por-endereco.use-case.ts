// src/modules/gestao_imobiliaria/application/use-cases/buscar-empreendimento-por-endereco.use-case.ts
// Busca no CATALOGO PROPRIO (Empreendimento + Imovel avulso) por endereco em
// texto livre, tolerante a abreviacoes/acentuacao/pequenas diferencas de
// grafia (ver domain/services/normalize-endereco.ts) - sem geocodificacao.
// Consumido pela tool "buscar_empreendimento_por_endereco" da VIVI (modulo
// vivi_sdr, dependencia de modulo - ver vivi-sdr.module.ts).
import { Injectable, Inject } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository, ImovelRecord } from '../../domain/repositories/imovel-repository.interface';
import {
  normalizeEnderecoTexto,
  extrairLogradouroENumero,
  enderecoCorresponde,
} from '../../domain/services/normalize-endereco';

interface BuscarEmpreendimentoPorEnderecoInput {
  tenantId: string;
  enderecoBusca: string;
}

export interface BuscaEmpreendimentoResultado {
  encontrado: boolean;
  tipo: 'empreendimento' | 'imovel' | null;
  nome: string | null;
  diferenciais: string | null;
  unidadesDisponiveis: number | null;
  precoDesde: number | null;
  statusResumo: string | null;
}

const STATUS_DISPONIVEL = 'disponivel';

@Injectable()
export class BuscarEmpreendimentoPorEnderecoUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository') private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: BuscarEmpreendimentoPorEnderecoInput): Promise<BuscaEmpreendimentoResultado> {
    const query = extrairLogradouroENumero(normalizeEnderecoTexto(input.enderecoBusca));

    const empreendimentos = await this.empreendimentoRepository.findAllByTenant(input.tenantId);
    const empreendimentoEncontrado = empreendimentos.find((emp) =>
      enderecoCorresponde(query, { rua: emp.rua, numero: emp.numero }),
    );

    if (empreendimentoEncontrado) {
      const unidades = await this.imovelRepository.findAllByTenant(input.tenantId, {
        empreendimentoId: empreendimentoEncontrado.id,
      });
      return this.buildResultadoEmpreendimento(empreendimentoEncontrado, unidades);
    }

    // Imovel avulso (sem empreendimento) - o proprio Imovel e o "resultado".
    const todosImoveis = await this.imovelRepository.findAllByTenant(input.tenantId);
    const imovelAvulsoEncontrado = todosImoveis.find(
      (imovel) =>
        imovel.empreendimentoId === null &&
        imovel.rua !== null &&
        imovel.numero !== null &&
        enderecoCorresponde(query, { rua: imovel.rua, numero: imovel.numero }),
    );

    if (imovelAvulsoEncontrado) {
      return this.buildResultadoImovelAvulso(imovelAvulsoEncontrado);
    }

    return {
      encontrado: false,
      tipo: null,
      nome: null,
      diferenciais: null,
      unidadesDisponiveis: null,
      precoDesde: null,
      statusResumo: null,
    };
  }

  private buildResultadoEmpreendimento(
    empreendimento: { name: string; description: string | null },
    unidades: ImovelRecord[],
  ): BuscaEmpreendimentoResultado {
    const disponiveis = unidades.filter((u) => u.status === STATUS_DISPONIVEL);
    const precos = disponiveis
      .map((u) => u.price ?? u.rentPrice)
      .filter((p): p is number => p !== null && p > 0);
    const precoDesde = precos.length > 0 ? Math.min(...precos) : null;

    return {
      encontrado: true,
      tipo: 'empreendimento',
      nome: empreendimento.name,
      diferenciais: empreendimento.description,
      unidadesDisponiveis: disponiveis.length,
      precoDesde,
      statusResumo:
        disponiveis.length > 0
          ? `${disponiveis.length} unidade(s) disponivel(is)`
          : 'sem unidades disponiveis no momento',
    };
  }

  private buildResultadoImovelAvulso(imovel: ImovelRecord): BuscaEmpreendimentoResultado {
    return {
      encontrado: true,
      tipo: 'imovel',
      nome: imovel.title,
      diferenciais: imovel.description,
      unidadesDisponiveis: imovel.status === STATUS_DISPONIVEL ? 1 : 0,
      precoDesde: imovel.price ?? imovel.rentPrice,
      statusResumo: imovel.status,
    };
  }
}
