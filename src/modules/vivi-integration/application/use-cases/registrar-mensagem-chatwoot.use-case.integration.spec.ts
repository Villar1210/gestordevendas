// Etapa 1, parte 2 (19/11/2026): gravacao das mensagens do numero oficial
// contra Postgres real (o "nao gravar em dobro" vive no indice unico do
// banco - so um teste com banco de verdade da confianca nisso).
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaCardRepository } from '../../../vendas_kanban/infra/database/prisma-card.repository';
import { PrismaPipelineRepository } from '../../../vendas_kanban/infra/database/prisma-pipeline.repository';
import { CardAbertoPorTelefoneService } from '../../../vendas_kanban/application/services/card-aberto-por-telefone.service';
import { ChatwootMensagemRepository } from '../../infra/database/chatwoot-mensagem.repository';
import { MensagemChatwoot } from '../../services/evento-chatwoot';
import { RegistrarMensagemChatwootUseCase } from './registrar-mensagem-chatwoot.use-case';

describe('RegistrarMensagemChatwootUseCase (integracao - banco real)', () => {
  let prisma: PrismaService;
  let useCase: RegistrarMensagemChatwootUseCase;
  let tenantId: string;
  let pipelineId: string;
  const base = 900_000_000 + Math.floor(Math.random() * 1_000_000);

  const mensagem = (extra: Partial<MensagemChatwoot> = {}): MensagemChatwoot => ({
    chatwootMessageId: base,
    chatwootConversationId: 65,
    chatwootInboxId: 2,
    telefone: '+5511973879858',
    direcao: 'entrada',
    autorTipo: 'cliente',
    autorNome: 'VILLAR',
    conteudo: 'Oi',
    anexos: [],
    enviadaEm: new Date('2026-11-19T12:00:00.000Z'),
    ...extra,
  });

  beforeAll(async () => {
    prisma = new PrismaService();
    useCase = new RegistrarMensagemChatwootUseCase(
      new PrismaPipelineRepository(prisma),
      new CardAbertoPorTelefoneService(new PrismaCardRepository(prisma)),
      new ChatwootMensagemRepository(prisma),
    );
    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Mensagens Chatwoot' } });
    tenantId = tenant.id;
    pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Vendas Teste' } })).id;
  }, 30000);

  afterAll(async () => {
    await prisma.chatwootMensagem.deleteMany({ where: { tenantId } });
    await prisma.card.deleteMany({ where: { tenantId } });
    await prisma.pipeline.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('liga ao card aberto do telefone (formato diferente) e nao grava o mesmo aviso duas vezes', async () => {
    const card = await prisma.card.create({
      data: { tenantId, pipelineId, title: 'Villar', position: 0, phone: '5511973879858', origem: 'vivi' },
    });

    const primeira = await useCase.execute(tenantId, mensagem());
    const repetida = await useCase.execute(tenantId, mensagem({ conteudo: 'Oi (reenviado)' }));

    expect(primeira).toEqual({ gravada: true, cardId: card.id });
    expect(repetida).toEqual({ gravada: false, cardId: card.id });
    const linhas = await prisma.chatwootMensagem.findMany({ where: { chatwootMessageId: base } });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ cardId: card.id, telefoneChave: '1173879858', conteudo: 'Oi', autorTipo: 'cliente', direcao: 'entrada' });
  });

  it('sem card aberto: grava so com o telefone (para ligar depois) e guarda anexos', async () => {
    const r = await useCase.execute(
      tenantId,
      mensagem({ chatwootMessageId: base + 1, telefone: '+5511900001111', conteudo: null, anexos: [{ tipo: 'image', url: 'https://x/y.jpg' }] }),
    );
    expect(r).toEqual({ gravada: true, cardId: null });
    const linha = await prisma.chatwootMensagem.findUnique({ where: { chatwootMessageId: base + 1 } });
    expect(linha).toMatchObject({ cardId: null, telefoneChave: '1100001111', anexos: [{ tipo: 'image', url: 'https://x/y.jpg' }] });
  });

  it('card apagado nao apaga as mensagens (ficam sem card)', async () => {
    const card = await prisma.card.create({
      data: { tenantId, pipelineId, title: 'Temporario', position: 0, phone: '11955554444', origem: 'vivi' },
    });
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 2, telefone: '+5511955554444' }));
    await prisma.card.delete({ where: { id: card.id } });
    const linha = await prisma.chatwootMensagem.findUnique({ where: { chatwootMessageId: base + 2 } });
    expect(linha?.cardId).toBeNull();
  });

  it('Etapa 2: mensagens que chegaram antes do card passam a apontar para ele (so as sem card do mesmo telefone)', async () => {
    const repo = new ChatwootMensagemRepository(prisma);
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 20, telefone: '+5511922223333' }));
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 21, telefone: '+5511922223333', conteudo: 'Tem 2 quartos?' }));
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 22, telefone: '+5511933334444' }));

    const card = await prisma.card.create({
      data: { tenantId, pipelineId, title: 'Cliente novo', position: 0, phone: '11922223333', origem: 'vivi' },
    });
    // proxima mensagem do cliente (webhook) ja liga as anteriores
    expect(await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 23, telefone: '+5511922223333', conteudo: 'Oi de novo' }))).toEqual({
      gravada: true,
      cardId: card.id,
    });
    const doCliente = await prisma.chatwootMensagem.findMany({ where: { chatwootMessageId: { in: [base + 20, base + 21, base + 23] } } });
    expect(doCliente.map((m) => m.cardId)).toEqual([card.id, card.id, card.id]);
    const outro = await prisma.chatwootMensagem.findUnique({ where: { chatwootMessageId: base + 22 } });
    expect(outro?.cardId).toBeNull();
    // chamada direta (usada no aceite): nada mais a ligar
    expect(await repo.ligarSemCardAoCard(tenantId, '1122223333', card.id)).toBe(0);
  });

  it('parte 3: envio do corretor e aviso do webhook - em qualquer ordem, uma linha so, com o corretor como autor', async () => {
    const repo = new ChatwootMensagemRepository(prisma);
    const roleId = (await prisma.role.create({ data: { tenantId, name: 'Corretor' } })).id;
    const corretor = await prisma.user.create({
      data: { tenantId, roleId, name: 'Ana Corretora', email: `ana-${base}@teste.local`, password: 'x' },
    });
    const envio = (id: number) => ({
      ...mensagem({ chatwootMessageId: id, direcao: 'saida', autorTipo: 'atendente', autorNome: 'Ana Corretora', conteudo: '*Ana*\nOi' }),
      tenantId,
      cardId: null,
      telefoneChave: '1173879858',
      autorUserId: corretor.id,
    });

    // webhook primeiro (sem autor), depois o registro do envio
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 10, direcao: 'saida', autorTipo: 'atendente', autorNome: 'Gestor de Vendas' }));
    await repo.registrarEnvio(envio(base + 10));
    // registro do envio primeiro, depois o webhook (ignorado por ser repetido)
    await repo.registrarEnvio(envio(base + 11));
    await useCase.execute(tenantId, mensagem({ chatwootMessageId: base + 11, direcao: 'saida', autorTipo: 'atendente', autorNome: 'Gestor de Vendas' }));

    for (const id of [base + 10, base + 11]) {
      const linhas = await prisma.chatwootMensagem.findMany({ where: { chatwootMessageId: id } });
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ autorUserId: corretor.id, autorNome: 'Ana Corretora', autorTipo: 'atendente', direcao: 'saida' });
    }
    await prisma.chatwootMensagem.deleteMany({ where: { autorUserId: corretor.id } });
    await prisma.user.delete({ where: { id: corretor.id } });
    await prisma.role.delete({ where: { id: roleId } });
  });

  it('Etapa 3: historico em lote sem duplicar, conversa em ordem, resumo da lista e leitura', async () => {
    const repo = new ChatwootMensagemRepository(prisma);
    const roleId = (await prisma.role.create({ data: { tenantId, name: 'Corretor E3' } })).id;
    const u = await prisma.user.create({ data: { tenantId, roleId, name: 'Bia', email: `bia-${base}@teste.local`, password: 'x' } });
    const card = await prisma.card.create({ data: { tenantId, pipelineId, title: 'Chat', position: 0, phone: '11944445555', origem: 'vivi' } });
    const lote = [
      { ...mensagem({ chatwootMessageId: base + 30, enviadaEm: new Date('2026-11-19T10:00:00Z'), conteudo: 'Oi' }), tenantId, cardId: card.id, telefoneChave: '1144445555' },
      { ...mensagem({ chatwootMessageId: base + 31, enviadaEm: new Date('2026-11-19T10:01:00Z'), direcao: 'saida', autorTipo: 'vivi', conteudo: 'Ola' }), tenantId, cardId: card.id, telefoneChave: '1144445555' },
      { ...mensagem({ chatwootMessageId: base + 32, enviadaEm: new Date('2026-11-19T10:02:00Z'), conteudo: 'Tem 2 quartos?' }), tenantId, cardId: card.id, telefoneChave: '1144445555' },
    ];
    expect(await repo.inserirVarias(lote)).toBe(3);
    expect(await repo.inserirVarias(lote)).toBe(0);

    const conversa = await repo.daConversa(card.id);
    expect(conversa.map((m) => m.conteudo)).toEqual(['Oi', 'Ola', 'Tem 2 quartos?']);
    expect(await repo.ultimaDoCliente(card.id)).toEqual(new Date('2026-11-19T10:02:00Z'));
    expect(await repo.corretorJaEscreveu(card.id)).toBe(false);

    let resumo = (await repo.resumoPorCard([card.id], u.id)).get(card.id)!;
    expect(resumo.naoLidas).toBe(2);
    expect(resumo.ultima).toMatchObject({ texto: 'Tem 2 quartos?', autorTipo: 'cliente' });

    await repo.marcarLido(u.id, card.id, new Date('2026-11-19T10:01:30Z'));
    resumo = (await repo.resumoPorCard([card.id], u.id)).get(card.id)!;
    expect(resumo.naoLidas).toBe(1);
    await repo.marcarLido(u.id, card.id, new Date('2026-11-19T11:00:00Z'));
    expect((await repo.resumoPorCard([card.id], u.id)).get(card.id)!.naoLidas).toBe(0);

    await prisma.chatwootMensagem.deleteMany({ where: { cardId: card.id } });
    await prisma.card.delete({ where: { id: card.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.role.delete({ where: { id: roleId } });
  });
});
