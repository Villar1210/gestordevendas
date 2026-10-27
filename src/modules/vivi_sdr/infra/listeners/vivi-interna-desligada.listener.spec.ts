// Decisao de 27/10/2026: a VIVI interna foi desligada (so a do fazer.ai
// atende). Mesmo uma sessao antiga com isAiEnabled=true nao chama mais a IA.
import { WhatsAppMessageReceivedListener } from './whatsapp-message-received.listener';
import { SocialMessageReceivedListener } from './social-message-received.listener';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { ProcessIncomingMessageUseCase } from '../../application/use-cases/process-incoming-message.use-case';
import { ProcessIncomingSocialMessageUseCase } from '../../application/use-cases/process-incoming-social-message.use-case';
import { GetOrCreateAtendimentoUseCase } from '../../../atendimento/application/use-cases/get-or-create-atendimento.use-case';
import { VIVI_INTERNA_ATIVA } from '../../constants/vivi-interna';

describe('VIVI interna desligada', () => {
  it('a chave esta desligada no codigo', () => {
    expect(VIVI_INTERNA_ATIVA).toBe(false);
  });

  it('WhatsApp de sessao com isAiEnabled=true vai para a Central de Atendimento, nunca para a IA', async () => {
    const processar = { execute: jest.fn() };
    const atendimento = { execute: jest.fn() };
    const listener = new WhatsAppMessageReceivedListener(
      { findById: jest.fn().mockResolvedValue({ id: 's-1', isAiEnabled: true }) } as unknown as IWhatsAppSessionRepository,
      processar as unknown as ProcessIncomingMessageUseCase,
      atendimento as unknown as GetOrCreateAtendimentoUseCase,
    );

    await listener.handle({ tenantId: 't-1', sessionId: 's-1', phoneNumber: '5511', remoteJid: '5511@s.whatsapp.net', messageBody: 'oi' });

    expect(processar.execute).not.toHaveBeenCalled();
    expect(atendimento.execute).toHaveBeenCalled();
  });

  it('DM de Instagram/Facebook nao chama a IA', async () => {
    const processar = { execute: jest.fn() };
    const listener = new SocialMessageReceivedListener(processar as unknown as ProcessIncomingSocialMessageUseCase);

    await listener.handle({ tenantId: 't-1', canal: Canal.INSTAGRAM, contaId: 'c-1', identificadorExterno: 'x', conteudo: 'oi' } as never);

    expect(processar.execute).not.toHaveBeenCalled();
  });
});
