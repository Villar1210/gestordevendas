// src/modules/vivi_sdr/application/use-cases/enable-vivi-on-session.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';

interface EnableViviOnSessionInput {
  sessionId: string;
  tenantId: string;
}

@Injectable()
export class EnableViviOnSessionUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
  ) {}

  async execute(input: EnableViviOnSessionInput): Promise<void> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    await this.sessionRepository.updateAiEnabled(session.id, true);
  }
}
