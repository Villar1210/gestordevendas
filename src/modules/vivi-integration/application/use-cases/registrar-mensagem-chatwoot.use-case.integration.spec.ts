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
});
