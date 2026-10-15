import { mkdtemp, readdir, rm, stat, utimes } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DiskBookTemporarioStorage } from './disk-book-temporario.storage';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

// Mesma classe, so apontando para uma pasta temporaria propria do teste.
class StorageDeTeste extends DiskBookTemporarioStorage {
  constructor(pasta: string) {
    super();
    this.pasta = pasta;
  }
}

describe('DiskBookTemporarioStorage', () => {
  let pasta: string;
  let storage: StorageDeTeste;

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'book-storage-teste-'));
    storage = new StorageDeTeste(pasta);
  });

  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it('PDF: salva, le e remove (formato e tipo recuperaveis)', async () => {
    const id = await storage.salvar(TENANT_A, { origem: 'pdf', pdf: Buffer.from('%PDF-1.7 x') });
    expect(await storage.ler(TENANT_A, id)).toEqual({ origem: 'pdf', pdf: Buffer.from('%PDF-1.7 x') });
    const info = await stat(join(pasta, `${TENANT_A}__${id}.pdf`));
    expect(info.mode & 0o777).toBe(0o600);
    await storage.remover(TENANT_A, id);
    expect(await storage.ler(TENANT_A, id)).toBeNull();
  });

  it('imagens: guarda 001.jpg, 002.jpg... + manifesto e le na mesma ordem', async () => {
    const imagens = [Buffer.from('a'), Buffer.from('b'), Buffer.from('c')];
    const id = await storage.salvar(TENANT_A, { origem: 'imagens', imagens });
    const dir = join(pasta, `${TENANT_A}__${id}`);
    expect((await readdir(dir)).sort()).toEqual(['001.jpg', '002.jpg', '003.jpg', 'manifesto.json']);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(dir, '002.jpg'))).mode & 0o777).toBe(0o600);
    expect(await storage.ler(TENANT_A, id)).toEqual({ origem: 'imagens', imagens });
    await storage.remover(TENANT_A, id);
    expect(await readdir(pasta)).toEqual([]);
  });

  it('tenant A nao le (nem remove) o book do tenant B', async () => {
    const id = await storage.salvar(TENANT_B, { origem: 'imagens', imagens: [Buffer.from('b')] });
    const idPdf = await storage.salvar(TENANT_B, { origem: 'pdf', pdf: Buffer.from('%PDF-') });
    expect(await storage.ler(TENANT_A, id)).toBeNull();
    expect(await storage.ler(TENANT_A, idPdf)).toBeNull();
    await storage.remover(TENANT_A, id);
    expect(await storage.ler(TENANT_B, id)).not.toBeNull();
  });

  it('id que nao e UUID (path traversal) e ignorado', async () => {
    expect(await storage.ler(TENANT_A, '../../etc/passwd')).toBeNull();
    expect(await storage.ler('../x', '11111111-1111-4111-8111-111111111111')).toBeNull();
  });

  it('pasta sem manifesto (gravacao interrompida) e book vencido (mais de 2h) sao tratados como inexistentes', async () => {
    const id = await storage.salvar(TENANT_A, { origem: 'imagens', imagens: [Buffer.from('a')] });
    await rm(join(pasta, `${TENANT_A}__${id}`, 'manifesto.json'));
    expect(await storage.ler(TENANT_A, id)).toBeNull();

    const vencido = await storage.salvar(TENANT_A, { origem: 'imagens', imagens: [Buffer.from('a')] });
    const dir = join(pasta, `${TENANT_A}__${vencido}`);
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await utimes(join(dir, 'manifesto.json'), tresHorasAtras, tresHorasAtras);
    expect(await storage.ler(TENANT_A, vencido)).toBeNull();

    // A limpeza (roda ao salvar) apaga a pasta inteira do book vencido.
    await utimes(dir, tresHorasAtras, tresHorasAtras);
    await storage.salvar(TENANT_A, { origem: 'pdf', pdf: Buffer.from('%PDF-') });
    expect((await readdir(pasta)).some((n) => n.includes(vencido))).toBe(false);
  });

  it('quantidade de imagens invalida e recusada', async () => {
    await expect(storage.salvar(TENANT_A, { origem: 'imagens', imagens: [] })).rejects.toThrow();
  });
});
