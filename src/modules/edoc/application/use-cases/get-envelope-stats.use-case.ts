// src/modules/edoc/application/use-cases/get-envelope-stats.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { ISignatureEnvelopeRepository, EnvelopeStats } from '../../domain/repositories/signature-envelope-repository.interface';

interface GetEnvelopeStatsInput {
  tenantId: string;
}

@Injectable()
export class GetEnvelopeStatsUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: GetEnvelopeStatsInput): Promise<EnvelopeStats> {
    return this.envelopeRepository.countByTenantGroupedByStatus(input.tenantId);
  }
}
