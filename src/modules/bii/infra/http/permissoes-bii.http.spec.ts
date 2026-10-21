// META-TESTE de permissoes do BII (molde: gestao_imobiliaria/infra/http/
// permissoes-imoveis.http.spec.ts). Os controllers sao descobertos pelo proprio
// BiiModule (controller novo registrado no modulo entra no teste sozinho).
// Regra: controller com prefixo 'bii-plataforma' -> so SUPER_USUARIO_ROLE_NAME;
// qualquer outro -> so 'Administrador'. Sempre JwtAuthGuard + RolesGuard na
// classe; por rota, so os guards de limite conhecidos (aditivos).
// Inclui teste HTTP com o RolesGuard REAL (so o JwtAuthGuard e trocado por um
// fake) e o ValidationPipe igual ao do main.ts.
import { readdirSync } from 'fs';
import { request as httpRequest } from 'http';
import { CanActivate, ExecutionContext, INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { BiiModule } from '../../bii.module';
import { BiiPainelController, BiiPainelLimiteGuard } from './bii-painel.controller';
import { BiiAnaliseController, BiiAnaliseLimiteGuard } from './bii-analise.controller';
import { BiiPlataformaController } from './bii-plataforma.controller';
import { BiiItbiImportarLimiteGuard, ItbiUploadTamanhoGuard, PASTA_TEMP_ITBI } from './itbi-upload';
import { BiiAnaliseThrottlerGuard } from './bii-analise-throttler.guard';
import { BiiConcorrenteThrottlerGuard } from './bii-concorrente-throttler.guard';
import { BiiConcorrenteController } from './bii-concorrente.controller';
import {
  CreateConcorrenteUseCase,
  DeleteConcorrenteUseCase,
  GetConcorrenteUseCase,
  ListConcorrentesUseCase,
  UpdateConcorrenteUseCase,
} from '../../application/use-cases/concorrentes.use-cases';
import { ThrottlerModule } from '@nestjs/throttler';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { ROLES_KEY } from '../../../../shared/infra/http/decorators/roles.decorator';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';
import { GetPainelVendasUseCase } from '../../application/use-cases/get-painel-vendas.use-case';
import { AnalisarEnderecoUseCase } from '../../application/use-cases/analisar-endereco.use-case';
import { GetAnaliseUseCase, ListAnalisesUseCase } from '../../application/use-cases/analises-salvas.use-case';
import { GetItbiCoberturaUseCase } from '../../application/use-cases/itbi-cobertura.use-case';
import {
  GetGeocodificacaoItbiUseCase,
  ImportarItbiUseCase,
  IniciarGeocodificacaoItbiUseCase,
  ListImportacoesItbiUseCase,
} from '../../application/use-cases/itbi-plataforma.use-cases';
import { ImportadorItbiService } from '../../application/services/importador-itbi.service';
import { XlsxInspetor } from '../providers/xlsx-inspetor';

const GUARDS_METODO_PERMITIDOS: unknown[] = [
  BiiPainelLimiteGuard,
  BiiAnaliseLimiteGuard,
  BiiAnaliseThrottlerGuard,
  BiiConcorrenteThrottlerGuard,
  BiiItbiImportarLimiteGuard,
  ItbiUploadTamanhoGuard,
];

type Ctor = new (...args: never[]) => unknown;
const CONTROLLERS = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BiiModule) ?? []) as Ctor[];

function roleEsperada(controller: Ctor): string {
  const prefixo = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
  return prefixo.startsWith('bii-plataforma') ? SUPER_USUARIO_ROLE_NAME : 'Administrador';
}

function rotasDoController(controller: Ctor) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((nome) => nome !== 'constructor' && typeof proto[nome] === 'function')
    .filter((nome) => Reflect.getMetadata(PATH_METADATA, proto[nome] as object) !== undefined)
    .map((nome) => {
      const handler = proto[nome] as object;
      return {
        nome,
        metodo: RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number],
        path: Reflect.getMetadata(PATH_METADATA, handler) as string,
        // mesma resolucao do RolesGuard (getAllAndOverride: metodo antes da classe)
        roles:
          (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined) ??
          (Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined),
        guardsMetodo: (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[],
      };
    });
}

