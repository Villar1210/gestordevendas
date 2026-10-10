// src/modules/pdf_tools/application/use-cases/extract-text.use-case.ts
// 1 a 20 PDFs. Resposta so com { pages, byPage } (o texto completo e
// montado no cliente juntando as paginas - sem duplicar o conteudo):
// 1 PDF -> { pages, byPage }; varios -> { files: [{ name, pages, byPage }] }
// na ordem enviada (nomes repetidos desambiguados: "a.pdf", "a (2).pdf").
// Limites de texto (tambem com 1 arquivo): 2 milhoes de caracteres por
// arquivo e 5 milhoes no total - o extrator para no meio assim que passa.
import { Inject, Injectable } from '@nestjs/common';
import { IPdfEngine } from '../../domain/services/pdf-engine.interface';
import { IPdfTextExtractor } from '../../domain/services/pdf-text-extractor.interface';
import { PdfToolsError } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';
import { uniqueFileNames } from '../../domain/file-name';
import { InputFile } from '../pdf-tool.types';
import { assertBatchCount, BatchProcessor } from '../batch-processor';

export interface ExtractTextOutput {
  pages: number;
  byPage: { page: number; text: string }[];
}

export interface ExtractTextBatchOutput {
  files: (ExtractTextOutput & { name: string })[];
}

const millions = (n: number) => `${(n / 1_000_000).toLocaleString('pt-BR')} milhões`;

/** Nome devolvido ao cliente: sem caracteres de controle nem de direcao (bidi). */
export function safeDisplayName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '');
}

function countChars(output: ExtractTextOutput): number {
  return output.byPage.reduce((acc, p) => acc + p.text.length, 0);
}

@Injectable()
export class ExtractTextUseCase {
  constructor(
    @Inject('IPdfEngine') private readonly engine: IPdfEngine,
    @Inject('IPdfTextExtractor') private readonly extractor: IPdfTextExtractor,
    private readonly batch: BatchProcessor,
  ) {}

  async execute(input: { files: InputFile[]; signal?: AbortSignal }): Promise<ExtractTextOutput | ExtractTextBatchOutput> {
    assertBatchCount(input.files, PDF_TOOLS_LIMITS.batchMaxFiles, 'PDFs');
    const perFile = PDF_TOOLS_LIMITS.extractTextMaxCharsPerFile;
    const totalMax = PDF_TOOLS_LIMITS.extractTextMaxCharsTotal;
    let used = 0;
    const results = await this.batch.run(
      input.files,
      {
        // pdf-lib primeiro: PDF protegido -> 422 ENCRYPTED_PDF com a mensagem
        // padrao; PDF com paginas demais -> 413 antes de extrair.
        validate: (file) => this.engine.getPageCount(file.buffer),
        weight: (pages) => pages,
        process: async (file): Promise<ExtractTextOutput> => {
          const remaining = totalMax - used;
          const maxChars = Math.min(perFile, remaining);
          let result;
          try {
            result = await this.extractor.extract(file.buffer, { maxChars });
          } catch (error) {
            if (error instanceof PdfToolsError && error.code === 'TOO_LARGE') {
              throw new PdfToolsError(
                'TOO_LARGE',
                remaining < perFile
                  ? `O texto extraído dos arquivos passa do limite de ${millions(totalMax)} de caracteres por envio. Envie menos arquivos por vez.`
                  : `O texto extraído passa do limite de ${millions(perFile)} de caracteres por arquivo. Divida o PDF em partes menores.`,
              );
            }
            throw error;
          }
          const output = { pages: result.pages, byPage: result.byPage.map((p) => ({ page: p.page, text: p.text.trim() })) };
          used += countChars(output);
          return output;
        },
        // O teto de saida do lote e sobre o texto (UTF-16 ~ 2 bytes/char).
        outputBytes: (output) => countChars(output) * 2,
      },
      { signal: input.signal },
    );
    if (results.length === 1) return results[0];
    const names = uniqueFileNames(input.files.map((f) => safeDisplayName(f.originalname)));
    return { files: results.map((r, i) => ({ name: names[i], ...r })) };
  }
}

export function extractedTextBytes(output: ExtractTextOutput | ExtractTextBatchOutput): number {
  const docs = 'files' in output ? output.files : [output];
  return docs.reduce((acc, d) => acc + d.byPage.reduce((a, p) => a + Buffer.byteLength(p.text, 'utf8'), 0), 0);
}
