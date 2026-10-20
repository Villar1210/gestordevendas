// src/modules/bii/infra/providers/itbi-planilha.reader.ts
// Unico lugar do BII que conhece o exceljs. Leitura em STREAMING
// (stream.xlsx.WorkbookReader): o arquivo nunca e carregado inteiro como
// Workbook. Todas as abas sao lidas em ordem; cada celula vira um valor
// simples. Formulas NUNCA sao avaliadas: usa so o resultado guardado no
// arquivo ("result"); sem resultado -> null. Hyperlink -> texto exibido.
// Limites anti-"bomba": maximo de linhas no arquivo inteiro e de bytes LIDOS
// (soma aproximada do tamanho dos valores) - estourou, aborta com erro claro.
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  EventoPlanilha,
  IItbiPlanilhaReader,
  LimitesLeitura,
  PlanilhaLimiteExcedidoError,
} from '../../domain/ports/itbi-planilha-reader.interface';
import { ValorCelula } from '../../domain/services/itbi-valores';

export function celulaParaValor(valor: unknown): ValorCelula {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'object') {
    const v = valor as Record<string, unknown>;
    if ('formula' in v || 'sharedFormula' in v || 'result' in v) {
      return 'result' in v ? celulaParaValor(v.result) : null;
    }
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: unknown }[]).map((f) => String(f?.text ?? '')).join('');
    }
    if ('text' in v) return celulaParaValor(v.text);
    if ('error' in v) return null;
  }
  return null;
}

function tamanhoAproximado(v: ValorCelula): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? v.length : 8;
}

type LeitorAba = AsyncIterable<ExcelJS.Row> & { name?: string };

@Injectable()
export class ExceljsItbiPlanilhaReader implements IItbiPlanilhaReader {
  async *ler(caminho: string, limites: LimitesLeitura, signal?: AbortSignal): AsyncIterable<EventoPlanilha> {
    const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'cache', // necessario para o exceljs reconhecer celulas de data
      entries: 'ignore',
    });
    let linhas = 0;
    let bytes = 0;
    for await (const aba of leitor as unknown as AsyncIterable<LeitorAba>) {
      if (signal?.aborted) throw signal.reason ?? new Error('Abortado');
      yield { tipo: 'aba', nome: String(aba.name ?? '').slice(0, 100) };
      for await (const linha of aba) {
        if (signal?.aborted) throw signal.reason ?? new Error('Abortado');
        linhas++;
        if (linhas > limites.maxLinhas) {
          throw new PlanilhaLimiteExcedidoError(
            `A planilha passa do limite de ${limites.maxLinhas.toLocaleString('pt-BR')} linhas.`,
          );
        }
        const brutos = Array.isArray(linha.values) ? (linha.values as unknown[]) : [];
        const valores: ValorCelula[] = [];
        // row.values e 1-indexado e esparso
        for (let i = 1; i < brutos.length; i++) {
          const v = celulaParaValor(brutos[i]);
          bytes += tamanhoAproximado(v);
          valores.push(v);
        }
        if (bytes > limites.maxBytes) {
          throw new PlanilhaLimiteExcedidoError(
            `A planilha passa do limite de ${Math.round(limites.maxBytes / (1024 * 1024))} MB de dados.`,
          );
        }
        yield { tipo: 'linha', valores };
      }
    }
  }
}
