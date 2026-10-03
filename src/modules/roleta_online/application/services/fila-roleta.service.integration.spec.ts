// Fatia 2 (Sorteio da vez). Integracao (banco real, ver test/jest.setup.ts):
// ordem de chegada, sorteio, "quem recebe vai para o fim", offline pulado
// sem perder o lugar, roteamento por produto/padrao e o job de horarios
// (automatico, botao + seguranca, botao manual).
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaRoletaRepository } from '../../infra/database/prisma-roleta.repository';
import { FilaRoletaService } from './fila-roleta.service';
import { ProcessarHorariosSorteioUseCase } from '../use-cases/processar-horarios-sorteio.use-case';
import { SortearRoletaUseCase } from '../use-cases/sortear-roleta.use-case';
import { momentoSP } from '../../domain/services/fila-sorteio';

describe('FilaRoletaService - sorteio da vez (integracao - banco real)', () => {
  let prisma: PrismaService;
  let repo: PrismaRoletaRepository;
  let emitter: EventEmitter2;
  let fila: FilaRoletaService;
  let tenantId: string;
  let roleId: string;
  let pipelineId: string;
  let empreendimentoId: string;
  const u: Record<string, string> = {};

  beforeAll(async () => {
    prisma = new PrismaService();
    repo = new PrismaRoletaRepository(prisma);
    emitter = new EventEmitter2();
    fila = new FilaRoletaService(repo, emitter);

    const tenant = await prisma.tenant.create({ data: { name: `Tenant Sorteio ${Date.now()}` } });
    tenantId = tenant.id;
    roleId = (await prisma.role.create({ data: { tenantId, name: 'Corretor' } })).id;
    pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Pipeline' } })).id;
    empreendimentoId = (await prisma.empreendimento.create({ data: { tenantId, name: 'Terrasse Teste', rua: 'Rua A', numero: '1', bairro: 'Vila Ema', cidade: 'Sao Paulo', uf: 'SP', cep: '03000-000' } })).id;
    for (const [nome, status] of [['Ana', 'online'], ['Bruno', 'online'], ['Carla', 'online'], ['Davi', 'offline']]) {
      const user = await prisma.user.create({
        data: { tenantId, roleId, name: nome, email: `${nome}-${Date.now()}-${Math.random()}@t.local`, password: 'x', statusDisponibilidade: status },
      });
      u[nome] = user.id;
    }
  }, 30000);

  afterAll(async () => {
    await prisma.roleta.deleteMany({ where: { tenantId } });
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.empreendimento.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  const status = (nome: string, s: string) => prisma.user.update({ where: { id: u[nome] }, data: { statusDisponibilidade: s } });
  const ordemAtual = async (roletaId: string) =>
    (await repo.listPosicoes(roletaId)).map((p) => Object.keys(u).find((k) => u[k] === p.userId));

  async function criarRoletaProduto(extra: Record<string, unknown> = {}) {
    const r0 = await repo.create(tenantId, {
      nome: `Produto ${Math.random()}`,
      tipo: 'produto',
      standId: null,
      padrao: false,
      ativa: true,
      modoSorteio: 'automatico',
      horariosSorteio: [],
      minutosSorteioSeguranca: 15,
      ...extra,
    } as any);
    // criada "ontem" para os horarios de hoje valerem nos testes do job
    await prisma.roleta.update({ where: { id: r0.id }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
    const r = r0;
    await repo.setEmpreendimentos(r.id, [empreendimentoId]);
    await repo.setCorretores(r.id, Object.values(u));
    return (await repo.findById(r.id, tenantId))!;
  }

  afterEach(async () => {
    await prisma.roleta.deleteMany({ where: { tenantId } });
    await prisma.user.updateMany({ where: { tenantId }, data: { statusDisponibilidade: 'online' } });
    await status('Davi', 'offline');
  });

  it('antes do sorteio: ordem de chegada; sorteio so com quem esta presente', async () => {
    const roleta = await criarRoletaProduto();
    await fila.sincronizar(roleta);
    expect(await ordemAtual(roleta.id)).toEqual(['Ana', 'Bruno', 'Carla']);

    const sorteio = await fila.sortear(roleta, 'botao', u.Ana, null);
    expect(sorteio.ordem.map((o) => o.nome).sort()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(await ordemAtual(roleta.id)).toEqual(sorteio.ordem.map((o) => o.nome));
    expect(sorteio.disparadoPorNome).toBe('Ana');

    // Davi chega depois do sorteio: entra no fim
    await status('Davi', 'online');
    await fila.entrarNasFilas(tenantId);
    expect((await ordemAtual(roleta.id))[3]).toBe('Davi');
  });

  it('quem recebe vai para o fim; offline e pulado sem perder o lugar', async () => {
    const roleta = await criarRoletaProduto();
    await repo.reiniciarFila(roleta.id, momentoSP().dia, [u.Bruno, u.Ana, u.Carla]);
    const card = await prisma.card.create({ data: { tenantId, pipelineId, title: 'Lead', position: 0, empreendimentoId } });

    expect((await fila.escolherParaLead(tenantId, card.id))?.userId).toBe(u.Bruno);
    expect(await ordemAtual(roleta.id)).toEqual(['Ana', 'Carla', 'Bruno']);

    await status('Ana', 'offline');
    expect((await fila.escolherParaLead(tenantId, card.id))?.userId).toBe(u.Carla);
    expect(await ordemAtual(roleta.id)).toEqual(['Ana', 'Bruno', 'Carla']); // Ana manteve o 1o lugar

    await status('Ana', 'online');
    expect((await fila.escolherParaLead(tenantId, card.id))?.userId).toBe(u.Ana);
    // excluir (timeout): pula quem perdeu o prazo
    expect((await fila.escolherParaLead(tenantId, card.id, [u.Bruno]))?.userId).toBe(u.Carla);
  });

  it('lead sem produto vai para a roleta padrao; sem roleta, ninguem', async () => {
    const card = await prisma.card.create({ data: { tenantId, pipelineId, title: 'Sem produto', position: 0 } });
    expect(await fila.escolherParaLead(tenantId, card.id)).toBeNull();
    const padrao = await repo.create(tenantId, {
      nome: 'Padrao', tipo: 'produto', standId: null, padrao: true, ativa: true,
      modoSorteio: 'automatico', horariosSorteio: [], minutosSorteioSeguranca: 15,
    });
    await repo.setCorretores(padrao.id, [u.Carla]);
    expect((await fila.escolherParaLead(tenantId, card.id))?.userId).toBe(u.Carla);
  });

  it('fila de outro dia e zerada (recomeca por ordem de chegada)', async () => {
    const roleta = await criarRoletaProduto();
    await repo.reiniciarFila(roleta.id, '2000-01-01', [u.Carla, u.Bruno]);
    await fila.sincronizar((await repo.findById(roleta.id, tenantId))!);
    expect(await ordemAtual(roleta.id)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('job: modo automatico sorteia uma vez por horario', async () => {
    const agora = new Date();
    const { minutos } = momentoSP(agora);
    const h = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    const roleta = await criarRoletaProduto({ horariosSorteio: [h] });
    const job = new ProcessarHorariosSorteioUseCase(repo, fila, emitter);
    await job.execute(agora);
    await job.execute(agora);
    const sorteios = await repo.listSorteios(roleta.id, 10);
    expect(sorteios).toHaveLength(1);
    expect(sorteios[0].origem).toBe('automatico');
    expect(sorteios[0].horario).toBe(h);
  });

  it('job: modo botao avisa supervisores e sorteia sozinho apos a seguranca', async () => {
    const agora = new Date();
    const { minutos } = momentoSP(agora);
    const ini = minutos - 20; // horario ha 20 min (seguranca 15)
    if (ini < 0) return; // logo apos meia-noite: cenario nao se aplica
    const h = `${String(Math.floor(ini / 60)).padStart(2, '0')}:${String(ini % 60).padStart(2, '0')}`;
    const roleta = await criarRoletaProduto({ horariosSorteio: [h], modoSorteio: 'botao' });
    const spy = jest.spyOn(emitter, 'emit');
    const job = new ProcessarHorariosSorteioUseCase(repo, fila, emitter);
    await job.execute(agora);
    expect(spy.mock.calls.filter(([n]) => n === 'roleta.hora_do_sorteio')).toHaveLength(1);
    const sorteios = await repo.listSorteios(roleta.id, 10);
    expect(sorteios).toHaveLength(1);
    expect(sorteios[0].origem).toBe('seguranca');
    await job.execute(agora);
    expect(spy.mock.calls.filter(([n]) => n === 'roleta.hora_do_sorteio')).toHaveLength(1);
    expect(await repo.listSorteios(roleta.id, 10)).toHaveLength(1);
  });

  it('job: horario anterior a criacao da roleta (no mesmo dia) nao dispara', async () => {
    const agora = new Date();
    const { minutos } = momentoSP(agora);
    const ini = minutos - 10;
    if (ini < 0) return;
    const h = `${String(Math.floor(ini / 60)).padStart(2, '0')}:${String(ini % 60).padStart(2, '0')}`;
    const roleta = await repo.create(tenantId, {
      nome: 'Recem criada', tipo: 'produto', standId: null, padrao: false, ativa: true,
      modoSorteio: 'automatico', horariosSorteio: [h], minutosSorteioSeguranca: 15,
    });
    await new ProcessarHorariosSorteioUseCase(repo, fila, emitter).execute(agora);
    expect(await repo.listSorteios(roleta.id, 10)).toHaveLength(0);
  });

  it('botao "Sortear agora" marca o horario pendente e o job nao sorteia de novo', async () => {
    const agora = new Date();
    const { minutos } = momentoSP(agora);
    const ini = minutos - 2;
    if (ini < 0) return;
    const h = `${String(Math.floor(ini / 60)).padStart(2, '0')}:${String(ini % 60).padStart(2, '0')}`;
    const roleta = await criarRoletaProduto({ horariosSorteio: [h], modoSorteio: 'botao' });
    const sortear = new SortearRoletaUseCase(repo, fila);
    await expect(
      sortear.execute({ tenantId, roletaId: roleta.id, userId: u.Ana, requesterRole: 'Corretor', requesterCargo: 'corretor' }),
    ).rejects.toThrow();
    const s = await sortear.execute({ tenantId, roletaId: roleta.id, userId: u.Ana, requesterRole: 'Corretor', requesterCargo: 'gerente' });
    expect(s.origem).toBe('botao');
    expect(s.horario).toBe(h);
    await new ProcessarHorariosSorteioUseCase(repo, fila, emitter).execute(new Date(agora.getTime() + 30 * 60_000));
    expect(await repo.listSorteios(roleta.id, 10)).toHaveLength(1);
  });
});
