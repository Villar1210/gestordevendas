// src/modules/whatsappmarketing/application/use-cases/create-whatsapp-session.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IWhatsAppSessionRepository,
  WhatsAppSessionRecord,
} from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

interface CreateWhatsAppSessionInput {
  tenantId: string;
  ownerUserId?: string;
  label: string;
}

@Injectable()
export class CreateWhatsAppSessionUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: CreateWhatsAppSessionInput): Promise<WhatsAppSessionRecord> {
    const session = await this.sessionRepository.create({
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId ?? null,
      label: input.label,
    });

    await this.whatsAppProvider.createSession(session.id);

    return session;
  }
}
