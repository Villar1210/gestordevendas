// src/modules/gestao_imobiliaria/infra/services/disk-book-temporario.storage.ts
// PDF do book guardado em pasta TEMPORARIA do sistema (fora de /uploads, que
// e publica). Em disco, e nao em memoria, porque o backend roda em cluster
// (varios processos): a analise e a confirmacao podem cair em processos
// diferentes. O tenant faz parte do nome do arquivo.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import { BOOK_VALIDADE_MS } from '../../domain/services/book-empreendimento';

const PASTA = join(tmpdir(), 'gestordevendas-books');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Injectable()
export class DiskBookTemporarioStorage implements IBookTemporarioStorage {
  private readonly logger = new Logger(DiskBookTemporarioStorage.name);

  private caminho(tenantId: string, id: string): string | null {
    if (!UUID.test(tenantId) || !UUID.test(id)) return null;
    return join(PASTA, `${tenantId}__${id}.pdf`);
  }

  async salvar(tenantId: string, pdf: Buffer): Promise<string> {
    await mkdir(PASTA, { recursive: true, mode: 0o700 });
    await this.limparVencidos();
    const id = randomUUID();
    const destino = this.caminho(tenantId, id);
    if (!destino) throw new Error('Identificador de empresa inválido.');
    await writeFile(destino, pdf, { mode: 0o600 });
    return id;
  }

  async ler(tenantId: string, id: string): Promise<Buffer | null> {
    void this.limparVencidos();
    const origem = this.caminho(tenantId, id);
    if (!origem) return null;
    try {
      const info = await stat(origem);
      if (Date.now() - info.mtimeMs > BOOK_VALIDADE_MS) return null;
      return await readFile(origem);
    } catch {
      return null;
    }
  }

  async remover(tenantId: string, id: string): Promise<void> {
    const alvo = this.caminho(tenantId, id);
    if (alvo) await unlink(alvo).catch(() => undefined);
  }

  private async limparVencidos(): Promise<void> {
    try {
      const agora = Date.now();
      for (const nome of await readdir(PASTA)) {
        const arquivo = join(PASTA, nome);
        const info = await stat(arquivo).catch(() => null);
        if (info && agora - info.mtimeMs > BOOK_VALIDADE_MS) await unlink(arquivo).catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(`Limpeza de books temporários falhou: ${err instanceof Error ? err.message : err}`);
    }
  }
}
