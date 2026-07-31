// Confirmacao de entrega (ver CLAUDE.md "sem o ACK, os dois casos sao
// indistinguiveis..."): integracao (banco real, crm_core_db_test - ver
// jest.setup.ts) exercitando o fluxo completo - sendMessage() captura o
// baileysMessageId retornado pelo Baileys e grava statusEntrega="pending",
// depois o handler REAL registrado por connect() para 'messages.update'
// atualiza esse mesmo registro conforme os eventos de ACK chegam. Mesmo
// padrao de mock de "baileys" (captura de handlers via "__handlers") ja
// usado em baileys-whatsapp-provider.messaging-history.integration.spec.ts.
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
      sendMessage: jest.fn().mockResolvedValue({
        key: { id: 'BAILEYS-ID-ENVIO-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: true },
      }),
    })),
    useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 0] }),
    getContentType: jest.fn(() => undefined),
    DisconnectReason: {},
  };
});

import { Logger } from '@nestjs/common';
import * as baileysMock from 'baileys';
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaWhatsAppSessionRepository } from '../database/prisma-whatsapp-session.repository';
import { PrismaWhatsAppMessageRepository } from '../database/prisma-whatsapp-message.repository';
import { BaileysWhatsAppProvider } from './baileys-whatsapp-provider';

describe('BaileysWhatsAppProvider - confirmacao de entrega via messages.update (integracao)', () => {
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

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Confirmacao Entrega' } });
    tenantId = tenant.id;
    const session = await prisma.whatsAppSession.create({
      data: { tenantId, label: 'WhatsApp Teste Entrega', status: 'CONNECTED', phoneNumber: '5511966111740' },
    });
    sessionId = session.id;

    // connect() real (Baileys mockado) - popula sockets + __handlers, e
    // fica disponivel pra sendMessage() usar via this.sockets.get(sessionId).
    await provider.createSession(sessionId);
  });

  afterAll(async () => {
    await prisma.whatsAppMessage.deleteMany({ where: { tenantId } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('sendMessage grava statusEntrega="pending" com o baileysMessageId retornado, e messages.update atualiza a progressao do ACK', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    await provider.sendMessage(sessionId, '5511999990000@s.whatsapp.net', 'Ola! Como posso ajudar?', '5511999990000');

    const recemEnviada = await prisma.whatsAppMessage.findFirst({
      where: { sessionId, direction: 'OUT', body: 'Ola! Como posso ajudar?' },
    });
    expect(recemEnviada?.baileysMessageId).toBe('BAILEYS-ID-ENVIO-1');
    expect(recemEnviada?.statusEntrega).toBe('pending');

    const handlers = (baileysMock as any).__handlers;
    const updateHandler = handlers['messages.update'];
    expect(updateHandler).toBeDefined();

    // Progressao real: SERVER_ACK (2) primeiro...
    await updateHandler([
      { key: { id: 'BAILEYS-ID-ENVIO-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: true }, update: { status: 2 } },
    ]);
    let atualizada = await prisma.whatsAppMessage.findUnique({ where: { id: recemEnviada!.id } });
    expect(atualizada?.statusEntrega).toBe('server_ack');

    // ...depois DELIVERY_ACK (3) - confirma progresso de verdade no aparelho do destinatario.
    await updateHandler([
      { key: { id: 'BAILEYS-ID-ENVIO-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: true }, update: { status: 3 } },
    ]);
    atualizada = await prisma.whatsAppMessage.findUnique({ where: { id: recemEnviada!.id } });
    expect(atualizada?.statusEntrega).toBe('delivery_ack');

    // I4: count > 0 (achou e atualizou a mensagem) loga sucesso via .log,
    // nunca .warn - confirma que o achado I4 nao introduziu falso-negativo
    // no caminho feliz.
    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('[ACK] Mensagem BAILEYS-ID-ENVIO-1')),
    ).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();

    // I5: o log de debug removido nao deve mais aparecer em nenhuma chamada
    // a .log durante todo o fluxo acima (envio + 2 ACKs).
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('[DEBUG-ACK-RAW]'))).toBe(false);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('evento sem key.id ou sem update.status (ex: edicao de mensagem) e ignorado sem lancar erro', async () => {
    const handlers = (baileysMock as any).__handlers;
    const updateHandler = handlers['messages.update'];

    await expect(
      updateHandler([{ key: { id: undefined, fromMe: true }, update: { message: {} } }]),
    ).resolves.not.toThrow();
  });

  it('baileysMessageId desconhecido (nenhuma mensagem correspondente): updateMany nao afeta nada, loga warning (I4) em vez de sucesso falso, nao lanca erro', async () => {
    const handlers = (baileysMock as any).__handlers;
    const updateHandler = handlers['messages.update'];
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    await expect(
      updateHandler([
        { key: { id: 'ID-QUE-NAO-EXISTE', fromMe: true }, update: { status: 2 } },
      ]),
    ).resolves.not.toThrow();

    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('Nenhuma mensagem encontrada para baileysMessageId=ID-QUE-NAO-EXISTE'),
      ),
    ).toBe(true);
    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('[ACK] Mensagem ID-QUE-NAO-EXISTE')),
    ).toBe(false);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
