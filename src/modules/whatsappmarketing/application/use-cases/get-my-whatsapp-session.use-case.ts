// src/modules/whatsappmarketing/application/use-cases/get-my-whatsapp-session.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

@Injectable()
export class GetMyWhatsAppSessionUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: { tenantId: string }): Promise<WhatsAppSessionRecord | null> {
    const session = await this.sessionRepository.findMostRecentByTenant(input.tenantId);
    if (!session) return null;

    // Mesma logica de "RECONNECTING" so-de-resposta do
    // GetWhatsAppSessionStatusUseCase - ver comentario la.
    if (session.status === 'CONNECTED' && !this.whatsAppProvider.isConnected(session.id)) {
      return { ...session, status: 'RECONNECTING' };
    }

    return session;
  }
}
