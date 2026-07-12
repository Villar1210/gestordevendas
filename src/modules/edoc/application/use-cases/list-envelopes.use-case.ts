// src/modules/edoc/application/use-cases/list-envelopes.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { ISignatureEnvelopeRepository, SignatureEnvelopeWithCount } from '../../domain/repositories/signature-envelope-repository.interface';

interface ListEnvelopesInput {
  tenantId: string;
  // Filtros opcionais (Fatia 4) - sem eles, lista tudo do tenant como antes.
  status?: string;
  search?: string;
}

@Injectable()
export class ListEnvelopesUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: ListEnvelopesInput): Promise<SignatureEnvelopeWithCount[]> {
    return this.envelopeRepository.findAllByTenant(input.tenantId, {
      status: input.status,
      search: input.search,
    });
  }
}
