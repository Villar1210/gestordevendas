import { assertBatchCount, BatchProcessor, batchFileError } from './batch-processor';
import { IZipBuilder } from '../domain/services/zip-builder.interface';
import { PdfToolsError } from '../domain/pdf-tools.errors';
import { uniqueFileNames } from '../domain/file-name';
import { PdfToolResult } from './pdf-tool.types';
import { PDF_TOOLS_LIMITS } from '../domain/pdf-tools.limits';
import { timeBudget } from '../infra/services/process-runner';

function zipMock() {
  return { build: jest.fn().mockReturnValue(Buffer.from('ZIPDATA')) };
}

function file(name: string) {
  return { buffer: Buffer.from(name), originalname: name };
}

function result(fileName: string, size: number, meta: Record<string, number | boolean> = {}): PdfToolResult {
  return { data: Buffer.alloc(size), fileName, contentType: 'application/pdf', meta: { originalSize: size * 2, ...meta } };
}

describe('uniqueFileNames', () => {
  it('desambigua sem diferenciar maiusculas, preservando a extensao', () => {
    expect(uniqueFileNames(['contrato_comprimido.pdf', 'Contrato_comprimido.PDF', 'contrato_comprimido.pdf', 'outro.pdf'])).toEqual([
      'contrato_comprimido.pdf',
      'Contrato_comprimido (2).PDF',
      'contrato_comprimido (3).pdf',
      'outro.pdf',
    ]);
  });

  it('sem extensao (pastas) o sufixo vai no fim; nao colide com um "(2)" ja existente', () => {
    expect(uniqueFileNames(['a', 'a', 'a (2)'], false)).toEqual(['a', 'a (2)', 'a (2) (2)']);
    expect(uniqueFileNames(['v1.2', 'v1.2'], false)).toEqual(['v1.2', 'v1.2 (2)']);
  });
});

describe('BatchProcessor.run', () => {
  it('valida TODOS antes de processar o primeiro e processa em sequencia', async () => {
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    const out = await new BatchProcessor(zipMock() as unknown as IZipBuilder).run([file('a.pdf'), file('b.pdf'), file('c.pdf')], {
      validate: async (f, i) => {
        calls.push(`v:${f.originalname}`);
        return i * 10;
      },
      process: async (f, v, i) => {
        active++;
        maxActive = Math.max(maxActive, active);
        calls.push(`p:${f.originalname}:${v}:${i}`);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return f.originalname.toUpperCase();
      },
    });
    expect(calls).toEqual(['v:a.pdf', 'v:b.pdf', 'v:c.pdf', 'p:a.pdf:0:0', 'p:b.pdf:10:1', 'p:c.pdf:20:2']);
    expect(maxActive).toBe(1);
    expect(out).toEqual(['A.PDF', 'B.PDF', 'C.PDF']);
  });

  it('erro na validacao de um arquivo: nao processa NENHUM e a mensagem nomeia o arquivo', async () => {
    const process = jest.fn();
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('ok.pdf'), file('proposta.pdf'), file('c.pdf')], {
        validate: async (f) => {
          if (f.originalname === 'proposta.pdf') throw new PdfToolsError('ENCRYPTED_PDF', 'protegido');
          return 1;
        },
        process,
      })
      .catch((e) => e);
    expect(process).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(PdfToolsError);
    expect(err.code).toBe('ENCRYPTED_PDF');
    expect(err.message).toBe('"proposta.pdf" está protegido por senha. Remova-o da lista ou use a ferramenta Desbloquear PDF primeiro.');
  });

  it('erro no processamento aborta o lote (nao continua para os proximos)', async () => {
    const process = jest.fn(async (f: { originalname: string }) => {
      if (f.originalname === 'b.pdf') throw new PdfToolsError('WRONG_PASSWORD', 'Senha incorreta.');
      return 1;
    });
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('a.pdf'), file('b.pdf'), file('c.pdf')], { process })
      .catch((e) => e);
    expect(process).toHaveBeenCalledTimes(2);
    expect(err.code).toBe('WRONG_PASSWORD');
    expect(err.message).toMatch(/^Senha incorreta para "b\.pdf"/);
  });

  it('com 1 arquivo o erro sai INTACTO (contrato antigo)', async () => {
    const original = new PdfToolsError('ENCRYPTED_PDF', 'Este PDF está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.');
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('a.pdf')], {
        validate: async () => {
          throw original;
        },
        process: jest.fn(),
      })
      .catch((e) => e);
    expect(err).toBe(original);
  });

  it('erro que nao e PdfToolsError passa adiante sem ser embrulhado', async () => {
    const boom = new TypeError('x');
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('a.pdf'), file('b.pdf')], {
        process: async () => {
          throw boom;
        },
      })
      .catch((e) => e);
    expect(err).toBe(boom);
  });
});

