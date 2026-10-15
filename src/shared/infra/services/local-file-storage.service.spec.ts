// LocalFileStorageService.delete: so apaga arquivos do book do empreendimento
// dentro da pasta de uploads (pasta temporaria propria por teste - nunca a
// pasta real uploads/).
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalFileStorageService } from './local-file-storage.service';

class StorageTeste extends LocalFileStorageService {
  constructor(pasta: string) {
    super();
    this.pasta = pasta;
  }
}

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const URL = '/uploads/imoveis/';

describe('LocalFileStorageService.delete', () => {
  let raiz: string;
  let pasta: string;
  let storage: StorageTeste;
  const existe = async (nome: string) => (await readdir(pasta)).includes(nome);

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'gdv-storage-'));
    pasta = join(raiz, 'uploads', 'imoveis');
    await mkdir(pasta, { recursive: true });
    storage = new StorageTeste(pasta);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('apaga book-...jpg e book-...pdf gerados pelo upload (dentro de uploads)', async () => {
    const pagina = await storage.upload({ buffer: Buffer.from('jpg'), originalname: `book-${U2}-p001.jpg`, mimetype: 'image/jpeg' });
    const pdf = await storage.upload({ buffer: Buffer.from('%PDF'), originalname: `book-${U2}.pdf`, mimetype: 'application/pdf' });
    expect(await readdir(pasta)).toHaveLength(2);
    await storage.delete(pagina.url);
    await storage.delete(pdf.url);
    expect(await readdir(pasta)).toEqual([]);
  });

  it('arquivo inexistente: ignora sem erro', async () => {
    await expect(storage.delete(`${URL}${U1}-book-${U2}-p001.jpg`)).resolves.toBeUndefined();
  });

  it('recusa nome sem o prefixo do book (fotos, E-doc, imoveis) - nao apaga', async () => {
    const nomes = [
      `${U1}-book-pagina-1.jpg`, // foto do empreendimento criada pelo book
      `${U1}-foto.jpg`,
      `${U1}-contrato.pdf`,
      `${U1}-book-${U2}.exe`,
      `book-${U2}-p001.jpg`, // sem o uuid do upload na frente
    ];
    for (const nome of nomes) await writeFile(join(pasta, nome), 'x');
    for (const nome of nomes) await storage.delete(`${URL}${nome}`);
    expect((await readdir(pasta)).sort()).toEqual([...nomes].sort());
  });

  it('recusa ../, barra invertida, subpasta, caminho absoluto e url fora de /uploads/imoveis', async () => {
    const alvoFora = join(raiz, `${U1}-book-${U2}-p001.jpg`);
    await writeFile(alvoFora, 'fora');
    await mkdir(join(pasta, 'sub'));
    await writeFile(join(pasta, 'sub', `${U1}-book-${U2}-p001.jpg`), 'sub');
    const ruins = [
      `${URL}../${U1}-book-${U2}-p001.jpg`,
      `${URL}..%2F${U1}-book-${U2}-p001.jpg`,
      `${URL}sub/${U1}-book-${U2}-p001.jpg`,
      `${URL}..\\${U1}-book-${U2}-p001.jpg`,
      alvoFora, // caminho absoluto fora da pasta
      `/uploads/outra/${U1}-book-${U2}-p001.jpg`,
      `${URL}${U1}-book-${U2}-p001.jpg\0`,
      '',
    ];
    for (const url of ruins) await expect(storage.delete(url)).resolves.toBeUndefined();
    expect(await readdir(raiz)).toContain(`${U1}-book-${U2}-p001.jpg`);
    expect(await readdir(join(pasta, 'sub'))).toEqual([`${U1}-book-${U2}-p001.jpg`]);
  });

  it('link simbolico com nome de book apontando para fora: nao apaga o alvo nem o link', async () => {
    const alvoFora = join(raiz, 'segredo.txt');
    await writeFile(alvoFora, 'segredo');
    const nome = `${U1}-book-${U2}-p002.jpg`;
    await symlink(alvoFora, join(pasta, nome));
    await storage.delete(`${URL}${nome}`);
    expect(await existe(nome)).toBe(true);
    expect(await readdir(raiz)).toContain('segredo.txt');
  });

  it('pasta de uploads que e link simbolico: resolve pelo realpath e apaga so dentro dela', async () => {
    const real = join(raiz, 'real');
    await mkdir(real);
    const link = join(raiz, 'link-uploads');
    await symlink(real, link);
    const viaLink = new StorageTeste(link);
    const { url } = await viaLink.upload({ buffer: Buffer.from('x'), originalname: `book-${U2}-p003.jpg`, mimetype: 'image/jpeg' });
    await viaLink.delete(url);
    expect(await readdir(real)).toEqual([]);
  });
});
