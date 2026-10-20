import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { EventoPlanilha, IItbiPlanilhaReader } from '../../domain/ports/itbi-planilha-reader.interface';
import { IItbiImportacaoRepository } from '../../domain/repositories/itbi-importacao-repository.interface';
import { IItbiRepository } from '../../domain/repositories/itbi-repository.interface';
import { ImportadorItbiService } from './importador-itbi.service';

describe('ImportadorItbiService - desligamento (unitario)', () => {
  it('onModuleDestroy aborta a leitura, grava "erro" e apaga o temporario', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), 'bii-imp-unit-'));
    const caminho = join(dir, 'x.xlsx');
    writeFileSync(caminho, 'x');
    const reader: IItbiPlanilhaReader = {
      async *ler(_c: string, _l: unknown, signal?: AbortSignal): AsyncIterable<EventoPlanilha> {
        yield { tipo: 'aba', nome: 'JAN-2026' };
        await new Promise((_r, rej) => {
          if (signal?.aborted) return rej(signal.reason);
          signal?.addEventListener('abort', () => rej(signal.reason));
        });
      },
    } as IItbiPlanilhaReader;
    const finalizar = jest.fn(async () => undefined);
    const importacoes = {
      criar: async () => ({ id: 'imp-1' }),
      listarProcessando: async () => [],
      finalizar,
    } as unknown as IItbiImportacaoRepository;
    const svc = new ImportadorItbiService(reader, {} as IItbiRepository, importacoes);
    await svc.iniciar({ caminho, nomeArquivo: 'x.xlsx', ano: 2026, userId: 'u' });
    expect(svc.ocupado).toBe(true);
    await svc.onModuleDestroy();
    expect(finalizar).toHaveBeenCalledWith('imp-1', 'erro', expect.anything(), expect.stringMatching(/desligando/));
    expect(existsSync(caminho)).toBe(false);
    expect(svc.ocupado).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
