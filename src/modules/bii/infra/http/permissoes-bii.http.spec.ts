// META-TESTE de permissoes do BII (molde: gestao_imobiliaria/infra/http/
// permissoes-imoveis.http.spec.ts). Falha se QUALQUER rota de QUALQUER
// controller do modulo bii nao for so 'Administrador' com JwtAuthGuard +
// RolesGuard. Os controllers sao descobertos pelo proprio BiiModule (controller
// novo registrado no modulo entra no teste sozinho). Inclui teste HTTP com o
// RolesGuard REAL (so o JwtAuthGuard e trocado por um fake).
import { CanActivate, ExecutionContext, INestApplication, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { BiiModule } from '../../bii.module';
import { BiiPainelController } from './bii-painel.controller';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { ROLES_KEY } from '../../../../shared/infra/http/decorators/roles.decorator';
import { GetPainelVendasUseCase } from '../../application/use-cases/get-painel-vendas.use-case';

type Ctor = new (...args: never[]) => unknown;
const CONTROLLERS = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BiiModule) ?? []) as Ctor[];

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
  it('o modulo registra ao menos o controller do painel', () => {
    expect(CONTROLLERS).toContain(BiiPainelController);
  });

  for (const controller of CONTROLLERS) {
    describe(controller.name, () => {
      it("classe: @Roles('Administrador') e @UseGuards(JwtAuthGuard, RolesGuard)", () => {
        expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual(['Administrador']);
        const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
        expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
        expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(guards.indexOf(RolesGuard));
      });

      const rotas = rotasDoController(controller);
      it('tem rotas', () => expect(rotas.length).toBeGreaterThan(0));

      it.each(rotas.map((r) => [`${r.metodo} ${r.path} (${r.nome})`, r] as const))('%s e so Administrador', (_r, rota) => {
        expect(rota.roles).toEqual(['Administrador']);
        // nenhuma rota troca os guards da classe por outros
        expect(rota.guardsMetodo).toEqual([]);
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
};

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const p = PERFIS[req.headers['x-perfil'] as string];
    req.user = { ...p, tenantId: 'tenant-a', standId: null, impersonadoPor: req.headers['x-impersonado'] ?? null };
    return true;
  }
}

describe('Permissoes BII - HTTP (RolesGuard real)', () => {
  let app: INestApplication;
  let base: string;
  const execute = jest.fn(async () => ({ ok: true }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: CONTROLLERS,
      providers: [{ provide: GetPainelVendasUseCase, useValue: { execute } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(Object.keys(PERFIS))('GET /bii/painel como %s', async (perfil) => {
    const res = await fetch(`${base}/bii/painel`, { headers: { 'x-perfil': perfil } });
    expect(res.status).toBe(perfil === 'admin' ? 200 : 403);
  });

  it('Administrador impersonado (Super Usuario): leitura permitida', async () => {
    const res = await fetch(`${base}/bii/painel`, { headers: { 'x-perfil': 'admin', 'x-impersonado': 'su-1' } });
    expect(res.status).toBe(200);
  });

  it('tenantId e role sempre de req.user (nunca da query)', async () => {
    execute.mockClear();
    await fetch(`${base}/bii/painel?tenantId=tenant-b&de=2026-07-01&ate=2026-07-31`, { headers: { 'x-perfil': 'admin' } });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', requesterRole: 'Administrador', de: new Date(2026, 6, 1), ate: new Date(2026, 6, 31) }),
    );
  });
});
