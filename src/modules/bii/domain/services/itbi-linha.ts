// src/modules/bii/domain/services/itbi-linha.ts
// Uma linha da planilha (ja com o mapa de colunas detectado) -> transacao do
// ITBI pronta para gravar, ou descarte. Funcoes PURAS: o hash (sha256) e
// calculado na camada de aplicacao sobre textoParaHash().
import { MapaColunas, CampoItbi } from './itbi-colunas';
import {
  parseCodigoComZeros,
  parseCodigoDescricao,
  parseDataItbi,
  parseDecimal,
  parseInteiro,
  parseNumeroImovel,
  parseTexto,
  ValorCelula,
} from './itbi-valores';
import {
  montarEnderecoChave,
  normalizarBairro,
  normalizarCep,
  normalizarLogradouro,
  normalizarNumero,
  prefixoCep,
} from './endereco';
import { formatarDataUtc } from './data-utc';

// Decimal(14,2) cabe ate 999.999.999.999,99.
export const VALOR_MAXIMO = 999_999_999_999;
export const AREA_MAXIMA = 9_999_999_999;

export interface TransacaoItbiNova {
  sqlCadastro: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  referencia: string | null;
  bairro: string | null;
  bairroNormalizado: string | null;
  cep: string | null;
  cepPrefixo: string | null;
  enderecoChave: string;
  naturezaCodigo: number | null;
  naturezaTransacao: string | null;
  valorTransacao: number;
  dataTransacao: Date; // meia-noite UTC
  valorVenalReferencia: number | null;
  proporcaoTransmitida: number | null;
  tipoFinanciamentoCodigo: number | null;
  tipoFinanciamento: string | null;
  valorFinanciado: number | null;
  situacaoSql: string | null;
  areaTerreno: number | null;
  fracaoIdeal: number | null;
  areaConstruida: number | null;
  usoIptu: number | null;
  usoDescricao: string | null;
  padraoIptu: number | null;
  padraoDescricao: string | null;
  accIptu: number | null;
}

export type MotivoDescarte = 'sem_logradouro' | 'sem_valor' | 'sem_data';

export type ResultadoLinha = { ok: true; transacao: TransacaoItbiNova } | { ok: false; motivo: MotivoDescarte };

export function montarTransacaoItbi(valores: ValorCelula[], mapa: MapaColunas): ResultadoLinha {
  const v = (campo: CampoItbi): ValorCelula => {
    const i = mapa[campo];
    return i === undefined ? null : valores[i];
  };

  const logradouro = parseTexto(v('logradouro'), 200);
  if (!logradouro || !normalizarLogradouro(logradouro)) return { ok: false, motivo: 'sem_logradouro' };
  const valorTransacao = parseDecimal(v('valorTransacao'), 0.01, VALOR_MAXIMO);
  if (valorTransacao === null) return { ok: false, motivo: 'sem_valor' };
  const dataTransacao = parseDataItbi(v('dataTransacao'));
  if (!dataTransacao) return { ok: false, motivo: 'sem_data' };

  const numeroTexto = parseNumeroImovel(v('numero'));
  const numeroNorm = normalizarNumero(numeroTexto);
  const cep = normalizarCep(parseCodigoComZeros(v('cep'), 8));
  const bairro = parseTexto(v('bairro'), 100);
  const natureza = parseCodigoDescricao(v('naturezaTransacao'), 120);
  const financiamento = parseCodigoDescricao(v('tipoFinanciamento'), 120);

  return {
    ok: true,
    transacao: {
      sqlCadastro: parseCodigoComZeros(v('sqlCadastro'), 11) ?? parseTexto(v('sqlCadastro'), 30),
      logradouro,
      numero: numeroTexto,
      complemento: parseTexto(v('complemento'), 100),
      referencia: parseTexto(v('referencia'), 150),
      bairro,
      bairroNormalizado: normalizarBairro(bairro),
      cep,
      cepPrefixo: prefixoCep(cep),
      enderecoChave: montarEnderecoChave(logradouro, numeroNorm, cep),
      naturezaCodigo: natureza.codigo,
      naturezaTransacao: natureza.descricao,
      valorTransacao,
      dataTransacao,
      valorVenalReferencia: parseDecimal(v('valorVenalReferencia'), 0, VALOR_MAXIMO),
      proporcaoTransmitida: parseDecimal(v('proporcaoTransmitida'), 0, 100, 4),
      tipoFinanciamentoCodigo: financiamento.codigo,
      tipoFinanciamento: financiamento.descricao,
      valorFinanciado: parseDecimal(v('valorFinanciado'), 0, VALOR_MAXIMO),
      situacaoSql: parseTexto(v('situacaoSql'), 40),
      areaTerreno: parseDecimal(v('areaTerreno'), 0, AREA_MAXIMA),
      fracaoIdeal: parseDecimal(v('fracaoIdeal'), 0, 1, 10),
      areaConstruida: parseDecimal(v('areaConstruida'), 0, AREA_MAXIMA),
      usoIptu: parseInteiro(v('usoIptu'), 0, 9999),
      usoDescricao: parseTexto(v('usoDescricao'), 150),
      padraoIptu: parseInteiro(v('padraoIptu'), 0, 9999),
      padraoDescricao: parseTexto(v('padraoDescricao'), 150),
      accIptu: parseInteiro(v('accIptu'), 1500, 2100),
    },
  };
}

// Texto canonico (campos NORMALIZADOS, ordem fixa) sobre o qual o sha256 e
// calculado: a mesma guia em duas importacoes (ou repetida no arquivo) gera
// o mesmo hash, mesmo com diferenca de caixa/acento/espaco.
export function textoParaHash(t: TransacaoItbiNova): string {
  const n = (x: number | null) => (x === null ? '' : String(x));
  const s = (x: string | null) => (x === null ? '' : x.toLowerCase());
  return [
    s(t.sqlCadastro),
    t.enderecoChave,
    s(t.complemento),
    s(t.referencia),
    t.bairroNormalizado ?? '',
    n(t.naturezaCodigo),
    s(t.naturezaTransacao),
    n(t.valorTransacao),
    formatarDataUtc(t.dataTransacao),
    n(t.valorVenalReferencia),
    n(t.proporcaoTransmitida),
    n(t.tipoFinanciamentoCodigo),
    s(t.tipoFinanciamento),
    n(t.valorFinanciado),
    s(t.situacaoSql),
    n(t.areaTerreno),
    n(t.fracaoIdeal),
    n(t.areaConstruida),
    n(t.usoIptu),
    n(t.padraoIptu),
    n(t.accIptu),
  ].join('\u001f');
}
