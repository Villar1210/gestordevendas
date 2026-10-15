// Limite de requisicoes simultaneas por processo (M1): 503 acima do limite,
// vaga devolvida quando a resposta termina, inclusive em erro.
import { Controller, Get, INestApplication, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FileInterceptor } from '@nestjs/platform-express';
import { LimiteConcorrencia, LimiteConcorrenciaGuard, limitePorNome } from './limite-concorrencia';

jest.setTimeout(30_000);

let liberarLentas: () => void = () => undefined;
let travaLentas = new Promise<void>((r) => (liberarLentas = r));
const multerChamado = jest.fn();

@Controller('t')
class ControllerDeTeste {
  @Get('lenta')
  @UseGuards(LimiteConcorrenciaGuard('teste-lenta', 2))
  async lenta() {
    await travaLentas;
    return { ok: true };
  }

  @Get('erro')
  @UseGuards(LimiteConcorrenciaGuard('teste-erro', 1))
  erro() {
    throw new Error('falhou');
  }

  // Interceptor de upload: so roda se o guard deixar.
  @Post('upload')
  @UseGuards(LimiteConcorrenciaGuard('teste-lenta', 2))
  @UseInterceptors(FileInterceptor('file'))
  upload() {
    multerChamado();
    return { ok: true };
  }
}

describe('LimiteConcorrencia', () => {
  it('contador: ocupa ate o maximo e libera uma vez so', () => {
    const l = new LimiteConcorrencia(2);
    const a = l.tentarOcupar()!;
    const b = l.tentarOcupar()!;
    expect(l.tentarOcupar()).toBeNull();
    a();
    a(); // idempotente
    expect(l.ativos).toBe(1);
    expect(l.tentarOcupar()).not.toBeNull();
    b();
  });

  describe('guard (HTTP real)', () => {
    let app: INestApplication;
    let base: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ controllers: [ControllerDeTeste] }).compile();
      app = moduleRef.createNestApplication({ logger: false });
      await app.listen(0, '127.0.0.1');
      base = `${await app.getUrl()}/t`;
    });

    afterAll(async () => {
      liberarLentas();
      await app?.close();
    });

    it('3a simultanea: 503 "Servidor ocupado"; ao terminar, a vaga volta', async () => {
      const a = fetch(`${base}/lenta`);
      const b = fetch(`${base}/lenta`);
      await new Promise((r) => setTimeout(r, 200));
      const c = await fetch(`${base}/lenta`);
      expect(c.status).toBe(503);
      expect((await c.json()).message).toBe('Servidor ocupado. Tente em instantes.');

      // Upload acima do limite: recusado ANTES do multer ler o corpo.
      const fd = new FormData();
      fd.append('file', new Blob([Buffer.alloc(1024)]), 'x.pdf');
      const up = await fetch(`${base}/upload`, { method: 'POST', body: fd });
      expect(up.status).toBe(503);
      expect(multerChamado).not.toHaveBeenCalled();

      liberarLentas();
      expect((await a).status).toBe(200);
      expect((await b).status).toBe(200);
      await new Promise((r) => setTimeout(r, 50));
      expect(limitePorNome('teste-lenta', 2).ativos).toBe(0);
      travaLentas = Promise.resolve();
      expect((await fetch(`${base}/lenta`)).status).toBe(200);
    });

    it('handler com erro tambem devolve a vaga', async () => {
      expect((await fetch(`${base}/erro`)).status).toBe(500);
      expect((await fetch(`${base}/erro`)).status).toBe(500); // nao virou 503
      await new Promise((r) => setTimeout(r, 50));
      expect(limitePorNome('teste-erro', 1).ativos).toBe(0);
    });
  });
});
