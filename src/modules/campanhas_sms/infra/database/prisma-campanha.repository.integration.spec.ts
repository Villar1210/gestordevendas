// Integracao (Postgres REAL): todas as consultas do repositorio de campanhas,
// isolamento de tenant, condicionais de status, unicidade e cascata do tenant.
// Sem DATABASE_URL o teste e pulado.
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCampanhaRepository } from './prisma-campanha.repository';
import { NovoContato } from '../../domain/repositories/campanha-repository.interface';

const descrever = process.env.DATABASE_URL ? describe : describe.skip;

descrever('PrismaCampanhaRepository (Postgres real)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCampanhaRepository(prisma);
  const tenantIds: string[] = [];
  const USER = randomUUID();
  let seq = 0;

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  async function tenant() {
    const t = await prisma.tenant.create({ data: { name: `Teste campanha ${randomUUID().slice(0, 8)}` } });
    tenantIds.push(t.id);
    return t.id;
  }

  function codigo() {
    seq++;
    return `T${String(seq).padStart(3, '0')}${randomUUID().replace(/-/g, '').slice(0, 2)}`;
  }

  async function campanha(tenantId: string) {
    return repo.criar({
      tenantId,
      nome: 'Repique',
      mensagem: 'Oi {primeiro_nome} {link}',
      linkDestino: 'https://freguesia.ivillar.com.br',
      maxSegmentos: 1,
      taxaPorMinuto: 30,
      janelaInicio: 9,
      janelaFim: 20,
      codigoTeste: codigo(),
      criadoPorUserId: USER,
    });
  }

  function contato(telefone: string, extra: Partial<NovoContato> = {}): NovoContato {
    return { nome: `Cliente ${telefone.slice(-4)}`, primeiroNome: 'Ana', telefone, corretor: 'Lucas', referencia: null, codigo: codigo(), status: 'pendente', ...extra };
  }

  it('cria, isola por tenant e muda status de forma condicional', async () => {
    const [t1, t2] = [await tenant(), await tenant()];
    const c = await campanha(t1);
    expect(await repo.buscar(t2, c.id)).toBeNull();
    expect(await repo.atualizar(t2, c.id, { nome: 'x' }, ['rascunho'])).toBe(false);
    expect(await repo.atualizar(t1, c.id, { nome: 'Novo' }, ['rascunho'])).toBe(true);
    expect(await repo.mudarStatus(t1, c.id, ['pausada'], 'enviando')).toBe(false);
    expect(await repo.mudarStatus(t1, c.id, ['rascunho'], 'enviando', { iniciadaEm: new Date() })).toBe(true);
    expect(await repo.atualizar(t1, c.id, { nome: 'y' }, ['rascunho', 'pausada'])).toBe(false);
    expect((await repo.listar(t1, 10)).map((x) => x.id)).toEqual([c.id]);
    expect(await repo.listar(t2, 10)).toEqual([]);
    expect((await repo.campanhasEnviando()).some((x) => x.id === c.id)).toBe(true);
  });

  it('contatos: insere sem duplicar, conta, lista, busca e exporta', async () => {
    const t1 = await tenant();
    const c = await campanha(t1);
    const n = await repo.inserirContatos(t1, c.id, [contato('5511900000001'), contato('5511900000002', { primeiroNome: 'Mariazinha' }), contato('5511900000003', { status: 'bloqueado' })]);
    expect(n).toBe(3);
    expect(await repo.inserirContatos(t1, c.id, [contato('5511900000001')])).toBe(0);
    expect(await repo.contarContatos(c.id)).toBe(3);
    expect(await repo.telefonesDaCampanha(c.id)).toEqual(new Set(['5511900000001', '5511900000002', '5511900000003']));
    expect(await repo.maiorPrimeiroNome(c.id)).toBe('Mariazinha');
    const lista = await repo.listarContatos(t1, c.id, { busca: '0002' }, 1, 50);
    expect(lista.total).toBe(1);
    expect((await repo.listarContatos(t1, c.id, { status: 'bloqueado' }, 1, 50)).total).toBe(1);
    expect((await repo.listarContatos(t1, c.id, { busca: 'cliente 0003' }, 1, 50)).total).toBe(1);
    const cont = (await repo.contagens([c.id])).get(c.id)!;
    expect(cont).toMatchObject({ pendente: 2, bloqueado: 1, total: 3, comClique: 0, comResposta: 0 });
    const usados = await repo.codigosEmUso([c.codigoTeste, 'ZZZZZZ']);
    expect(usados).toEqual(new Set([c.codigoTeste]));
  });

  it('job: reserva condicional, envio, falha, devolucao, travados e conclusao', async () => {
    const t1 = await tenant();
    const c = await campanha(t1);
    await repo.inserirContatos(t1, c.id, [contato('5511900000011'), contato('5511900000012'), contato('5511900000013')]);
    const [a, b, d] = await repo.pendentes(c.id, 10);
    expect(await repo.reservar(a.id)).toBe(true);
    expect(await repo.reservar(a.id)).toBe(false);
    await repo.marcarEnviado(a.id, 'prov-a', new Date());
    await repo.reservar(b.id);
    await repo.devolverPendente(b.id, 'timeout');
    await repo.reservar(b.id);
    await repo.marcarFalhou(b.id, 'HTTP 400');
    await repo.reservar(d.id);
    expect(await repo.falharTravados('interrompido')).toBeGreaterThanOrEqual(1);
    const todos = (await repo.listarContatos(t1, c.id, {}, 1, 50)).itens;
    const por = Object.fromEntries(todos.map((x) => [x.id, x]));
    expect(por[a.id]).toMatchObject({ status: 'enviado', provedorMensagemId: 'prov-a', tentativas: 1 });
    expect(por[b.id]).toMatchObject({ status: 'falhou', erro: 'HTTP 400', tentativas: 2 });
    expect(por[d.id]).toMatchObject({ status: 'falhou', erro: 'interrompido' });
    expect(await repo.existeAEnviar(c.id)).toBe(false);
  });

  it('webhook e clique: entrega, resposta, opt-out por tenant, clique', async () => {
    const [t1, t2] = [await tenant(), await tenant()];
    const c1 = await campanha(t1);
    const c2 = await campanha(t2);
    const tel = '5511900000021';
    await repo.inserirContatos(t1, c1.id, [contato(tel)]);
    await repo.inserirContatos(t2, c2.id, [contato(tel), contato('5511900000022')]);
    const [x1] = await repo.pendentes(c1.id, 1);
    await repo.reservar(x1.id);
    await repo.marcarEnviado(x1.id, 'prov-x1', new Date());
    expect(await repo.atualizarEntrega('prov-x1', 'entregue', new Date())).toBe(1);
    expect(await repo.atualizarEntrega('prov-x1', 'falhou', new Date(), 'x')).toBe(0); // ja entregue

    const recentes = await repo.contatosRecentesDoTelefone(tel, new Date(Date.now() - 86_400_000));
    expect(recentes.map((r) => r.tenantId)).toEqual([t1]);
    await repo.registrarResposta(x1.id, 'SAIR', new Date(), true);
    await repo.registrarOptout(t1, tel, 'resposta');
    await repo.registrarOptout(t1, tel, 'resposta'); // idempotente
    expect(await repo.telefonesEmOptout(t1, [tel])).toEqual(new Set([tel]));
    expect(await repo.telefonesEmOptout(t2, [tel])).toEqual(new Set());
    expect(await repo.marcarOptoutPendentes(t2, tel, new Date())).toBe(1);
    expect((await repo.listarOptouts(t1, 10)).map((o) => o.telefone)).toEqual([tel]);

    const alvo = await repo.contatoPorCodigo(x1.codigo);
    expect(alvo).toEqual({ contatoId: x1.id, campanhaId: c1.id, linkDestino: 'https://freguesia.ivillar.com.br' });
    await repo.registrarClique(x1.id, new Date('2026-11-16T14:00:00Z'));
    await repo.registrarClique(x1.id, new Date('2026-11-16T15:00:00Z'));
    const depois = (await repo.listarContatos(t1, c1.id, {}, 1, 10)).itens[0];
    expect(depois).toMatchObject({ cliques: 2, status: 'optout', respostaTexto: 'SAIR' });
    expect(depois.primeiroCliqueEm?.toISOString()).toBe('2026-11-16T14:00:00.000Z');
    expect(depois.ultimoCliqueEm?.toISOString()).toBe('2026-11-16T15:00:00.000Z');
    expect(await repo.campanhaPorCodigoTeste(c2.codigoTeste)).toEqual({ id: c2.id, linkDestino: 'https://freguesia.ivillar.com.br' });
    const cont = (await repo.contagens([c1.id])).get(c1.id)!;
    expect(cont).toMatchObject({ optout: 1, comClique: 1, cliquesTotais: 2, comResposta: 1 });
    expect((await repo.contatosParaExportar(t1, c1.id, { somenteClicou: true }, 10)).length).toBe(1);
    expect((await repo.contatosParaExportar(t2, c1.id, {}, 10)).length).toBe(0);
  });

  it('cancelar pendentes, apagar contatos e cascata do tenant', async () => {
    const t1 = await tenant();
    const c = await campanha(t1);
    await repo.inserirContatos(t1, c.id, [contato('5511900000031'), contato('5511900000032')]);
    expect(await repo.cancelarPendentes(c.id)).toBe(2);
    expect(await repo.apagarContatos(t1, c.id)).toBe(2);
    await repo.inserirContatos(t1, c.id, [contato('5511900000033')]);
    await repo.registrarOptout(t1, '5511900000033', 'manual');
    await prisma.tenant.delete({ where: { id: t1 } });
    tenantIds.splice(tenantIds.indexOf(t1), 1);
    expect(await prisma.campanhaSms.count({ where: { id: c.id } })).toBe(0);
    expect(await prisma.campanhaSmsContato.count({ where: { campanhaId: c.id } })).toBe(0);
    expect(await prisma.smsOptOut.count({ where: { tenantId: t1 } })).toBe(0);
  });
});
