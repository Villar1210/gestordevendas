// src/shared/infra/services/local-file-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import {
  IFileStorageService,
  UploadFileInput,
  UploadFileOutput,
} from '../../domain/services/file-storage.interface';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'imoveis');
const URL_PREFIXO = '/uploads/imoveis/';

// delete() SO apaga arquivos do book do empreendimento. No disco o nome e
// "<uuid do upload>-<originalname>", e o fluxo do book gera exatamente
// "book-<uuid>.pdf" e "book-<uuid>-p001.jpg". Qualquer outro nome (fotos do
// empreendimento "book-pagina-N.jpg", fotos de imovel, PDFs do E-doc...) e
// recusado, mesmo que algum dia outro fluxo chame delete().
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NOME_ARQUIVO_BOOK = new RegExp(`^${UUID}-book-${UUID}(?:\\.pdf|-p\\d{3}\\.jpg)$`);

@Injectable()
export class LocalFileStorageService implements IFileStorageService {
  private readonly logger = new Logger(LocalFileStorageService.name);
  // Propriedade (e nao so a constante) para os testes usarem uma pasta propria.
  protected pasta = UPLOAD_DIR;

  async upload(file: UploadFileInput): Promise<UploadFileOutput> {
    await mkdir(this.pasta, { recursive: true });

    const filename = `${randomUUID()}-${file.originalname}`;
    await writeFile(join(this.pasta, filename), file.buffer);

    return { url: `${URL_PREFIXO}${filename}` };
  }

  async download(url: string): Promise<Buffer> {
    // A url sempre comeca com "/" (ex: "/uploads/imoveis/xxx.pdf") - remove
    // antes de juntar com process.cwd() para nao virar caminho absoluto de raiz.
    return readFile(join(process.cwd(), url.replace(/^\//, '')));
  }

  // Apaga um arquivo do BOOK do empreendimento a partir da url gravada no
  // banco. Nunca lanca erro por recusa ou arquivo inexistente: recusa vira
  // aviso no log e nada e apagado. Regras (todas obrigatorias):
  // - url "/uploads/imoveis/<nome>", sem "..", sem barra invertida, sem NUL,
  //   sem subpasta;
  // - <nome> no formato exato dos arquivos do book (NOME_ARQUIVO_BOOK);
  // - caminho resolvido (path.resolve sobre o realpath da pasta de uploads)
  //   fica DENTRO dela;
  // - o arquivo nao pode ser link simbolico (nem para dentro, nem para fora).
  async delete(url: string): Promise<void> {
    const recusar = (motivo: string) => this.logger.warn(`Arquivo não removido (${motivo}).`);

    if (typeof url !== 'string' || !url.startsWith(URL_PREFIXO)) return recusar('fora da pasta de uploads');
    if (url.includes('\\') || url.includes('\0') || url.includes('..')) return recusar('caminho inválido');
    const nome = url.slice(URL_PREFIXO.length);
    if (!nome || nome.includes('/')) return recusar('caminho inválido');
    if (!NOME_ARQUIVO_BOOK.test(nome)) return recusar('não é arquivo do book');

    let raiz: string;
    try {
      raiz = await realpath(this.pasta);
    } catch {
      return; // pasta de uploads nao existe: nada para apagar
    }
    const caminho = resolve(raiz, nome);
    const rel = relative(raiz, caminho);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || dirname(caminho) !== raiz) {
      return recusar('fora da pasta de uploads');
    }

    try {
      const info = await lstat(caminho);
      if (info.isSymbolicLink()) return recusar('link simbólico');
      if (!info.isFile()) return recusar('não é arquivo');
      await unlink(caminho);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return; // ja nao existe
      throw err;
    }
  }
}
