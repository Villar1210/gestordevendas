// src/modules/portal_cliente/application/use-cases/get-minhas-assinaturas-pendentes.use-case.ts
// Vinculo por E-MAIL (nao por FK formal) - ver CLAUDE.md, secao Portal do
// Cliente, sobre a limitacao dessa correspondencia.
import { Injectable, Inject } from '@nestjs/common';
import { ISignatureRecipientRepository } from '../../../edoc/domain/repositories/signature-recipient-repository.interface';

interface GetMinhasAssinaturasPendentesInput {
  tenantId: string;
  email: string;
}

export interface AssinaturaPendenteResult {
  envelopeId: string;
  envelopeTitle: string;
  accessToken: string;
}

@Injectable()
export class GetMinhasAssinaturasPendentesUseCase {
  constructor(
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
  ) {}

  async execute(input: GetMinhasAssinaturasPendentesInput): Promise<AssinaturaPendenteResult[]> {
    const rows = await this.recipientRepository.findAllByEmailAndTenant(
      input.tenantId,
      input.email,
    );

    return rows
      .filter((row) => row.status === 'pendente' && row.envelopeStatus === 'aguardando_assinaturas')
      .filter((row): row is typeof row & { accessToken: string } => row.accessToken !== null)
      .map((row) => ({
        envelopeId: row.envelopeId,
        envelopeTitle: row.envelopeTitle,
        accessToken: row.accessToken,
      }));
  }
}