describe('batchFileError', () => {
  it('nomeia o arquivo em cada categoria; TOOL_UNAVAILABLE fica igual', () => {
    const corrupted = batchFileError(
      new PdfToolsError('INVALID_INPUT', 'Não foi possível ler o PDF. Verifique se o arquivo não está corrompido.'),
      'x.pdf',
    ) as PdfToolsError;
    expect(corrupted.message).toBe('Não foi possível ler "x.pdf". Verifique se o arquivo não está corrompido.');
    expect((batchFileError(new PdfToolsError('INVALID_INPUT', 'A página 9 não existe.'), 'x.pdf') as PdfToolsError).message).toBe(
      '"x.pdf": A página 9 não existe.',
    );
    expect((batchFileError(new PdfToolsError('PROCESSING_FAILED', 'Não foi possível comprimir o PDF.'), 'x.pdf') as PdfToolsError)).toMatchObject({
      code: 'PROCESSING_FAILED',
      message: '"x.pdf": Não foi possível comprimir o PDF.',
    });
    const unavailable = new PdfToolsError('TOOL_UNAVAILABLE', 'indisponivel');
    expect(batchFileError(unavailable, 'x.pdf')).toBe(unavailable);
  });
});

describe('assertBatchCount', () => {
  it('0 ou acima do maximo -> 400', () => {
    expect(() => assertBatchCount([], 20)).toThrow(/pelo menos 1/);
    expect(() => assertBatchCount(Array.from({ length: 11 }, () => file('a.docx')), 10, 'documentos')).toThrow(
      'Envie no máximo 10 documentos por vez.',
    );
    expect(() => assertBatchCount(Array.from({ length: 20 }, () => file('a.pdf')), 20)).not.toThrow();
  });
});

describe('BatchProcessor.zipResults', () => {
  it('ZIP com os nomes individuais desambiguados e meta com somas do CONTEUDO', () => {
    const zip = zipMock();
    const out = new BatchProcessor(zip as unknown as IZipBuilder).zipResults(
      [result('contrato_comprimido.pdf', 100, { pages: 2 }), result('contrato_comprimido.pdf', 50, { pages: 3 }), result('b_comprimido.pdf', 10, { pages: 1 })],
      'comprimidos.zip',
      ['pages'],
      { alreadyOptimized: 1 },
    );
    expect(zip.build).toHaveBeenCalledWith([
      { name: 'contrato_comprimido.pdf', data: expect.any(Buffer) },
      { name: 'contrato_comprimido (2).pdf', data: expect.any(Buffer) },
      { name: 'b_comprimido.pdf', data: expect.any(Buffer) },
    ]);
    expect(out.fileName).toBe('comprimidos.zip');
    expect(out.contentType).toBe('application/zip');
    expect(out.data.toString()).toBe('ZIPDATA');
    expect(out.meta).toEqual({ files: 3, pages: 6, originalSize: 320, resultSize: 160, alreadyOptimized: 1 });
  });
});

