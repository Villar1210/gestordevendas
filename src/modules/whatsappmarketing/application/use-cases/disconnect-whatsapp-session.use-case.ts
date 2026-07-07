// src/modules/whatsappmarketing/application/use-cases/disconnect-whatsapp-session.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

interface DisconnectWhatsAppSessionInput {
  sessionId: string;
  tenantId: string;
}

@Injectable()
export class DisconnectWhatsAppSessionUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: DisconnectWhatsAppSessionInput): Promise<void> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    // Soft delete (decisao confirmada): encerra a conexao e apaga as
    // credenciais em disco, mas preserva a linha e o historico de mensagens.
    await this.whatsAppProvider.disconnect(session.id);
    await this.sessionRepository.updateStatus(session.id, 'DISCONNECTED');
  }
}
