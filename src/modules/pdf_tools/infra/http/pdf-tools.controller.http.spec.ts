// Teste HTTP do controller (multer real, filtro de erros, headers de
// download) - sem banco: sobe so o PdfToolsModule com os guards de
// autenticacao trocados por um que injeta um usuario fixo. Usa fetch/
// FormData nativos do Node (sem supertest).
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PDFDocument } from 'pdf-lib';
import { PdfToolsModule } from '../../pdf-tools.module';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';

jest.setTimeout(60_000);

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-1', tenantId: 'tenant-1', role: 'Administrador', cargo: null, standId: null, impersonadoPor: null };
    return true;
  }
}

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

function form(files: { field: string; data: Uint8Array; name: string; type?: string }[], options?: unknown): FormData {
  const fd = new FormData();
  for (const f of files) fd.append(f.field, new Blob([new Uint8Array(f.data) as unknown as ArrayBuffer], { type: f.type ?? 'application/pdf' }), f.name);
  if (options !== undefined) fd.append('options', typeof options === 'string' ? options : JSON.stringify(options));
  return fd;
}

describe('PdfToolsController (HTTP)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }]), PdfToolsModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/pdf-tools`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /merge (campo "files") devolve PDF com Content-Disposition e X-Pdf-Tools-Meta', async () => {
    const res = await fetch(`${base}/merge`, {
      method: 'POST',
      body: form([
        { field: 'files', data: await makePdf(2), name: 'a.pdf' },
        { field: 'files', data: await makePdf(1), name: 'b.pdf' },
      ]),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="documento_unido.pdf"; filename*=UTF-8''documento_unido.pdf`,
    );
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Pdf-Tools-Meta');
    const meta = JSON.parse(res.headers.get('x-pdf-tools-meta')!);
    expect(meta).toMatchObject({ files: 2, pages: 3 });
    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    expect(doc.getPageCount()).toBe(3);
  });

  it('nome acentuado: filename ASCII + filename* UTF-8 (nome sanitizado)', async () => {
    const res = await fetch(`${base}/rotate`, {
      method: 'POST',
      body: form([{ field: 'file', data: await makePdf(1), name: 'Contrato São João.pdf' }], { angle: 90 }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('filename="Contrato Sao Joao_girado.pdf"');
  });

  it('erro JSON padronizado: 400 INVALID_INPUT (options invalido / nao-PDF / campo errado)', async () => {
    let res = await fetch(`${base}/split`, {
      method: 'POST',
      body: form([{ field: 'file', data: await makePdf(2), name: 'x.pdf' }], '{quebrado'),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ statusCode: 400, code: 'INVALID_INPUT', message: expect.stringContaining('JSON') });

    res = await fetch(`${base}/compress`, {
      method: 'POST',
      body: form([{ field: 'file', data: new TextEncoder().encode('nao sou pdf'), name: 'x.pdf' }], {}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/não é um PDF válido/);

    res = await fetch(`${base}/rotate`, {
      method: 'POST',
      body: form([{ field: 'files', data: await makePdf(1), name: 'x.pdf' }], { angle: 90 }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_INPUT');
  });

  it('merge com mais de 20 arquivos -> 400 com mensagem em portugues', async () => {
    const pdf = await makePdf(1);
    const res = await fetch(`${base}/merge`, {
      method: 'POST',
      body: form(Array.from({ length: 21 }, (_, i) => ({ field: 'files', data: pdf, name: `${i}.pdf` }))),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'INVALID_INPUT', message: 'Arquivos demais nesta requisição.' });
  });

  it('POST /create (JSON) devolve documento.pdf', async () => {
    const res = await fetch(`${base}/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Teste', content: '# Olá\nTexto com ção', pageSize: 'A4', fontSize: 12 }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('documento.pdf');
    expect(JSON.parse(res.headers.get('x-pdf-tools-meta')!).pages).toBe(1);
  });

  it('POST /create (multipart "options") aceita 50.000 caracteres multibyte (> 100 KB)', async () => {
    const content = '• Item ✓ “ok” — ★★★★★★★★★★★★★★★\n'.repeat(1500); // 48.000 chars, ~110 KB em UTF-8
    const fd = new FormData();
    fd.append('options', JSON.stringify({ content, pageSize: 'A4', fontSize: 12 }));
    const res = await fetch(`${base}/create`, { method: 'POST', body: fd });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(JSON.parse(res.headers.get('x-pdf-tools-meta')!).pages).toBeGreaterThan(1);
  });

  it('protect -> PDF protegido em outra ferramenta = 422 ENCRYPTED_PDF; unlock com senha errada = 422 WRONG_PASSWORD', async () => {
    const caps = await (await fetch(`${base}/capabilities`)).json();
    if (!caps.security) return; // sem qpdf nesta maquina
    const protectedRes = await fetch(`${base}/protect`, {
      method: 'POST',
      body: form([{ field: 'file', data: await makePdf(1), name: 'c.pdf' }], { password: 'abcd1234' }),
    });
    expect(protectedRes.status).toBe(200);
    expect(protectedRes.headers.get('content-disposition')).toContain('c_protegido.pdf');
    const enc = new Uint8Array(await protectedRes.arrayBuffer());

    let res = await fetch(`${base}/rotate`, { method: 'POST', body: form([{ field: 'file', data: enc, name: 'c.pdf' }], { angle: 90 }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      statusCode: 422,
      code: 'ENCRYPTED_PDF',
      message: 'Este PDF está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.',
    });

    res = await fetch(`${base}/unlock`, { method: 'POST', body: form([{ field: 'file', data: enc, name: 'c.pdf' }], { password: 'errada' }) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('WRONG_PASSWORD');

    res = await fetch(`${base}/unlock`, { method: 'POST', body: form([{ field: 'file', data: enc, name: 'c.pdf' }], { password: 'abcd1234' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('c_desbloqueado.pdf');
  });

  it('GET /capabilities devolve o mapa booleano', async () => {
    const res = await fetch(`${base}/capabilities`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['compress', 'office', 'raster', 'security']);
  });
});
