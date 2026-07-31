// src/modules/vendas_kanban/application/use-cases/update-card.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

interface UpdateCardInput {
  cardId: string;
  tenantId: string;
  requesterRole: string;
  requesterCargo: string | null;
  title?: string;
  value?: number;
  phone?: string | null;
  temperatura?: string | null;
  email?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  imovelId?: string | null;
  customFields?: Record<string, unknown>;
}

@Injectable()
export class UpdateCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
  ) {}

  async execute(input: UpdateCardInput): Promise<CardRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    const pipeline = await this.pipelineRepository.findByIdAndTenant(card.pipelineId, input.tenantId);
    if (
      pipeline?.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    return this.cardRepository.update(card.id, {
      title: input.title,
      value: input.value,
      phone: input.phone,
      temperatura: input.temperatura,
      email: input.email,
      endereco: input.endereco,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      imovelId: input.imovelId,
      customFields: input.customFields,
    });
  }
}
