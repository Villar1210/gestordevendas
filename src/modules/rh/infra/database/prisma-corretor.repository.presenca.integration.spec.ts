// Presenca automatica (Fatia 1 - Atendimento/Roleta). Integracao (banco real,
// ver test/jest.setup.ts): a regra critica vive num UPDATE em SQL puro
// (limite por tenant via JOIN em roleta_configs) - so Postgres real da
// confianca de que o filtro esta certo.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCorretorRepository } from './prisma-corretor.repository';

describe('PrismaCorretorRepository - presenca automatica (integracao - banco real)', () => {
  let prisma: PrismaService;
  let repo: PrismaCorretorRepository;
  const tenants: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    repo = new PrismaCorretorRepository(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.roletaConfig.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  }, 30000);

  async function criarTenant(minutos?: number) {
    const tenant = await prisma.tenant.create({ data: { name: `Tenant Presenca ${Date.now()}-${Math.random()}` } });
    tenants.push(tenant.id);
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Corretor' } });
    if (minutos !== undefined) {
      await prisma.roletaConfig.create({ data: { tenantId: tenant.id, minutosInatividadeOffline: minutos } });
    }
    return { tenantId: tenant.id, roleId: role.id };
  }

  async function criarUsuario(t: { tenantId: string; roleId: string }, status: string, minutosAtras: number | null) {
    return prisma.user.create({
      data: {
        tenantId: t.tenantId,
        roleId: t.roleId,
        name: `U ${status} ${minutosAtras}`,
        email: `presenca-${Date.now()}-${Math.random()}@teste.local`,
        password: 'x',
        statusDisponibilidade: status,
        ultimaAtividadeEm: minutosAtras === null ? null : new Date(Date.now() - minutosAtras * 60_000),
      },
    });
  }

  const statusDe = async (id: string) =>
    (await prisma.user.findUnique({ where: { id }, select: { statusDisponibilidade: true } }))!.statusDisponibilidade;

  it('respeita o limite de cada tenant (config propria e default 15)', async () => {
    const t10 = await criarTenant(10);
    const tDefault = await criarTenant(); // sem RoletaConfig -> 15
    const inativo10 = await criarUsuario(t10, 'online', 12);
    const ativo10 = await criarUsuario(t10, 'online', 5);
    const inativoDefault = await criarUsuario(tDefault, 'online', 20);
    const ativoDefault = await criarUsuario(tDefault, 'online', 12);
    const semSinal = await criarUsuario(tDefault, 'online', null);

    const derrubados = await repo.marcarOfflinePorInatividade();
    const ids = derrubados.map((d) => d.id);

    expect(ids).toEqual(expect.arrayContaining([inativo10.id, inativoDefault.id, semSinal.id]));
    expect(ids).not.toContain(ativo10.id);
    expect(ids).not.toContain(ativoDefault.id);
    expect(await statusDe(inativo10.id)).toBe('offline');
    expect(await statusDe(ativo10.id)).toBe('online');
    expect(derrubados.find((d) => d.id === inativo10.id)?.tenantId).toBe(t10.tenantId);
  });

  it('nao mexe em quem esta ausente/offline nem em tenant com recurso desligado (0)', async () => {
    const tDesligado = await criarTenant(0);
    const tNormal = await criarTenant(15);
    const onlineDesligado = await criarUsuario(tDesligado, 'online', 500);
    const ausente = await criarUsuario(tNormal, 'ausente', 500);

    const ids = (await repo.marcarOfflinePorInatividade()).map((d) => d.id);
    expect(ids).not.toContain(onlineDesligado.id);
    expect(ids).not.toContain(ausente.id);
    expect(await statusDe(onlineDesligado.id)).toBe('online');
    expect(await statusDe(ausente.id)).toBe('ausente');
  });

  it('registrarAtividade renova o sinal e devolve o status atual', async () => {
    const t = await criarTenant(15);
    const u = await criarUsuario(t, 'online', 14);
    await expect(repo.registrarAtividade(u.id, t.tenantId)).resolves.toBe('online');
    const ids = (await repo.marcarOfflinePorInatividade()).map((d) => d.id);
    expect(ids).not.toContain(u.id); // acabou de dar sinal de vida
    await expect(repo.registrarAtividade(u.id, '00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });
});
