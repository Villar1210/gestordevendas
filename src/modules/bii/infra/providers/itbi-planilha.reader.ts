// src/modules/bii/infra/providers/itbi-planilha.reader.ts
// Unico lugar do BII que conhece o exceljs. Leitura em STREAMING
// (stream.xlsx.WorkbookReader): o arquivo nunca e carregado inteiro como
// Workbook. Todas as abas sao lidas em ordem; cada celula vira um valor
// simples. Formulas NUNCA sao avaliadas: usa so o resultado guardado no
// arquivo ("result"); sem resultado -> null. Hyperlink -> texto exibido.
// Limites anti-"bomba": maximo de linhas no arquivo inteiro e de bytes LIDOS
// (soma aproximada do tamanho dos valores) - estourou, aborta com erro claro.
// Os temporarios do exceljs (abas descompactadas, em os.tmpdir() - ver por que
// nao na pasta 0o700 em exceljs-tmp.ts) sao REGISTRADOS durante a leitura e
// apagados no fim, em erro, em abort e quando o consumidor para de ler
// (return()). O tamanho real ja foi limitado antes (inspecionarZip: 1,5 GiB).
import { Injectable } from '@nestjs/common';
import { truncate, unlink } from 'fs/promises';
import * as ExcelJS from 'exceljs';
import { comRegistroDeTemporarios } from './exceljs-tmp';
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

// Leitura interrompida no meio: o exceljs pode ter acabado de criar o
// ReadStream (abertura preguicosa, no proximo tick) de uma aba que ninguem vai
// consumir - apagar o arquivo nessa hora gera um 'error' ENOENT sem ouvinte
// (excecao nao tratada, derruba o processo). Por isso: TRUNCA na hora (libera
// o disco; uma abertura atrasada so le vazio) e apaga depois deste prazo
// (timer unref; na saida do processo o tmp.setGracefulCleanup do exceljs
// tambem apaga). Leitura completa: apaga na hora.
export const ATRASO_APAGAR_TEMPORARIO_MS = 30_000;

@Injectable()
export class ExceljsItbiPlanilhaReader implements IItbiPlanilhaReader {
  // temporarios do exceljs da ultima leitura (so para teste)
  ultimosTemporarios: string[] = [];
  atrasoApagarMs = ATRASO_APAGAR_TEMPORARIO_MS;

  // Cada next()/return() do gerador interno roda DENTRO do contexto de
  // registro: o exceljs chama tmp.file durante essas continuacoes.
  ler(caminho: string, limites: LimitesLeitura, signal?: AbortSignal): AsyncIterable<EventoPlanilha> {
    const leitor = this;
    return {
      [Symbol.asyncIterator]() {
        const registrados = new Set<string>();
        let interno: AsyncGenerator<EventoPlanilha> | null = null;
        let limpo = false;
        const limpar = async (completa: boolean) => {
          if (limpo) return;
          limpo = true;
          const lista = [...registrados];
          leitor.ultimosTemporarios = lista;
          if (completa) {
            await Promise.all(lista.map((p) => unlink(p).catch(() => undefined)));
            return;
          }
          await Promise.all(lista.map((p) => truncate(p, 0).catch(() => undefined)));
          const t = setTimeout(() => {
            for (const p of lista) unlink(p).catch(() => undefined);
          }, leitor.atrasoApagarMs);
          t.unref?.();
        };
        return {
          async next() {
            interno ??= leitor.lerInterno(caminho, limites, signal);
            try {
              const r = await comRegistroDeTemporarios(registrados, () => interno!.next());
              if (r.done) await limpar(true);
              return r;
            } catch (erro) {
              await limpar(false);
              throw erro;
            }
          },
          async return() {
            try {
              if (interno) await comRegistroDeTemporarios(registrados, () => interno!.return(undefined));
            } finally {
              await limpar(false);
            }
            return { done: true, value: undefined };
          },
        };
      },
    };
  }

  private async *lerInterno(caminho: string, limites: LimitesLeitura, signal?: AbortSignal): AsyncGenerator<EventoPlanilha> {
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
