// Teste HTTP das rotas de leitura do book completo (Fatia 2):
// GET /empreendimentos/:id/book e GET /empreendimentos/:id/book/zip.
// Use cases REAIS com repositorios em memoria (sem banco); guards reais de
// rota (ParseUUIDPipe, throttle) e autenticacao falsa por header.
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmpreendimentoController } from './empreendimento.controller';
import {
  BaixarZipBookEmpreendimentoUseCase,
  BuscarBookEmpreendimentoUseCase,
} from '../../application/use-cases/book-empreendimento-leitura.use-case';
import { StoreZipBookService } from '../services/store-zip-book.service';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { EmpreendimentoBookRecord } from '../../domain/repositories/empreendimento-book-repository.interface';

jest.setTimeout(60_000);

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const EMP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Tenant escolhido pelo header "x-tenant" (so no teste).
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-1', tenantId: req.headers['x-tenant'] ?? TENANT_A, role: 'Corretor' };
    return true;
  }
}

const book: EmpreendimentoBookRecord = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  tenantId: TENANT_A,
  empreendimentoId: EMP,
  origem: 'pdf',
  pdfUrl: '/uploads/imoveis/x-book.pdf',
  pdfNomeOriginal: 'Book.pdf',
  totalPaginas: 3,
  createdAt: new Date('2026-10-15T12:00:00Z'),
  paginas: [
    { numero: 1, categoria: 'fachada', url: '/uploads/imoveis/p1.jpg', largura: 1600, altura: 1000 },
    { numero: 2, categoria: 'descartar', url: '/uploads/imoveis/p2.jpg', largura: 1600, altura: 1000 },
    { numero: 3, categoria: 'planta', url: '/uploads/imoveis/p3.jpg', largura: 1600, altura: 1000 },
  ],
};

describe('EmpreendimentoController - book completo (HTTP)', () => {
  let app: INestApplication;
  let base: string;
  const fileStorage = { download: jest.fn(async (url: string) => Buffer.from(`conteudo:${url}`)) };
  const bookRepo = {
    buscarPorEmpreendimento: jest.fn(async (t: string, id: string) => (t === TENANT_A && id === EMP ? book : null)),
  };
  const empRepo = {
    findByIdAndTenant: jest.fn(async (id: string, t: string) =>
      t === TENANT_A && id === EMP ? { id, tenantId: t, name: 'Vila Bela' } : null,
    ),
  };

  beforeAll(async () => {
    const buscar = new BuscarBookEmpreendimentoUseCase(bookRepo as never);
    const zip = new BaixarZipBookEmpreendimentoUseCase(
      empRepo as never,
      bookRepo as never,
      fileStorage as never,
      new StoreZipBookService(),
    );
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
      controllers: [EmpreendimentoController],
    })
      .useMocker((token) => {
        if (token === BuscarBookEmpreendimentoUseCase) return buscar;
        if (token === BaixarZipBookEmpreendimentoUseCase) return zip;
        return {};
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/empreendimentos`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET book: 200 com paginas ordenadas', async () => {
    const res = await fetch(`${base}/${EMP}/book`);
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo).toMatchObject({ origem: 'pdf', pdfUrl: book.pdfUrl, pdfNomeOriginal: 'Book.pdf', totalPaginas: 3 });
    expect(corpo.paginas.map((p: { numero: number }) => p.numero)).toEqual([1, 2, 3]);
  });

  it('GET book de outra empresa: 404 (nao vaza existencia)', async () => {
    const res = await fetch(`${base}/${EMP}/book`, { headers: { 'x-tenant': TENANT_B } });
    expect(res.status).toBe(404);
  });

  it('GET book com id que nao e UUID: 400', async () => {
    expect((await fetch(`${base}/..%2F..%2Fetc/book`)).status).toBe(400);
  });

  it('GET zip padrao: application/zip sem as paginas "descartar"', async () => {
    fileStorage.download.mockClear();
    const res = await fetch(`${base}/${EMP}/book/zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('filename="Vila_Bela_book.zip"');
    const zip = Buffer.from(await res.arrayBuffer());
    expect(zip.includes(Buffer.from('Vila_Bela_pagina_01.jpg'))).toBe(true);
    expect(zip.includes(Buffer.from('Vila_Bela_pagina_03.jpg'))).toBe(true);
    expect(zip.includes(Buffer.from('Vila_Bela_pagina_02.jpg'))).toBe(false);
    expect(fileStorage.download.mock.calls.map((c) => c[0])).toEqual(['/uploads/imoveis/p1.jpg', '/uploads/imoveis/p3.jpg']);
  });

  it('GET zip com parametro invalido: 400 (sem ler arquivo nenhum)', async () => {
    fileStorage.download.mockClear();
    for (const q of ['paginas=0', 'paginas=81', 'paginas=1,1', 'paginas=abc', 'paginas=1&paginas=2', 'paginas=..%2F1']) {
      const res = await fetch(`${base}/${EMP}/book/zip?${q}`);
      expect({ q, status: res.status }).toEqual({ q, status: 400 });
    }
    expect(fileStorage.download).not.toHaveBeenCalled();
  });

  it('GET zip com paginas=2: so a pagina pedida (mesmo "descartar")', async () => {
    const res = await fetch(`${base}/${EMP}/book/zip?paginas=2`);
    expect(res.status).toBe(200);
    const zip = Buffer.from(await res.arrayBuffer());
    expect(zip.includes(Buffer.from('Vila_Bela_pagina_02.jpg'))).toBe(true);
    expect(zip.includes(Buffer.from('Vila_Bela_pagina_01.jpg'))).toBe(false);
  });

  it('GET zip de outra empresa: 404', async () => {
    const res = await fetch(`${base}/${EMP}/book/zip`, { headers: { 'x-tenant': TENANT_B } });
    expect(res.status).toBe(404);
  });
});