describe('BatchProcessor: prazo total do lote (relogio falso)', () => {
  const DEADLINE = PDF_TOOLS_LIMITS.batchDeadlineMs; // 240s

  function setup() {
    let now = 1_000_000;
    const clock = () => now;
    const advance = (ms: number) => {
      now += ms;
    };
    return { processor: new BatchProcessor(zipMock() as unknown as IZipBuilder, clock), advance };
  }

  it('estouro no meio: aborta ANTES do proximo arquivo com BATCH_TIMEOUT "N de M"', async () => {
    const { processor, advance } = setup();
    const budgets: number[] = [];
    const process = jest.fn(async (_f: unknown, _v: unknown, _i: number, budget?: { timeoutMs?: number }) => {
      budgets.push(budget!.timeoutMs!);
      advance(100_000); // cada arquivo leva 100s
      return 'ok';
    });
    const err = await processor.run([file('a'), file('b'), file('c'), file('d')], { process }).catch((e) => e);
    // 0s, 100s, 200s iniciam; aos 300s (> 240s) o 4o nao comeca
    expect(process).toHaveBeenCalledTimes(3);
    expect(budgets).toEqual([DEADLINE, DEADLINE - 100_000, DEADLINE - 200_000]);
    expect(err).toBeInstanceOf(PdfToolsError);
    expect(err.code).toBe('BATCH_TIMEOUT');
    expect(err.message).toBe(
      'O lote demorou mais que o limite (4 min). Envie menos arquivos por vez — já tinham sido processados 3 de 4.',
    );
  });

  it('a validacao tambem consome o prazo', async () => {
    const { processor, advance } = setup();
    const process = jest.fn();
    const err = await processor
      .run([file('a'), file('b')], {
        validate: async () => {
          advance(130_000);
        },
        process,
      })
      .catch((e) => e);
    expect(process).not.toHaveBeenCalled();
    expect(err.code).toBe('BATCH_TIMEOUT');
    expect(err.message).toMatch(/processados 0 de 2/);
  });

  it('binario morto pelo prazo durante o arquivo -> BATCH_TIMEOUT (nao a falha generica do arquivo)', async () => {
    const { processor, advance } = setup();
    let calls = 0;
    const err = await processor
      .run([file('a.docx'), file('b.docx'), file('c.docx')], {
        process: async (_f, _v, _i, budget) => {
          calls++;
          if (calls === 1) {
            advance(90_000);
            return 'ok';
          }
          advance(budget!.timeoutMs!); // gastou todo o restante e o soffice foi morto
          throw new PdfToolsError('PROCESSING_FAILED', 'A conversão demorou demais e foi cancelada.');
        },
      })
      .catch((e) => e);
    expect(err.code).toBe('BATCH_TIMEOUT');
    expect(err.message).toMatch(/processados 1 de 3/);
  });

  it('dentro do prazo termina normal; erro real do arquivo continua nomeando o arquivo', async () => {
    const { processor, advance } = setup();
    const out = await processor.run([file('a'), file('b')], {
      process: async () => {
        advance(119_000);
        return 1;
      },
    });
    expect(out).toEqual([1, 1]);

    const t = setup();
    const err = await t.processor
      .run([file('a.pdf'), file('b.pdf')], {
        process: async (f) => {
          t.advance(10_000);
          if (f.originalname === 'b.pdf') throw new PdfToolsError('PROCESSING_FAILED', 'falhou');
          return 1;
        },
      })
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'PROCESSING_FAILED', message: '"b.pdf": falhou' });
  });

  it('1 arquivo: sem prazo do lote (budget undefined, nunca BATCH_TIMEOUT)', async () => {
    const { processor, advance } = setup();
    const process = jest.fn(async (_f: unknown, _v: unknown, _i: number, budget?: unknown) => {
      advance(DEADLINE * 2);
      return budget;
    });
    await expect(processor.run([file('a')], { process })).resolves.toEqual([undefined]);
  });
});

describe('timeBudget (process-runner)', () => {
  afterEach(() => jest.useRealTimers());

  it('menor entre o limite do binario e o restante pedido, descontando a espera na fila', () => {
    jest.useFakeTimers({ now: 0 });
    expect(timeBudget(90_000)()).toBe(90_000);
    expect(timeBudget(90_000, 300_000)()).toBe(90_000);
    const budget = timeBudget(90_000, 50_000);
    jest.setSystemTime(20_000); // 20s esperando na fila
    expect(budget()).toBe(30_000);
    jest.setSystemTime(60_000);
    expect(budget()).toBe(1); // nunca 0/negativo
  });
});

