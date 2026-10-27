// src/modules/bii/domain/services/referencia-cub.ts
// Fatia 7 - CUB-SP de REFERENCIA (nunca usado como custo automatico).
// Mudou o mes -> ACRESCENTAR uma versao nova (historico no git), nunca editar
// a antiga. Contrato: docs/bii/fatia7/CONTRATO_VIABILIDADE_FINANCEIRA.md

export interface VersaoCub {
  vigenteDesde: string; // YYYY-MM-DD (a partir de quando esta e a ultima publicada)
  mesReferencia: string; // YYYY-MM
  rotulo: string;
  valorM2: number;
  fonte: string;
  observacao: string;
}

export const OBSERVACAO_CUB =
  'O CUB não inclui fundações, elevadores, paisagismo, impostos, projetos nem a remuneração da construtora: o custo real de obra costuma ficar acima dele.';

export const VERSOES_CUB: VersaoCub[] = [
  {
    vigenteDesde: '2026-09-01',
    mesReferencia: '2026-08',
    rotulo: 'CUB-SP R8-N (residencial multifamiliar, padrão normal, 8 pavimentos)',
    valorM2: 2235.58,
    fonte: 'SindusCon-SP — CUB-SP R8-N sem desoneração, agosto/2026',
    observacao: OBSERVACAO_CUB,
  },
];
