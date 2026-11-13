// src/modules/campanhas_sms/infra/planilha/leitor-planilha-contatos.ts
// Le .xlsx (aba "SMS" ou a primeira) ou .csv (separador ; ou ,) como linhas de
// texto. Formato decidido pelos BYTES: ZIP "PK\x03\x04" = xlsx; senao tem que
// ser texto UTF-8 sem byte nulo. Limites: o arquivo ja chega com no maximo
// 5 MB; ZIP com tamanho descompactado declarado > 60 MB, macro ou criptografia
// e recusado; leitura em streaming para de ler acima de maxLinhas.
// Formulas NUNCA sao avaliadas (so o valor guardado).
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { ArquivoInvalidoError, ILeitorPlanilhaContatos } from '../../domain/services/leitor-planilha.interface';

const MAX_DESCOMPACTADO = 60 * 1024 * 1024;
const MAX_ENTRADAS_ZIP = 2_000;

function ehZip(b: Buffer): boolean {
  return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/**
 * Le o diretorio central do ZIP (sem descompactar) e recusa o que nao deve
 * entrar. O tamanho declarado pode mentir: a defesa final e o teto de linhas
 * na leitura em streaming e o limite de 5 MB do arquivo.
 */
export function inspecionarZip(b: Buffer): void {
  const minEocd = 22;
  let eocd = -1;
  for (let i = b.length - minEocd; i >= Math.max(0, b.length - minEocd - 65_535); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArquivoInvalidoError('Arquivo .xlsx corrompido.');
  const entradas = b.readUInt16LE(eocd + 10);
  const tamDir = b.readUInt32LE(eocd + 12);
  const iniDir = b.readUInt32LE(eocd + 16);
  if (entradas === 0xffff || iniDir === 0xffffffff) throw new ArquivoInvalidoError('Formato .xlsx não suportado.');
  if (entradas > MAX_ENTRADAS_ZIP || iniDir + tamDir > b.length) throw new ArquivoInvalidoError('Arquivo .xlsx inválido.');
  let p = iniDir;
  let total = 0;
  for (let n = 0; n < entradas; n++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw new ArquivoInvalidoError('Arquivo .xlsx corrompido.');
    const flags = b.readUInt16LE(p + 8);
    const metodo = b.readUInt16LE(p + 10);
    const descompactado = b.readUInt32LE(p + 24);
    const lenNome = b.readUInt16LE(p + 28);
    const lenExtra = b.readUInt16LE(p + 30);
    const lenComent = b.readUInt16LE(p + 32);
    const nome = b.toString('utf8', p + 46, p + 46 + lenNome).toLowerCase();
    if (flags & 0x1) throw new ArquivoInvalidoError('Planilha protegida por senha não é aceita.');
    if (metodo !== 0 && metodo !== 8) throw new ArquivoInvalidoError('Formato .xlsx não suportado.');
    if (nome.includes('vbaproject') || nome.endsWith('.bin')) throw new ArquivoInvalidoError('Planilha com macro não é aceita.');
    total += descompactado;
    if (total > MAX_DESCOMPACTADO) throw new ArquivoInvalidoError('Planilha grande demais depois de descompactada.');
    p += 46 + lenNome + lenExtra + lenComent;
  }
}

function valorCelula(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'string' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if ('result' in o) return o.result === undefined || o.result === null ? '' : String(o.result as string);
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return String(o.text);
  }
  return '';
}

@Injectable()
export class LeitorPlanilhaContatos implements ILeitorPlanilhaContatos {
  async ler(arquivo: Buffer, _nomeArquivo: string, maxLinhas: number): Promise<unknown[][]> {
    if (ehZip(arquivo)) return this.lerXlsx(arquivo, maxLinhas);
    return this.lerCsv(arquivo, maxLinhas);
  }

  private async lerXlsx(arquivo: Buffer, maxLinhas: number): Promise<unknown[][]> {
    inspecionarZip(arquivo);
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(arquivo), {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });
    // Abas em ordem; a aba "SMS" (se existir) vence a primeira.
    let primeira: unknown[][] | null = null;
    let sms: unknown[][] | null = null;
    try {
      for await (const ws of reader) {
        const nome = String((ws as unknown as { name?: string }).name ?? '').trim().toLowerCase();
        const linhas: unknown[][] = [];
        for await (const row of ws) {
          if (linhas.length > maxLinhas) {
            throw new ArquivoInvalidoError(`A planilha passa do limite de ${maxLinhas.toLocaleString('pt-BR')} linhas.`);
          }
          const valores = (row.values as ExcelJS.CellValue[]).slice(1).map(valorCelula);
          linhas.push(valores);
        }
        if (!primeira) primeira = linhas;
        if (nome === 'sms') {
          sms = linhas;
          break;
        }
      }
    } catch (e) {
      if (e instanceof ArquivoInvalidoError) throw e;
      throw new ArquivoInvalidoError('Não foi possível ler a planilha .xlsx.');
    }
    const escolhida = sms ?? primeira;
    if (!escolhida || escolhida.length === 0) throw new ArquivoInvalidoError('A planilha está vazia.');
    return escolhida;
  }

  private lerCsv(arquivo: Buffer, maxLinhas: number): unknown[][] {
    if (arquivo.includes(0)) throw new ArquivoInvalidoError('Envie uma planilha .xlsx ou .csv.');
    let texto = arquivo.toString('utf8');
    if (texto.includes('�')) texto = arquivo.toString('latin1'); // CSV salvo pelo Excel em ANSI
    texto = texto.replace(/^﻿/, '');
    const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? '';
    const delimitador = (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ',';
    try {
      const linhas = parse(texto, {
        delimiter: delimitador,
        relax_column_count: true,
        skip_empty_lines: true,
        to_line: maxLinhas + 2,
        bom: true,
      }) as string[][];
      if (linhas.length > maxLinhas + 1) {
        throw new ArquivoInvalidoError(`A planilha passa do limite de ${maxLinhas.toLocaleString('pt-BR')} linhas.`);
      }
      return linhas;
    } catch (e) {
      if (e instanceof ArquivoInvalidoError) throw e;
      throw new ArquivoInvalidoError('Não foi possível ler o arquivo .csv.');
    }
  }
}
