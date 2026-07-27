// Auditoria de seguranca/integridade (achado C2, 27/07/2026): mensagens
// concorrentes do mesmo lead (ex: "oi" seguido segundos depois de "confirmando
// a visita amanha 15h") podem disparar processamento paralelo do fluxo
// "buscar-ou-criar" do Atendimento - sem protecao de banco, cada execucao
// concorrente criava seu proprio Atendimento duplicado. Integracao (banco
// real, crm_core_db_test - ver jest.setup.ts) porque o que importa aqui e a
// CONCORRENCIA REAL contra o indice unico parcial
// "atendimentos_active_session_remote_jid_key" (ver schema.prisma) - um
// repositorio mockado nao provaria que a corrida e resolvida no banco de
// verdade. Usa PrismaAtendimentoRepository/PrismaFilaRepository/
// PrismaAtendimentoEventoRepository reais, sem mock nenhum.
import { PrismaService } from '../../../../config/prisma.service';
import { PrismaAtendimentoRepository } from '../../infra/database/prisma-atendimento.repository';
import { PrismaFilaRepository } from '../../infra/database/prisma-fila.repository';
import { PrismaAtendimentoEventoRepository } from '../../infra/database/prisma-atendimento-evento.repository';
import { GetOrCreateAtendimentoUseCase } from './get-or-create-atendimento.use-case';

describe('GetOrCreateAtendimentoUseCase - corrida entre mensagens concorrentes (integracao)', () => {
  let prisma: PrismaService;
  let atendimentoRepository: PrismaAtendimentoRepository;
  let useCase: GetOrCreateAtendimentoUseCase;
  let tenantId: string;
  let sessionId: string;
  const remoteJid = '5511988887777@s.whatsapp.net';
  const phoneNumber = '5511988887777';

  beforeAll(async () => {
    prisma = new PrismaService();
    atendimentoRepository = new PrismaAtendimentoRepository(prisma);
    const filaRepository = new PrismaFilaRepository(prisma);
    const eventoRepository = new PrismaAtendimentoEventoRepository(prisma);
    useCase = new GetOrCreateAtendimentoUseCase(atendimentoRepository, filaRepository, eventoRepository);

    const tenant = await prisma.tenant.create({ data: { name: 'Tenant Teste Corrida Atendimento' } });
    tenantId = tenant.id;
    const session = await prisma.whatsAppSession.create({
      data: { tenantId, label: 'WhatsApp Teste Corrida', status: 'CONNECTED', phoneNumber: '5511966111740' },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await prisma.atendimentoEvento.deleteMany({ where: { atendimento: { tenantId } } });
    await prisma.atendimento.deleteMany({ where: { tenantId } });
    await prisma.filaUsuario.deleteMany({});
    await prisma.fila.deleteMany({ where: { tenantId } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }, 30000);

  it('CENARIO OBRIGATORIO: duas mensagens do mesmo lead chegando concorrentemente (Promise.all, nao sequencial) resultam em UM UNICO Atendimento, nunca em erro ou perda', async () => {
    // Simula "oi" e "confirmando a visita amanha 15h" chegando quase juntas -
    // as duas disparam GetOrCreateAtendimentoUseCase.execute() ANTES de
    // qualquer uma terminar (Promise.all, nao await sequencial).
    const [resultadoMensagem1, resultadoMensagem2] = await Promise.all([
      useCase.execute({ tenantId, sessionId, remoteJid, phoneNumber }),
      useCase.execute({ tenantId, sessionId, remoteJid, phoneNumber }),
    ]);

    // Nenhuma das duas mensagens foi perdida/descartada - ambas retornaram
    // um Atendimento valido, e e o MESMO registro (nao dois duplicados).
    expect(resultadoMensagem1.id).toBe(resultadoMensagem2.id);

    const total = await prisma.atendimento.count({ where: { tenantId, whatsappSessionId: sessionId, remoteJid } });
    expect(total).toBe(1);

    const eventos = await prisma.atendimentoEvento.findMany({ where: { atendimentoId: resultadoMensagem1.id } });
    // Exatamente 1 evento "criado" (nao 2) - confirma que so uma das duas
    // chamadas concorrentes realmente inseriu a linha; a outra reaproveitou
    // via UniqueConstraintViolationError + refetch, sem gravar um segundo
    // evento "criado".
    expect(eventos.filter((e) => e.tipo === 'criado')).toHaveLength(1);
  });

  it('caminho normal (sem concorrencia): mensagens sequenciais do mesmo lead reaproveitam o mesmo Atendimento aberto, sem regressao', async () => {
    const outroRemoteJid = '5511977776666@s.whatsapp.net';
    const outroPhone = '5511977776666';

    const primeira = await useCase.execute({ tenantId, sessionId, remoteJid: outroRemoteJid, phoneNumber: outroPhone });
    const segunda = await useCase.execute({ tenantId, sessionId, remoteJid: outroRemoteJid, phoneNumber: outroPhone });

    expect(segunda.id).toBe(primeira.id);

    const total = await prisma.atendimento.count({
      where: { tenantId, whatsappSessionId: sessionId, remoteJid: outroRemoteJid },
    });
    expect(total).toBe(1);
  });
});