describe('Permissoes BII - META-TESTE (metadata)', () => {
  it('o modulo registra os controllers do painel, da analise e da plataforma', () => {
    expect(CONTROLLERS).toEqual(expect.arrayContaining([BiiPainelController, BiiAnaliseController, BiiPlataformaController, BiiConcorrenteController]));
    expect(roleEsperada(BiiConcorrenteController)).toBe('Administrador');
    expect(roleEsperada(BiiPlataformaController)).toBe(SUPER_USUARIO_ROLE_NAME);
    expect(roleEsperada(BiiAnaliseController)).toBe('Administrador');
  });

  for (const controller of CONTROLLERS) {
    const role = roleEsperada(controller);
    describe(controller.name, () => {
      it(`classe: @Roles('${role}') e @UseGuards(JwtAuthGuard, RolesGuard)`, () => {
        expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([role]);
        const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
        expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
        expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(guards.indexOf(RolesGuard));
      });

      const rotas = rotasDoController(controller);
      it('tem rotas', () => expect(rotas.length).toBeGreaterThan(0));

      it.each(rotas.map((r) => [`${r.metodo} ${r.path} (${r.nome})`, r] as const))(`%s e so ${role}`, (_r, rota) => {
        expect(rota.roles).toEqual([role]);
        expect(rota.guardsMetodo.filter((g: unknown) => !GUARDS_METODO_PERMITIDOS.includes(g))).toEqual([]);
      });
    });
  }
});

const PERFIS: Record<string, { id: string; role: string; cargo: string | null }> = {
  admin: { id: 'u-admin', role: 'Administrador', cargo: null },
  corretor: { id: 'u-corretor', role: 'Corretor', cargo: 'corretor' },
  gerente: { id: 'u-gerente', role: 'Corretor', cargo: 'gerente' },
  parceiro: { id: 'u-parceiro', role: 'Corretor Parceiro', cargo: null },
  cliente: { id: 'u-cliente', role: 'Cliente', cargo: null },
  super: { id: 'u-super', role: SUPER_USUARIO_ROLE_NAME, cargo: null },
};
// perfis extras de Administrador (usuarios diferentes) so para o throttle por usuario
const PERFIS_EXTRAS: Record<string, { id: string; role: string; cargo: string | null }> = {
  'gerente-admin': { id: 'u-admin-2', role: 'Administrador', cargo: null },
  'throttle-a': { id: 'u-throttle-a', role: 'Administrador', cargo: null },
  'throttle-b': { id: 'u-throttle-b', role: 'Administrador', cargo: null },
};

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const p = PERFIS[req.headers['x-perfil'] as string] ?? PERFIS_EXTRAS[req.headers['x-perfil'] as string];
    req.user = { ...p, tenantId: 'tenant-a', standId: null, impersonadoPor: req.headers['x-impersonado'] ?? null };
    return true;
  }
}

const ID = '11111111-1111-4111-8111-111111111111';
const CONCORRENTE_OK = {
  nome: 'Residencial Vista',
  endereco: 'Rua Ibitirama, 200, São Paulo',
  fase: 'lancamento',
  tipologias: [{ descricao: '2 dorm.', areaPrivativa: 42, precoDe: 289000 }],
};

