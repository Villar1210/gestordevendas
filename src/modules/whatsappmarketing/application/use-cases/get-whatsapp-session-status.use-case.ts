// src/modules/whatsappmarketing/application/use-cases/get-whatsapp-session-status.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';

interface GetWhatsAppSessionStatusInput {
  sessionId: string;
  tenantId: string;
}

@Injectable()
export class GetWhatsAppSessionStatusUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
  ) {}

  async execute(input: GetWhatsAppSessionStatusInput): Promise<WhatsAppSessionRecord> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    return session;
  }
}
