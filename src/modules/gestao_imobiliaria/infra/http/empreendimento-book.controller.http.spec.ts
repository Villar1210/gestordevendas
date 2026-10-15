// Teste HTTP da rota POST /empreendimentos/book/analisar (multer real):
// campos "file" x "files", limite de arquivos e Content-Length. Use cases
// mockados, sem banco e sem IA.
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request } from 'http';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmpreendimentoController } from './empreendimento.controller';
import { AnalisarBookEmpreendimentoUseCase } from '../../application/use-cases/analisar-book-empreendimento.use-case';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';

jest.setTimeout(60_000);

const TENANT = '11111111-1111-4111-8111-111111111111';

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = { id: 'user-1', tenantId: TENANT, role: 'Administrador' };
    return true;
  }
}

function form(arquivos: { campo: string; nome: string; dados?: string }[]): FormData {
  const fd = new FormData();
  for (const a of arquivos) fd.append(a.campo, new Blob([a.dados ?? 'x'], { type: 'image/jpeg' }), a.nome);
  return fd;
}

describe('EmpreendimentoController - POST book/analisar (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const analisar = { execute: jest.fn(async (input: { arquivos: { originalname: string }[] }) => ({ nomes: input.arquivos.map((a) => a.originalname) })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
      controllers: [EmpreendimentoController],
    })
      .useMocker((token) => (token === AnalisarBookEmpreendimentoUseCase ? analisar : {}))
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/empreendimentos/book/analisar`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('campo "file" (contrato antigo) continua funcionando', async () => {
    const res = await fetch(url, { method: 'POST', body: form([{ campo: 'file', nome: 'book.pdf' }]) });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ nomes: ['book.pdf'] });
  });

  it('campo "files" repassa as paginas na ordem de envio', async () => {
    const res = await fetch(url, {
      method: 'POST',
      body: form([
        { campo: 'files', nome: 'c.jpg' },
        { campo: 'files', nome: 'a.jpg' },
        { campo: 'files', nome: 'b.jpg' },
      ]),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ nomes: ['c.jpg', 'a.jpg', 'b.jpg'] });
  });

  it('"file" e "files" juntos: 400', async () => {
    analisar.execute.mockClear();
    const res = await fetch(url, {
      method: 'POST',
      body: form([
        { campo: 'file', nome: 'a.pdf' },
        { campo: 'files', nome: 'b.jpg' },
      ]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('não nos dois');
    expect(analisar.execute).not.toHaveBeenCalled();
  });

  it('mais de 80 arquivos: 400 do multer ("Too many files")', async () => {
    const res = await fetch(url, {
      method: 'POST',
      body: form(Array.from({ length: 81 }, (_, i) => ({ campo: 'files', nome: `${i}.jpg` }))),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/too many files/i);
  });

  it('Content-Length acima de 80 MB: 413 antes de ler o corpo', async () => {
    // http cru: o fetch nao deixa declarar um Content-Length maior que o corpo.
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(200 * 1024 * 1024) },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
          req.destroy();
        },
      );
      req.on('error', reject);
      req.write('--x\r\n');
    });
    expect(status).toBe(413);
  });
});
