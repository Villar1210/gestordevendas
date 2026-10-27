// src/modules/edoc/application/use-cases/get-envelope-stats.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { filtroCriadorEnvelope } from '../../domain/services/acesso-envelope';
import { ISignatureEnvelopeRepository, EnvelopeStats } from '../../domain/repositories/signature-envelope-repository.interface';

interface GetEnvelopeStatsInput {
  tenantId: string;
  // Quem pediu (rota HTTP). Ausente = chamada interna (ex.: RH gerando o
  // contrato do corretor) - sem filtro. Ver domain/services/acesso-envelope.ts.
  requesterRole?: string;
  requesterUserId?: string;
}

@Injectable()
export class GetEnvelopeStatsUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: GetEnvelopeStatsInput): Promise<EnvelopeStats> {
    const createdByUserId =
      input.requesterRole && input.requesterUserId
        ? filtroCriadorEnvelope(input.requesterRole, input.requesterUserId) ?? undefined
        : undefined;
    return this.envelopeRepository.countByTenantGroupedByStatus(input.tenantId, createdByUserId);
  }
}