describe('BatchProcessor: tetos de paginas e de saida (A2/M3)', () => {
  const processor = () => new BatchProcessor(zipMock() as unknown as IZipBuilder);

  it('soma de paginas acima de 5000 -> TOO_LARGE nomeando o arquivo, ANTES de processar qualquer um', async () => {
    const counts: Record<string, number> = { 'a.pdf': 2000, 'b.pdf': 2000, 'c.pdf': 1001 };
    const process = jest.fn();
    const err = await processor()
      .run([file('a.pdf'), file('b.pdf'), file('c.pdf')], {
        validate: async (f) => counts[f.originalname],
        weight: (pages) => pages,
        process,
      })
      .catch((e) => e);
    expect(process).not.toHaveBeenCalled();
    expect(err).toMatchObject({ code: 'TOO_LARGE' });
    expect(err.message).toMatch(/mais de 5\.000 páginas.*"c\.pdf", com 5\.001 no total/);
  });

  it('exatamente 5000 passa; 1 arquivo nao usa o teto do lote', async () => {
    await expect(
      processor().run([file('a'), file('b'), file('c')], {
        validate: async (_f, i) => [2000, 2000, 1000][i],
        weight: (p) => p,
        process: async () => 1,
      }),
    ).resolves.toEqual([1, 1, 1]);
    await expect(
      processor().run([file('a')], { validate: async () => 9999, weight: (p) => p, process: async () => 1 }),
    ).resolves.toEqual([1]);
  });

  it('saida do lote acima de 150 MB -> TOO_LARGE nomeando onde estourou (nao processa os seguintes)', async () => {
    const big = { data: Buffer.alloc(0) };
    const process = jest.fn(async () => big);
    const err = await processor()
      .run([file('a.pdf'), file('b.pdf'), file('c.pdf')], {
        process,
        outputBytes: () => 80 * 1024 * 1024, // 80 MB cada (mock, sem alocar)
      })
      .catch((e) => e);
    expect(process).toHaveBeenCalledTimes(2);
    expect(err).toMatchObject({ code: 'TOO_LARGE' });
    expect(err.message).toBe('O resultado do lote passa de 150 MB (estourou em "b.pdf"). Envie menos arquivos por vez.');
  });

  it('1 arquivo: teto de 120 MB; por padrao mede result.data.length', async () => {
    const err = await processor()
      .run([file('a.pdf')], { process: async () => ({ data: Buffer.alloc(1) }), outputBytes: () => 121 * 1024 * 1024 })
      .catch((e) => e);
    expect(err.message).toBe('O arquivo gerado passa do limite de 120 MB.');
    await expect(processor().run([file('a.pdf')], { process: async () => ({ data: Buffer.alloc(10) }) })).resolves.toHaveLength(1);
  });
});

describe('BatchProcessor: cancelamento (M2)', () => {
  it('abort no meio: nao inicia o proximo arquivo, ABORTED, signal repassado ao processamento', async () => {
    const controller = new AbortController();
    const seen: (AbortSignal | undefined)[] = [];
    const process = jest.fn(async (_f: unknown, _v: unknown, i: number, budget?: { signal?: AbortSignal }) => {
      seen.push(budget?.signal);
      if (i === 1) controller.abort(); // cliente fechou a aba durante o 2o arquivo
      return i;
    });
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('a'), file('b'), file('c'), file('d')], { process }, { signal: controller.signal })
      .catch((e) => e);
    expect(process).toHaveBeenCalledTimes(2);
    expect(seen.every((s) => s === controller.signal)).toBe(true);
    expect(err).toMatchObject({ code: 'ABORTED' });
  });

  it('binario morto pelo abort -> ABORTED (nao "falha no arquivo x"), tambem com 1 arquivo', async () => {
    const controller = new AbortController();
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run(
        [file('a.docx')],
        {
          process: async () => {
            controller.abort();
            throw new PdfToolsError('PROCESSING_FAILED', 'Não foi possível converter o documento para PDF.');
          },
        },
        { signal: controller.signal },
      )
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'ABORTED' });
  });

  it('ja cancelado antes de comecar: nem valida', async () => {
    const controller = new AbortController();
    controller.abort();
    const validate = jest.fn();
    const err = await new BatchProcessor(zipMock() as unknown as IZipBuilder)
      .run([file('a'), file('b')], { validate, process: jest.fn() }, { signal: controller.signal })
      .catch((e) => e);
    expect(validate).not.toHaveBeenCalled();
    expect(err.code).toBe('ABORTED');
  });
});