describe('Permissoes BII - HTTP (RolesGuard real)', () => {
  let app: INestApplication;
  let base: string;
  const ok = (v: unknown = { ok: true }) => jest.fn(async () => v);
  const mocks = {
    painel: ok(),
    analisar: ok(),
    listar: ok([]),
    abrir: ok(),
    cobertura: ok(),
    importacoes: ok([]),
    geocodificar: ok({ id: 'g1' }),
    geocodificacao: jest.fn(() => ({ atual: null })),
    concListar: ok([]),
    concAbrir: ok(),
    concCriar: ok(),
    concAtualizar: ok(),
    concExcluir: jest.fn(async () => undefined),
  };
  const importador = { iniciar: jest.fn(async () => ({ importacaoId: 'imp-1' })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10_000 }])],
      controllers: CONTROLLERS,
      providers: [
        { provide: GetPainelVendasUseCase, useValue: { execute: mocks.painel } },
        { provide: AnalisarEnderecoUseCase, useValue: { execute: mocks.analisar } },
        { provide: ListAnalisesUseCase, useValue: { execute: mocks.listar } },
        { provide: GetAnaliseUseCase, useValue: { execute: mocks.abrir } },
        { provide: GetItbiCoberturaUseCase, useValue: { execute: mocks.cobertura } },
        { provide: ListImportacoesItbiUseCase, useValue: { execute: mocks.importacoes } },
        { provide: IniciarGeocodificacaoItbiUseCase, useValue: { execute: mocks.geocodificar } },
        { provide: GetGeocodificacaoItbiUseCase, useValue: { execute: mocks.geocodificacao } },
        { provide: ListConcorrentesUseCase, useValue: { execute: mocks.concListar } },
        { provide: GetConcorrenteUseCase, useValue: { execute: mocks.concAbrir } },
        { provide: CreateConcorrenteUseCase, useValue: { execute: mocks.concCriar } },
        { provide: UpdateConcorrenteUseCase, useValue: { execute: mocks.concAtualizar } },
        { provide: DeleteConcorrenteUseCase, useValue: { execute: mocks.concExcluir } },
        // upload: use case REAL + inspetor REAL; so o importador e fake
        { provide: ImportarItbiUseCase, useFactory: () => new ImportarItbiUseCase(importador as unknown as ImportadorItbiService, new XlsxInspetor()) },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  const json = (perfil: string, corpo: unknown, extra: Record<string, string> = {}) => ({
    method: 'POST',
    headers: { 'x-perfil': perfil, 'content-type': 'application/json', ...extra },
    body: JSON.stringify(corpo),
  });

  const ROTAS_TENANT: [string, string, RequestInit | ((p: string) => RequestInit)][] = [
    ['GET', '/bii/painel', {}],
    ['POST', '/bii/analises/endereco', (p) => json(p, { endereco: 'Rua Ibitirama, 100, São Paulo' })],
    ['GET', '/bii/analises', {}],
    ['GET', `/bii/analises/${ID}`, {}],
    ['GET', '/bii/itbi/cobertura', {}],
    ['GET', '/bii/concorrentes', {}],
    ['GET', `/bii/concorrentes/${ID}`, {}],
    ['POST', '/bii/concorrentes', (p) => json(p, CONCORRENTE_OK)],
    ['PATCH', `/bii/concorrentes/${ID}`, (p) => ({ ...json(p, CONCORRENTE_OK), method: 'PATCH' })],
    ['DELETE', `/bii/concorrentes/${ID}`, (p) => ({ method: 'DELETE', headers: { 'x-perfil': p } })],
  ];

  const STATUS_OK: Record<string, number> = { GET: 200, POST: 201, PATCH: 200, DELETE: 204 };

  describe.each(ROTAS_TENANT)('%s %s', (_m, rota, init) => {
    it.each(Object.keys(PERFIS))('como %s', async (perfil) => {
      const i = typeof init === 'function' ? init(perfil) : { ...init, headers: { 'x-perfil': perfil } };
      const res = await fetch(`${base}${rota}`, i);
      expect(res.status).toBe(perfil === 'admin' ? STATUS_OK[i.method ?? 'GET'] : 403);
    });
  });

  const ROTAS_PLATAFORMA: [string, string, (p: string) => RequestInit][] = [
    ['GET', '/bii-plataforma/itbi/importacoes', (p) => ({ headers: { 'x-perfil': p } })],
    ['POST', '/bii-plataforma/itbi/geocodificar', (p) => json(p, { ceps: ['03277'] })],
    ['GET', '/bii-plataforma/itbi/geocodificacao', (p) => ({ headers: { 'x-perfil': p } })],
  ];

  describe.each(ROTAS_PLATAFORMA)('%s %s', (_m, rota, init) => {
    it.each(Object.keys(PERFIS))('como %s', async (perfil) => {
      const res = await fetch(`${base}${rota}`, init(perfil));
      const esperado = init(perfil).method === 'POST' ? 202 : 200;
      expect(res.status).toBe(perfil === 'super' ? esperado : 403);
    });
    it('Administrador impersonado pelo Super Usuario continua sem acesso (e role de tenant)', async () => {
      const i = init('admin');
      const res = await fetch(`${base}${rota}`, { ...i, headers: { ...(i.headers as object), 'x-impersonado': 'su-1' } });
      expect(res.status).toBe(403);
    });
  });

  it('impersonadoPor chega ao use case (que responde 403 BII_SOMENTE_LEITURA); tenant/role de req.user', async () => {
    mocks.analisar.mockClear();
    const res = await fetch(`${base}/bii/analises/endereco`, json('gerente-admin', { endereco: 'Rua X, 10, São Paulo', raioMetros: 2000, meses: 36, tipo: 'casa', somenteCompraVenda: false }, { 'x-impersonado': 'su-1' }));
    expect(res.status).toBe(201);
    expect(mocks.analisar).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', requesterRole: 'Administrador', requesterUserId: 'u-admin-2', impersonadoPor: 'su-1', raioMetros: 2000, meses: 36, tipo: 'casa', somenteCompraVenda: false }),
    );
  });

  it.each([
    [new ForbiddenException({ statusCode: 403, code: 'BII_SOMENTE_LEITURA', message: 'somente leitura' }), 403, 'BII_SOMENTE_LEITURA'],
    [new HttpException({ statusCode: 429, code: 'BII_COTA_DIARIA', message: 'cota' }, 429), 429, 'BII_COTA_DIARIA'],
  ])('corpo do erro do use case chega intacto com code estavel (%#)', async (erro, status, code) => {
    mocks.analisar.mockRejectedValueOnce(erro);
    const res = await fetch(`${base}/bii/analises/endereco`, json('admin', { endereco: 'Rua X, 10, São Paulo' }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(expect.objectContaining({ statusCode: status, code }));
  });

  it('M2: throttle POR USUARIO na analise (10/min): 11a do mesmo usuario -> 429; outro usuario segue', async () => {
    const quem = 'throttle-a';
    let ultimo = 0;
    for (let i = 0; i < 11; i++) {
      ultimo = (await fetch(`${base}/bii/analises/endereco`, json(quem, { endereco: 'Rua X, 10, São Paulo' }))).status;
      if (i < 10) expect(ultimo).toBe(201);
    }
    expect(ultimo).toBe(429);
    expect((await fetch(`${base}/bii/analises/endereco`, json('throttle-b', { endereco: 'Rua X, 10, São Paulo' }))).status).toBe(201);
  });

  it.each([
    [{ endereco: 'Rua' }],
    [{ endereco: 'Rua X, 10', raioMetros: 300 }],
    [{ endereco: 'Rua X, 10', meses: 18 }],
    [{ endereco: 'Rua X, 10', tipo: 'loja' }],
    [{ endereco: 'Rua X,\n10' }],
    [{ endereco: 'Rua X, 10', tenantId: 'tenant-b' }],
  ])('POST /bii/analises/endereco com corpo invalido %p -> 400', async (corpo) => {
    const res = await fetch(`${base}/bii/analises/endereco`, json('admin', corpo));
    expect(res.status).toBe(400);
  });

  it('concorrente: impersonadoPor, tenant e usuario chegam ao use case de req.user', async () => {
    mocks.concCriar.mockClear();
    const res = await fetch(`${base}/bii/concorrentes`, json('gerente-admin', CONCORRENTE_OK, { 'x-impersonado': 'su-1' }));
    expect(res.status).toBe(201);
    expect(mocks.concCriar).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', requesterRole: 'Administrador', requesterUserId: 'u-admin-2', impersonadoPor: 'su-1' }),
    );
  });

  it.each([
    [{ ...CONCORRENTE_OK, tenantId: 'tenant-b' }],
    [{ ...CONCORRENTE_OK, fase: 'vendido' }],
    [{ ...CONCORRENTE_OK, nome: 'A' }],
    [{ ...CONCORRENTE_OK, nome: 'Nome\nquebrado' }],
    [{ ...CONCORRENTE_OK, tipologias: [] }],
    [{ ...CONCORRENTE_OK, tipologias: Array.from({ length: 11 }, () => CONCORRENTE_OK.tipologias[0]) }],
    [{ ...CONCORRENTE_OK, tipologias: [{ descricao: '2d', areaPrivativa: 5, precoDe: 289000 }] }],
    [{ ...CONCORRENTE_OK, tipologias: [{ descricao: '2d', areaPrivativa: 42, precoDe: 1000 }] }],
    [{ ...CONCORRENTE_OK, tipologias: [{ descricao: '2d', areaPrivativa: 42, precoDe: 289000, corretor: 'Fulano' }] }],
    [{ ...CONCORRENTE_OK, dataLancamento: '01/05/2026' }],
    [{ ...CONCORRENTE_OK, totalUnidades: 0 }],
    [{ ...CONCORRENTE_OK, latitude: 'abc' }],
    [{ ...CONCORRENTE_OK, telefoneCorretor: '11999999999' }],
  ])('POST /bii/concorrentes com corpo invalido %p -> 400', async (corpo) => {
    const res = await fetch(`${base}/bii/concorrentes`, json('admin', corpo));
    expect(res.status).toBe(400);
  });

  it('GET /bii/concorrentes/:id com id que nao e UUID -> 400', async () => {
    const res = await fetch(`${base}/bii/concorrentes/abc`, { headers: { 'x-perfil': 'admin' } });
    expect(res.status).toBe(400);
  });

  it('GET /bii/analises/:id com id que nao e UUID -> 400', async () => {
    const res = await fetch(`${base}/bii/analises/abc`, { headers: { 'x-perfil': 'admin' } });
    expect(res.status).toBe(400);
  });

  describe('POST /bii-plataforma/itbi/importar', () => {
    const temporarios = () => {
      try {
        return readdirSync(PASTA_TEMP_ITBI).length;
      } catch {
        return 0;
      }
    };
    const form = (conteudo: Buffer, nome = 'itbi.xlsx', ano = '2026') => {
      const fd = new FormData();
      fd.append('ano', ano);
      fd.append('file', new Blob([new Uint8Array(conteudo)]), nome);
      return fd;
    };

    it.each(['admin', 'corretor', 'cliente'])('como %s -> 403 (antes de ler o arquivo)', async (perfil) => {
      const res = await fetch(`${base}/bii-plataforma/itbi/importar`, { method: 'POST', headers: { 'x-perfil': perfil }, body: form(Buffer.from('PK\x03\x04')) });
      expect(res.status).toBe(403);
    });

    it('Super Usuario com arquivo que nao e ZIP -> 400 e nenhum temporario fica no disco', async () => {
      const antes = temporarios();
      const res = await fetch(`${base}/bii-plataforma/itbi/importar`, { method: 'POST', headers: { 'x-perfil': 'super' }, body: form(Buffer.from('a;b;c')) });
      expect(res.status).toBe(400);
      expect(temporarios()).toBe(antes);
      expect(importador.iniciar).not.toHaveBeenCalled();
    });

    it('Super Usuario com .xlsx valido -> 202 { importacaoId }', async () => {
      const { escreverPlanilha } = await import('../../../../../test/bii/xlsx-teste.helper');
      const { mkdtempSync, readFileSync, rmSync } = await import('fs');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const dir = mkdtempSync(join(tmpdir(), 'bii-http-'));
      const f = join(dir, 'a.xlsx');
      await escreverPlanilha(f, [{ nome: 'JAN-2026', linhas: [['x']] }]);
      const res = await fetch(`${base}/bii-plataforma/itbi/importar`, { method: 'POST', headers: { 'x-perfil': 'super' }, body: form(readFileSync(f)) });
      rmSync(dir, { recursive: true, force: true });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ importacaoId: 'imp-1' });
      const chamada = (importador.iniciar.mock.calls as unknown as [{ caminho: string; ano: number; userId: string }][])[0][0];
      expect(chamada).toMatchObject({ ano: 2026, userId: 'u-super', nomeArquivo: 'itbi.xlsx' });
      expect(chamada.caminho.startsWith(PASTA_TEMP_ITBI)).toBe(true);
      require('fs').rmSync(chamada.caminho, { force: true }); // importador fake nao apaga
    });

    function cru(cabecalhos: Record<string, string | number>, corpo?: string): Promise<number> {
      return new Promise((resolve, reject) => {
        const u = new URL(`${base}/bii-plataforma/itbi/importar`);
        const req = httpRequest({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'x-perfil': 'super', ...cabecalhos } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        if (corpo) req.write(corpo);
        req.end();
      });
    }

    it('sem Content-Length (chunked) -> 411', async () => {
      expect(await cru({ 'transfer-encoding': 'chunked', 'content-type': 'multipart/form-data; boundary=x' }, '--x--')).toBe(411);
    });

    it('Content-Length acima de 120 MB -> 413 antes do multer', async () => {
      const status = await new Promise<number>((resolve, reject) => {
        const u = new URL(`${base}/bii-plataforma/itbi/importar`);
        const req = httpRequest(
          { host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'x-perfil': 'super', 'content-type': 'multipart/form-data; boundary=x', 'content-length': 200 * 1024 * 1024 } },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
            req.destroy();
          },
        );
        req.on('error', () => undefined);
        req.write('--x\r\n');
        setTimeout(() => reject(new Error('sem resposta')), 5000).unref();
      });
      expect(status).toBe(413);
    });
  });
});
