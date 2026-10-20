// src/modules/bii/domain/repositories/itbi-repository.interface.ts
// ItbiTransacao (tabela GLOBAL, dado publico - sem tenantId de proposito).
import { TransacaoItbiNova } from '../services/itbi-linha';
import { TransacaoParaAnalise } from '../services/analise-endereco';
import { BoundingBox } from '../services/geo';

export interface LinhaItbiParaGravar extends TransacaoItbiNova {
  hashLinha: string;
  importacaoId: string;
  arquivoAba: string | null;
}

export interface FiltroBbox {
  bbox: BoundingBox;
  de: Date; // meia-noite UTC, inclusivo
  ateExclusivo: Date; // meia-noite UTC do dia seguinte
  naturezaCodigo: number | null; // null = qualquer natureza
  limite: number;
}

export interface FiltroSemPonto {
  cepPrefixos: string[]; // 5 digitos
  bairrosNormalizados: string[];
  limite: number;
}

export interface CoberturaItbi {
  totalTransacoes: number;
  geocodificadas: number;
  atualizadoAte: Date | null; // maior dataTransacao (meia-noite UTC)
}

export interface IItbiRepository {
  // createMany skipDuplicates por hashLinha -> quantas entraram de fato
  inserirLote(linhas: LinhaItbiParaGravar[]): Promise<number>;
  buscarNoBbox(filtro: FiltroBbox): Promise<TransacaoParaAnalise[]>;
  contarSemLocalizacao(filtro: { cepPrefixo: string; de: Date; ateExclusivo: Date; naturezaCodigo: number | null }): Promise<number>;
  cobertura(): Promise<CoberturaItbi>;
  maiorDataTransacao(): Promise<Date | null>;
  // enderecoChave distintos com lat/lng nulos (filtro por prefixo de CEP OU bairro)
  listarChavesSemPonto(filtro: FiltroSemPonto): Promise<string[]>;
  aplicarCoordenadas(enderecoChave: string, ponto: { lat: number; lng: number; precisao: string }): Promise<number>;
}

export const ITBI_REPOSITORY = 'IItbiRepository';
