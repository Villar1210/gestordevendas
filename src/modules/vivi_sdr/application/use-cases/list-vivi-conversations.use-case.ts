// src/modules/vivi_sdr/application/use-cases/list-vivi-conversations.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IViviConversationRepository,
  ViviConversationRecord,
} from '../../domain/repositories/vivi-conversation-repository.interface';

@Injectable()
export class ListViviConversationsUseCase {
  constructor(
    @Inject('IViviConversationRepository')
    private readonly viviConversationRepository: IViviConversationRepository,
  ) {}

  async execute(tenantId: string): Promise<ViviConversationRecord[]> {
    return this.viviConversationRepository.findAllByTenant(tenantId);
  }
}
