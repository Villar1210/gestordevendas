// src/modules/gestao_imobiliaria/infra/services/disk-book-temporario.storage.ts
// Book guardado em pasta TEMPORARIA do sistema (fora de /uploads, que e
// publica). Em disco, e nao em memoria, porque o backend roda em cluster
// (varios processos): a analise e a confirmacao podem cair em processos
// diferentes. O tenant faz parte do nome.
// Formato:
// - PDF: um arquivo "<tenant>__<id>.pdf" (formato original, inalterado).
// - Imagens: uma pasta "<tenant>__<id>/" com 001.jpg, 002.jpg... e um
//   "manifesto.json" ({ origem, paginas }) gravado POR ULTIMO - pasta sem
//   manifesto (gravacao interrompida) e tratada como inexistente.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BookTemporario, IBookTemporarioStorage } from '../../domain/services/book-temporario.interface';
import { BOOK_MAX_IMAGENS, BOOK_VALIDADE_MS } from '../../domain/services/book-empreendimento';

const PASTA = join(tmpdir(), 'gestordevendas-books');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MANIFESTO = 'manifesto.json';

const nomeImagem = (pagina: number) => `${String(pagina).padStart(3, '0')}.jpg`;

@Injectable()
export class DiskBookTemporarioStorage implements IBookTemporarioStorage {
  private readonly logger = new Logger(DiskBookTemporarioStorage.name);
  // Propriedade (e nao so a constante) para os testes usarem uma pasta propria.
  protected pasta = PASTA;

  // Caminho base "<pasta>/<tenant>__<id>" (sem extensao), ou null se algum
  // identificador nao for UUID (evita path traversal).
  private base(tenantId: string, id: string): string | null {
    if (!UUID.test(tenantId) || !UUID.test(id)) return null;
    return join(this.pasta, `${tenantId}__${id}`);
  }

  async salvar(tenantId: string, book: BookTemporario): Promise<string> {
    await mkdir(this.pasta, { recursive: true, mode: 0o700 });
    await this.limparVencidos();
    const id = randomUUID();
    const base = this.base(tenantId, id);
    if (!base) throw new Error('Identificador de empresa inválido.');

    if (book.origem === 'pdf') {
      await writeFile(`${base}.pdf`, book.pdf, { mode: 0o600 });
      return id;
    }

    if (book.imagens.length < 1 || book.imagens.length > BOOK_MAX_IMAGENS) {
      throw new Error('Quantidade de imagens inválida.');
    }
    await mkdir(base, { mode: 0o700 });
    try {
      for (let i = 0; i < book.imagens.length; i++) {
        await writeFile(join(base, nomeImagem(i + 1)), book.imagens[i], { mode: 0o600 });
      }
      const manifesto = { origem: 'imagens', paginas: book.imagens.length };
      await writeFile(join(base, MANIFESTO), JSON.stringify(manifesto), { mode: 0o600 });
    } catch (err) {
      await rm(base, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
    return id;
  }

  async ler(tenantId: string, id: string): Promise<BookTemporario | null> {
    void this.limparVencidos();
    const base = this.base(tenantId, id);
    if (!base) return null;

    const pdf = await this.lerSeValido(`${base}.pdf`);
    if (pdf) return { origem: 'pdf', pdf };

    const manifestoBruto = await this.lerSeValido(join(base, MANIFESTO));
    if (!manifestoBruto) return null;
    try {
      const manifesto = JSON.parse(manifestoBruto.toString('utf8')) as { origem?: unknown; paginas?: unknown };
      const paginas = Number(manifesto.paginas);
      if (manifesto.origem !== 'imagens' || !Number.isInteger(paginas)) return null;
      if (paginas < 1 || paginas > BOOK_MAX_IMAGENS) return null;
      const imagens: Buffer[] = [];
      for (let p = 1; p <= paginas; p++) imagens.push(await readFile(join(base, nomeImagem(p))));
      return { origem: 'imagens', imagens };
    } catch {
      return null;
    }
  }

  async remover(tenantId: string, id: string): Promise<void> {
    const base = this.base(tenantId, id);
    if (!base) return;
    await unlink(`${base}.pdf`).catch(() => undefined);
    await rm(base, { recursive: true, force: true }).catch(() => undefined);
  }

  // Le o arquivo so se existir e ainda estiver dentro da validade.
  private async lerSeValido(caminho: string): Promise<Buffer | null> {
    try {
      const info = await stat(caminho);
      if (!info.isFile() || Date.now() - info.mtimeMs > BOOK_VALIDADE_MS) return null;
      return await readFile(caminho);
    } catch {
      return null;
    }
  }

  private async limparVencidos(): Promise<void> {
    try {
      const agora = Date.now();
      for (const nome of await readdir(this.pasta)) {
        const caminho = join(this.pasta, nome);
        const info = await stat(caminho).catch(() => null);
        if (info && agora - info.mtimeMs > BOOK_VALIDADE_MS) {
          await rm(caminho, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    } catch (err) {
      this.logger.warn(`Limpeza de books temporários falhou: ${err instanceof Error ? err.message : err}`);
    }
  }
}
