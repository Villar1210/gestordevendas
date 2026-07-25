// Corrige a lacuna real confirmada em producao (25/07/2026): mensagens
// recebidas durante uma desconexao do WhatsApp nunca eram capturadas (ver
// CLAUDE.md "Bug confirmado: lacuna de captura de mensagem durante
// desconexao"). Integracao (banco real, crm_core_db_test - ver
// jest.setup.ts): exercita o handler REAL registrado por connect() para o
// evento 'messaging-history.set' do Baileys (nao so a funcao pura de
// dominio, ja coberta isoladamente em select-recoverable-history-messages.spec.ts),
// incluindo a consulta real de dedupe (findExistingBaileysMessageIds) e a
// gravacao real de WhatsAppMessage.baileysMessageId.
//
// makeWASocket/useMultiFileAuthState/fetchLatestBaileysVersion sao mockados
// (nenhuma conexao real com o WhatsApp) - o mock de makeWASocket captura os
// handlers registrados via sock.ev.on(...) num objeto exposto como
// "__handlers", para o teste poder invocar diretamente o handler de
// 'messaging-history.set' com um payload fake, do mesmo jeito que o Baileys
// real invocaria.
jest.mock('baileys', () => {
  const handlers: Record<string, (...args: any[]) => any> = {};
  return {
    __esModule: true,
    __handlers: handlers,
    default: jest.fn(() => ({
      ev: {
        on: (event: string, cb: (...args: any[]) => any) => {
          handlers[event] = cb;
        },
      },
      user: { id: '5511966111740:1@s.whatsapp.net' },
    })),
    useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 0] }),
    getContentType: jest.fn((message: any) => {
      if (message?.conversation) return 'conversation';
      if (message?.extendedTextMessage) return 'extendedTextMessage';
      return undefined;
    }),
    DisconnectReason: {},
  };
});

import * as baileysMock from 'baileys';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaWhatsAppSessionRepository } from '../database/prisma-whatsapp-session.repository';
import { PrismaWhatsAppMessageRepository } from '../database/prisma-whatsapp-message.repository';
import { BaileysWhatsAppProvider } from './baileys-whatsapp-provider';

const RECENT_SYNC_TYPE = 3;
const CONTATO_JID = '5511999990000@s.whatsapp.net';

describe('BaileysWhatsAppProvider - recuperacao via messaging-history.set (integracao)', () => {
  let prisma: PrismaService;
  let sessionRepository: PrismaWhatsAppSessionRepository;
  let messageRepository: PrismaWhatsAppMessageRepository;
  let provider: BaileysWhatsAppProvider;
  let tenantId: string;
  let sessionId: string;
  const eventEmitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    prisma = new PrismaService();
    sessionRepository = new PrismaWhatsAppSessionRepository(prisma);
    messageRepository = new PrismaWhatsAppMessageRepository(prisma);
    provider = new BaileysWhatsAppProvider(sessionRepository, messageRepository, eventEmitter as any);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Historico WhatsApp' } });
    tenantId = tenant.id;
    const session = await prisma.whatsAppSession.create({
      data: { tenantId, label: 'WhatsApp Teste Historico', status: 'CONNECTED', phoneNumber: '5511966111740' },
    });
    sessionId = session.id;

    // Mensagem ja capturada normalmente (ex: chegou ao vivo via
    // messages.upsert antes do messaging-history.set chegar) - usada para
    // provar o dedupe: o mesmo baileysMessageId nao deve virar 2 registros.
    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        sessionId,
        direction: 'IN',
        fromNumber: '5511999990000',
        toNumber: '5511966111740',
        remoteJid: CONTATO_JID,
        body: 'ja capturada ao vivo',
        timestamp: new Date(),
        baileysMessageId: 'dup-1',
      },
    });

    // connect() real (com Baileys mockado) - popula (baileysMock as any).__handlers.
    await provider.createSession(sessionId);
  });

  afterAll(async () => {
    await prisma.whatsAppMessage.deleteMany({ where: { tenantId } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('processa corretamente: dentro da janela persiste, fora da janela descarta, dedupe funciona, ordem cronologica e preservada', async () => {
    const handlers = (baileysMock as any).__handlers;
    const historyHandler = handlers['messaging-history.set'];
    expect(historyHandler).toBeDefined();

    const nowMs = Date.now();
    const secondsAgo = (h: number) => Math.floor((nowMs - h * 60 * 60 * 1000) / 1000);

    await historyHandler({
      syncType: RECENT_SYNC_TYPE,
      messages: [
        // Fora da janela de 6h - NAO deve ser processada.
        {
          key: { id: 'fora-da-janela', remoteJid: CONTATO_JID, fromMe: false },
          message: { conversation: 'mensagem antiga, fora da janela' },
          messageTimestamp: secondsAgo(10),
        },
        // Dentro da janela, mais RECENTE das duas novas (1h atras).
        {
          key: { id: 'nova-mais-recente', remoteJid: CONTATO_JID, fromMe: false },
          message: { conversation: 'mensagem nova B (1h atras)' },
          messageTimestamp: secondsAgo(1),
        },
        // Dentro da janela, mais ANTIGA das duas novas (2h atras) - deve
        // ser processada ANTES da anterior, apesar de vir DEPOIS no lote.
        {
          key: { id: 'nova-mais-antiga', remoteJid: CONTATO_JID, fromMe: false },
          message: { conversation: 'mensagem nova A (2h atras)' },
          messageTimestamp: secondsAgo(2),
        },
        // Ja existe no banco (baileysMessageId="dup-1") - dedupe deve
        // descartar, nao duplicar.
        {
          key: { id: 'dup-1', remoteJid: CONTATO_JID, fromMe: false },
          message: { conversation: 'nao deveria duplicar' },
          messageTimestamp: secondsAgo(0.5),
        },
      ],
    });

    const registros = await prisma.whatsAppMessage.findMany({
      where: { sessionId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    // Correcao: nao processa historico antigo fora da janela.
    expect(registros.find((r) => r.baileysMessageId === 'fora-da-janela')).toBeUndefined();

    // Correcao: mensagens novas dentro da janela SAO persistidas.
    expect(registros.find((r) => r.baileysMessageId === 'nova-mais-recente')).toBeDefined();
    expect(registros.find((r) => r.baileysMessageId === 'nova-mais-antiga')).toBeDefined();

    // Dedupe: so 1 registro para "dup-1" (o pre-existente, nao duplicado).
    const duplicados = registros.filter((r) => r.baileysMessageId === 'dup-1');
    expect(duplicados).toHaveLength(1);
    expect(duplicados[0].body).toBe('ja capturada ao vivo');

    // Ordem cronologica preservada na entrega ao pipeline (VIVI/Atendimento):
    // "nova-mais-antiga" (2h atras) processada ANTES de "nova-mais-recente"
    // (1h atras), mesmo tendo chegado DEPOIS no lote do Baileys.
    const corposEmitidos = eventEmitter.emitAsync.mock.calls.map((call) => call[1].messageBody);
    expect(corposEmitidos).toEqual(['mensagem nova A (2h atras)', 'mensagem nova B (1h atras)']);

    // emit() (fire-and-forget, usado pelo messages.upsert ao vivo) nunca
    // deve ser chamado por este caminho - so emitAsync.
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
