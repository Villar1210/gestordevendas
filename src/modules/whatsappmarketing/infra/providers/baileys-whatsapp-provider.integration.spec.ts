// Corrige bug real confirmado em producao (25/07/2026): resposta da VIVI a
// um contato @lid gravava WhatsAppMessage.toNumber com os digitos do LID em
// vez do numero real - findRecentBySessionAndNumber (historico passado a
// IA) nunca encontrava as proprias respostas da VIVI nessas conversas.
// Integracao (banco real, crm_core_db_test - ver jest.setup.ts): o que
// importa aqui e a PERSISTENCIA/CONSULTA real, nao a logica em isolado - um
// repositorio mockado nao provaria que findRecentBySessionAndNumber volta a
// funcionar. O socket do Baileys em si e fake (nao abre conexao real) -
// sockets e um Map em memoria, plenamente testavel sem WhatsApp de verdade.
// "baileys" e um pacote ESM puro que o transform padrao do Jest nao
// consegue fazer parse (mesmo problema ja documentado nos specs de
// integracao anteriores, ver escalonar-cards-sem-dono.use-case.integration.spec.ts) -
// so que aqui e o proprio arquivo sob teste que o importa no topo, entao
// nao da pra evitar bootstrapando algo diferente. Mock completo do modulo:
// sendMessage() (o unico metodo exercitado por este teste) nunca chama
// nenhum destes simbolos - so precisam existir para o import no topo do
// arquivo real nao quebrar.
jest.mock('baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest.fn(),
  fetchLatestBaileysVersion: jest.fn(),
  getContentType: jest.fn(),
  DisconnectReason: {},
}));

import { PrismaService } from '../../../../config/prisma.service';
import { PrismaWhatsAppSessionRepository } from '../database/prisma-whatsapp-session.repository';
import { PrismaWhatsAppMessageRepository } from '../database/prisma-whatsapp-message.repository';
import { BaileysWhatsAppProvider } from './baileys-whatsapp-provider';

describe('BaileysWhatsAppProvider.sendMessage - toNumber correto para contatos @lid (integracao)', () => {
  let prisma: PrismaService;
  let sessionRepository: PrismaWhatsAppSessionRepository;
  let messageRepository: PrismaWhatsAppMessageRepository;
  let provider: BaileysWhatsAppProvider;
  let tenantId: string;
  let sessionId: string;
  const fakeSock = { sendMessage: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    prisma = new PrismaService();
    sessionRepository = new PrismaWhatsAppSessionRepository(prisma);
    messageRepository = new PrismaWhatsAppMessageRepository(prisma);
    // eventEmitter nao e usado por sendMessage() - stub vazio basta.
    provider = new BaileysWhatsAppProvider(sessionRepository, messageRepository, {} as any);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste WhatsApp toNumber' } });
    tenantId = tenant.id;
    const session = await prisma.whatsAppSession.create({
      data: { tenantId, label: 'WhatsApp Teste', status: 'CONNECTED', phoneNumber: '5511966111740' },
    });
    sessionId = session.id;

    // Injeta um socket FAKE diretamente no Map privado (acessivel em
    // runtime, TS "private" nao existe mais depois de compilado) - evita
    // qualquer conexao real com o WhatsApp/Baileys neste teste.
    (provider as any).sockets.set(sessionId, fakeSock);
  });

  afterAll(async () => {
    await prisma.whatsAppMessage.deleteMany({ where: { tenantId } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('CENARIO PRINCIPAL: com phoneNumber informado, grava o numero REAL em toNumber (nao os digitos do LID)', async () => {
    const remoteJidLid = '99961119199259@lid';
    const numeroReal = '5511966111111';

    await provider.sendMessage(sessionId, remoteJidLid, 'Oi! Como posso ajudar?', numeroReal);

    // O ENVIO em si deve ter usado o JID @lid original, intocado - nunca o
    // numero derivado.
    expect(fakeSock.sendMessage).toHaveBeenCalledWith(remoteJidLid, { text: 'Oi! Como posso ajudar?' });

    const salvo = await prisma.whatsAppMessage.findFirst({
      where: { sessionId, direction: 'OUT', body: 'Oi! Como posso ajudar?' },
    });
    expect(salvo?.toNumber).toBe(numeroReal);
    expect(salvo?.toNumber).not.toBe('99961119199259');
  });

  it('HISTORICO: findRecentBySessionAndNumber agora ENCONTRA a resposta da VIVI para esse contato @lid', async () => {
    const remoteJidLid = '99961119199259@lid';
    const numeroReal = '5511966111111';

    // Simula o lado IN da mesma conversa (fromNumber ja resolvido pela
    // correcao de leitura de hoje) + a resposta OUT que acabou de ser
    // gravada no teste anterior.
    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        sessionId,
        direction: 'IN',
        fromNumber: numeroReal,
        toNumber: '5511966111740',
        remoteJid: remoteJidLid,
        body: 'Oi, tenho interesse',
        timestamp: new Date(Date.now() - 5000),
      },
    });

    const historico = await messageRepository.findRecentBySessionAndNumber(sessionId, numeroReal, 10);

    expect(historico.some((m) => m.direction === 'OUT' && m.body === 'Oi! Como posso ajudar?')).toBe(true);
    expect(historico.some((m) => m.direction === 'IN' && m.body === 'Oi, tenho interesse')).toBe(true);
  });

  it('NAO-REGRESSAO: SEM phoneNumber informado, mantem o comportamento antigo (extrai digitos do "to") - envio manual/Repique continuam identicos', async () => {
    const numeroDigitado = '5511977778888'; // envio manual: "to" ja e so digitos, sem @lid envolvido
    const jid = `${numeroDigitado}@s.whatsapp.net`;

    await provider.sendMessage(sessionId, jid, 'Mensagem via formulario manual');

    const salvo = await prisma.whatsAppMessage.findFirst({
      where: { sessionId, direction: 'OUT', body: 'Mensagem via formulario manual' },
    });
    expect(salvo?.toNumber).toBe(numeroDigitado);
  });
});
