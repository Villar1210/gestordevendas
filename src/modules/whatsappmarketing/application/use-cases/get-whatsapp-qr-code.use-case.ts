// src/modules/whatsappmarketing/application/use-cases/get-whatsapp-qr-code.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

interface GetWhatsAppQrCodeInput {
  sessionId: string;
  tenantId: string;
}

@Injectable()
export class GetWhatsAppQrCodeUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: GetWhatsAppQrCodeInput): Promise<{ qr: string | null }> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    const qr = await this.whatsAppProvider.getQrCode(session.id);
    return { qr };
  }
}
