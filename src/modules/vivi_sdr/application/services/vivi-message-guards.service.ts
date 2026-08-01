// src/modules/vivi_sdr/application/services/vivi-message-guards.service.ts
// Extraido de ProcessIncomingMessageUseCase (I10 da auditoria, refactor
// estrutural puro - comportamento inalterado). Guardas de entrada que
// dependem de I/O (ICardRepository) - a guarda puramente de status da
// conversa (Guarda 1) fica em domain/services/vivi-conversation-guard.ts,
// sem I/O.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';
import { ehPedidoDeOptOut } from '../../../vendas_kanban/domain/services/repique-optout-detector';

interface TratarOptOutInput {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  messageBody: string;
  remoteJid: string | null;
}

@Injectable()
export class ViviMessageGuardsService {
  private readonly logger = new Logger(ViviMessageGuardsService.name);

  constructor(
    @Inject('ICardRepository')
    private readonly cardRepository: ICardRepository,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
  ) {}

  // Guarda 2: se existe um Card com corretor responsavel (ownerId
  // preenchido) para este numero no Kanban (criado manualmente ou pela
  // propria VIVI em sessao anterior), a VIVI tambem nao deve responder.
  async temCardComDono(tenantId: string, phoneNumber: string): Promise<boolean> {
    return this.cardRepository.existsByTenantAndPhoneWithOwner(tenantId, phoneNumber);
  }

  // Guarda 3: pedido de descadastro (opt-out, LGPD) de uma campanha de
  // Repique ativa - verificado ANTES de qualquer outro fluxo da VIVI (nem
  // chama a IA). So se aplica a numeros com card ATIVO na stage "Repique" e
  // ainda nao descadastrado - mensagens de leads em qualificacao normal nao
  // passam por aqui. Deteccao por palavra-chave (nao pela IA) de proposito -
  // decisao de compliance precisa ser deterministica, ver
  // domain/services/repique-optout-detector.ts. Retorna true se o opt-out
  // foi tratado (o chamador deve parar o processamento nesse caso).
  async tratarOptOutDeRepique(input: TratarOptOutInput): Promise<boolean> {
    const repiqueCard = await this.cardRepository.findRepiqueCardByTenantAndPhone(
      input.tenantId,
      input.phoneNumber,
    );
    if (!repiqueCard || repiqueCard.repiqueOptOut || !ehPedidoDeOptOut(input.messageBody)) {
      return false;
    }

    await this.cardRepository.markRepiqueOptOut(repiqueCard.id);
    this.logger.log(
      `[VIVI] Opt-out de campanha de Repique confirmado para ${input.phoneNumber} (card ${repiqueCard.id}).`,
    );
    await this.sendWhatsAppMessageUseCase.execute({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      to: input.remoteJid ?? input.phoneNumber,
      phoneNumber: input.phoneNumber,
      body: 'Combinado! Você não vai mais receber nossas mensagens de remarketing. Se mudar de ideia, é só chamar por aqui.',
      simularDigitando: true,
    });
    return true;
  }
}
