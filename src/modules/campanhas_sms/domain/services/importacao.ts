// src/modules/campanhas_sms/domain/services/importacao.ts
// Transforma as linhas da planilha (ja lidas como texto pela infra) em
// contatos validos (dominio puro). Cabecalho reconhecido por NOME, sem acento,
// sem caixa e sem pontuacao. Colunas desconhecidas sao ignoradas (minimizacao:
// so entra o que a campanha usa).
import { normalizarCelularBR } from './telefone';
import { primeiroNomeParaSms } from './sms-texto';

export type CampoContato = 'nome' | 'primeiroNome' | 'telefone' | 'corretor' | 'referencia';

const SINONIMOS: Record<CampoContato, string[]> = {
  nome: ['nome', 'nome da conta', 'nome completo', 'cliente', 'contato', 'lead'],
  primeiroNome: ['primeiro nome', 'primeironome', 'primeiro_nome'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'telefone whatsapp', 'telefone so numeros', 'whatsapp so numeros', 'numero'],
  corretor: ['corretor', 'responsavel', 'responsavel corretor', 'atendente'],
  referencia: ['referencia', 'numero lead', 'n lead', 'no lead', 'lead id', 'id lead', 'codigo'],
};

export function normalizarCabecalho(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type MapaColunas = Partial<Record<CampoContato, number>>;

export function mapearCabecalho(cabecalho: unknown[]): MapaColunas {
  const mapa: MapaColunas = {};
  const nomes = cabecalho.map(normalizarCabecalho);
  // "lead" sozinho e nome (Oracle) mas "numero lead" e referencia: os sinonimos
  // mais especificos (com mais palavras) vencem.
  const candidatos = (Object.keys(SINONIMOS) as CampoContato[])
    .flatMap((campo) => SINONIMOS[campo].map((s) => ({ campo, s: normalizarCabecalho(s) })))
    .sort((a, b) => b.s.length - a.s.length);
  const usadas = new Set<number>();
  for (const { campo, s } of candidatos) {
    if (mapa[campo] !== undefined) continue;
    const idx = nomes.findIndex((n, i) => !usadas.has(i) && n === s);
    if (idx >= 0) {
      mapa[campo] = idx;
      usadas.add(idx);
    }
  }
  return mapa;
}

export interface ContatoImportado {
  nome: string;
  primeiroNome: string;
  telefone: string;
  corretor: string | null;
  referencia: string | null;
}

export interface ResultadoLeitura {
  contatos: ContatoImportado[];
  invalidos: number;
  duplicadosNoArquivo: number;
  linhasLidas: number;
}

export class CabecalhoInvalidoError extends Error {}

function texto(v: unknown, max: number): string {
  return String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * linhas[0] = cabecalho. Linhas totalmente vazias nao contam.
 * Lanca CabecalhoInvalidoError se nao achar a coluna de telefone.
 */
export function lerContatos(linhas: unknown[][]): ResultadoLeitura {
  if (linhas.length === 0) throw new CabecalhoInvalidoError('A planilha está vazia.');
  const mapa = mapearCabecalho(linhas[0]);
  if (mapa.telefone === undefined) {
    throw new CabecalhoInvalidoError(
      'Não encontrei a coluna de telefone. Use um cabeçalho "telefone", "celular" ou "whatsapp" na primeira linha.',
    );
  }
  const vistos = new Set<string>();
  const contatos: ContatoImportado[] = [];
  let invalidos = 0;
  let duplicados = 0;
  let lidas = 0;
  for (const linha of linhas.slice(1)) {
    if (!linha || linha.every((c) => String(c ?? '').trim() === '')) continue;
    lidas++;
    const telefone = normalizarCelularBR(linha[mapa.telefone]);
    if (!telefone) {
      invalidos++;
      continue;
    }
    if (vistos.has(telefone)) {
      duplicados++;
      continue;
    }
    vistos.add(telefone);
    const nome = mapa.nome !== undefined ? texto(linha[mapa.nome], 150) : '';
    const primeiroBruto = mapa.primeiroNome !== undefined ? texto(linha[mapa.primeiroNome], 40) : '';
    contatos.push({
      nome,
      primeiroNome: primeiroNomeParaSms(primeiroBruto || nome),
      telefone,
      corretor: mapa.corretor !== undefined ? texto(linha[mapa.corretor], 120) || null : null,
      referencia: mapa.referencia !== undefined ? texto(linha[mapa.referencia], 60) || null : null,
    });
  }
  return { contatos, invalidos, duplicadosNoArquivo: duplicados, linhasLidas: lidas };
}
