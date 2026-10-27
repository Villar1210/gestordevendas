// src/modules/edoc/application/use-cases/list-envelopes.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { filtroCriadorEnvelope } from '../../domain/services/acesso-envelope';
import { ISignatureEnvelopeRepository, SignatureEnvelopeWithCount } from '../../domain/repositories/signature-envelope-repository.interface';

interface ListEnvelopesInput {
  tenantId: string;
  // Filtros opcionais (Fatia 4) - sem eles, lista tudo do tenant como antes.
  status?: string;
  search?: string;
  // Quem pediu (rota HTTP). Ausente = chamada interna (ex.: RH gerando o
  // contrato do corretor) - sem filtro. Ver domain/services/acesso-envelope.ts.
  requesterRole?: string;
  requesterUserId?: string;
}

@Injectable()
export class ListEnvelopesUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: ListEnvelopesInput): Promise<SignatureEnvelopeWithCount[]> {
    const createdByUserId =
      input.requesterRole && input.requesterUserId
        ? filtroCriadorEnvelope(input.requesterRole, input.requesterUserId) ?? undefined
        : undefined;
    return this.envelopeRepository.findAllByTenant(input.tenantId, {
      status: input.status,
      search: input.search,
      createdByUserId,
    });
  }
}
