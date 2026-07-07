// src/modules/whatsappmarketing/application/use-cases/get-my-whatsapp-session.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';

@Injectable()
export class GetMyWhatsAppSessionUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
  ) {}

  async execute(input: { tenantId: string }): Promise<WhatsAppSessionRecord | null> {
    return this.sessionRepository.findMostRecentByTenant(input.tenantId);
  }
}
