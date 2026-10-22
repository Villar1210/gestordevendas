// src/modules/bii/application/use-cases/viabilidade.use-cases.ts
// Fatia 4 - Viabilidade HIS/HMP/MCMV. So Administrador (checado aqui tambem).
// So calcula: nao grava nada e nao chama servico externo - por isso fica
// liberado tambem na impersonacao do Super Usuario (somente leitura).
// Contrato: docs/bii/fatia4/CONTRATO_VIABILIDADE.md
import { Injectable } from '@nestjs/common';
import { hojeUtc, formatarDataUtc } from '../../domain/services/data-utc';
import { limparTextoCurto } from '../../domain/services/concorrente';
import { VERSOES_MCMV, VERSOES_MUNICIPAIS, VersaoMcmv, VersaoMunicipal, versaoVigente } from '../../domain/services/parametros-habitacionais';
import { avaliarTipologia, Premissas, PREMISSAS_PADRAO, ResultadoTipologia, TipologiaViabilidade } from '../../domain/services/viabilidade';
import { exigirAdministrador } from './permissoes-bii';

export interface ParametrosVigentes {
  dataReferencia: string;
  municipal: VersaoMunicipal;
  mcmv: VersaoMcmv;
}

function vigentes(agora: Date): ParametrosVigentes {
  const data = formatarDataUtc(hojeUtc(agora));
  return { dataReferencia: data, municipal: versaoVigente(VERSOES_MUNICIPAIS, data), mcmv: versaoVigente(VERSOES_MCMV, data) };
}

@Injectable()
export class GetParametrosViabilidadeUseCase {
  execute(input: { requesterRole: string; agora?: Date }): ParametrosVigentes {
    exigirAdministrador(input.requesterRole);
    return vigentes(input.agora ?? new Date());
  }
}

export interface CalcularViabilidadeInput {
  requesterRole: string;
  tipologias: TipologiaViabilidade[];
  premissas?: Partial<Premissas>;
  agora?: Date;
}

export interface ViabilidadeResposta {
  premissas: Premissas;
  resultados: ResultadoTipologia[];
  parametros: ParametrosVigentes;
  observacao: string;
}

export const OBSERVACAO_VIABILIDADE =
  'Estimativa pela Tabela Price, sem subsídio do MCMV e sem custos de cartório/ITBI. A Caixa faz a análise final de renda e crédito.';

@Injectable()
export class CalcularViabilidadeUseCase {
  execute(input: CalcularViabilidadeInput): ViabilidadeResposta {
    exigirAdministrador(input.requesterRole);
    const parametros = vigentes(input.agora ?? new Date());
    const premissas: Premissas = {
      entradaPercentual: input.premissas?.entradaPercentual ?? PREMISSAS_PADRAO.entradaPercentual,
      prazoMeses: input.premissas?.prazoMeses ?? PREMISSAS_PADRAO.prazoMeses,
      comprometimentoPercentual: input.premissas?.comprometimentoPercentual ?? PREMISSAS_PADRAO.comprometimentoPercentual,
      jurosAnual: input.premissas?.jurosAnual ?? null,
    };
    const resultados = input.tipologias.map((t) =>
      avaliarTipologia(
        { descricao: limparTextoCurto(t.descricao).slice(0, 100) || 'Tipologia', areaPrivativa: t.areaPrivativa, preco: t.preco },
        premissas,
        parametros.municipal,
        parametros.mcmv,
      ),
    );
    return { premissas, resultados, parametros, observacao: OBSERVACAO_VIABILIDADE };
  }
}
