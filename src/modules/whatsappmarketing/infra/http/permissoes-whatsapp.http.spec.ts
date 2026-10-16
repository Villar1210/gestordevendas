// Permissoes do WhatsApp (16/10/2026): conexao do numero da imobiliaria
// (sessoes, QR, status, enviar, desconectar) e ligar/desligar a VIVI na
// sessao = SO Administrador. Teste HTTP por tabela com o RolesGuard REAL e
// use cases mockados + META-TESTE pelo metadata de roles (qualquer rota
// destes controllers tem de ser so Administrador). ViviSessionController
// entra aqui porque divide o prefixo /whatsapp/sessions (a VIVI em si nao muda).
import { CanActivate, ExecutionContext, INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { WhatsAppController } from './whatsapp.controller';
import { ViviSessionController } from '../../../vivi_sdr/infra/http/vivi-session.controller';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../../../shared/infra/http/decorators/roles.decorator';

jest.setTimeout(60_000);

const PERFIS = {
  admin: { id: 'u-admin', role: 'Administrador', cargo: null },
  corretor: { id: 'u-corretor', role: 'Corretor', cargo: 'corretor' },
  gerente: { id: 'u-gerente', role: 'Corretor', cargo: 'gerente' },
  coordenador: { id: 'u-coord', role: 'Corretor', cargo: 'coordenador' },
  parceiro: { id: 'u-parceiro', role: 'Corretor Parceiro', cargo: null },
} as const;
type Perfil = keyof typeof PERFIS;
const TODOS = Object.keys(PERFIS) as Perfil[];

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { ...PERFIS[req.headers['x-perfil'] as Perfil], tenantId: 't-1', standId: null, impersonadoPor: null };
    return true;
  }
}

const ROTAS: { nome: string; metodo: 'GET' | 'POST' | 'DELETE'; url: string; body?: unknown }[] = [
  { nome: 'WhatsAppController.getMine', metodo: 'GET', url: '/whatsapp/sessions/me' },
  { nome: 'WhatsAppController.create', metodo: 'POST', url: '/whatsapp/sessions', body: {} },
  { nome: 'WhatsAppController.getQrCode', metodo: 'GET', url: '/whatsapp/sessions/s-1/qr' },
  { nome: 'WhatsAppController.getStatus', metodo: 'GET', url: '/whatsapp/sessions/s-1/status' },
  { nome: 'WhatsAppController.send', metodo: 'POST', url: '/whatsapp/sessions/s-1/send', body: { to: '5511999999999', body: 'oi' } },
  { nome: 'WhatsAppController.disconnect', metodo: 'DELETE', url: '/whatsapp/sessions/s-1' },
  { nome: 'ViviSessionController.enable', metodo: 'POST', url: '/whatsapp/sessions/s-1/vivi/enable' },
  { nome: 'ViviSessionController.disable', metodo: 'POST', url: '/whatsapp/sessions/s-1/vivi/disable' },
];

const CONTROLLERS = { WhatsAppController, ViviSessionController };

describe('Permissoes WhatsApp - META-TESTE (metadata de roles)', () => {
  for (const [nomeController, controller] of Object.entries(CONTROLLERS)) {
    const proto = controller.prototype as unknown as Record<string, object>;
    const rotas = Object.getOwnPropertyNames(proto)
      .filter((n) => n !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[n]) !== undefined)
      .map((n) => ({
        nome: n,
        rotulo: `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, proto[n]) as number]} ${Reflect.getMetadata(PATH_METADATA, proto[n])}`,
        roles: (Reflect.getMetadata(ROLES_KEY, proto[n]) ?? Reflect.getMetadata(ROLES_KEY, controller)) as string[] | undefined,
      }));

    it.each(rotas.map((r) => [`${nomeController} ${r.rotulo}`, r] as const))('%s: so Administrador', (_rotulo, rota) => {
      expect(rota.roles).toEqual(['Administrador']);
    });

    it(`${nomeController}: toda rota esta na tabela HTTP`, () => {
      const nomes = ROTAS.map((r) => r.nome);
      for (const r of rotas) expect(nomes).toContain(`${nomeController}.${r.nome}`);
    });
  }
});

describe('Permissoes WhatsApp - tabela HTTP (RolesGuard real)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [WhatsAppController, ViviSessionController] })
      .useMocker(() => ({ execute: jest.fn(async () => ({ ok: true })) }))
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

  const casos = ROTAS.flatMap((rota) => TODOS.map((perfil) => [rota.nome, perfil, perfil === 'admin' ? 'passa' : '403', rota] as const));

  it.each(casos)('%s - %s: %s', async (_nome, perfil, esperado, rota) => {
    const res = await fetch(`${base}${rota.url}`, {
      method: rota.metodo,
      headers: { 'x-perfil': perfil, 'content-type': 'application/json' },
      body: rota.metodo === 'GET' ? undefined : JSON.stringify(rota.body ?? {}),
    });
    if (esperado === 'passa') {
      expect(res.status).toBeLessThan(400);
    } else {
      expect(res.status).toBe(403);
    }
  });
});
