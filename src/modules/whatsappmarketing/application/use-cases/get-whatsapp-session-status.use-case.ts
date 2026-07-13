// src/modules/whatsappmarketing/application/use-cases/get-whatsapp-session-status.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

interface GetWhatsAppSessionStatusInput {
  sessionId: string;
  tenantId: string;
}

@Injectable()
export class GetWhatsAppSessionStatusUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: GetWhatsAppSessionStatusInput): Promise<WhatsAppSessionRecord> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    // "RECONNECTING" e um valor SO DE RESPOSTA, nunca gravado no banco -
    // o banco continua CONNECTED ate o Baileys emitir 'open' ou 'close' de
    // verdade. Cobre o caso do processo ter sido reiniciado (restart/deploy)
    // e a reconexao automatica (onModuleInit) ainda nao ter terminado.
    if (session.status === 'CONNECTED' && !this.whatsAppProvider.isConnected(session.id)) {
      return { ...session, status: 'RECONNECTING' };
    }

    return session;
  }
}
