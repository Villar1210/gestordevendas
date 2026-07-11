// src/modules/edoc/domain/services/recipient-sequence.ts
// Camada de DOMINIO: funcao pura, sem Prisma/infra - regra de negocio da
// Fatia 3 (papeis de participante). Todos os Destinatarios assinam
// primeiro, depois todos os Remetentes, depois todas as Testemunhas;
// dentro de cada grupo, a ordem e dada por SignatureRecipient.order
// (ordem DENTRO DO PROPRIO GRUPO, nao mais uma ordem global - ver
// schema.prisma). SendEnvelopeUseCase e SignDocumentUseCase usam isso
// para saber quem recebe o e-mail primeiro/em seguida.
import { SignatureRecipientRecord } from '../repositories/signature-recipient-repository.interface';

const ROLE_GROUP_RANK: Record<string, number> = {
  destinatario: 1,
  remetente: 2,
  testemunha: 3,
};

export function sortBySignatureSequence(
  recipients: SignatureRecipientRecord[],
): SignatureRecipientRecord[] {
  return [...recipients].sort((a, b) => {
    const groupDiff = (ROLE_GROUP_RANK[a.role] ?? 99) - (ROLE_GROUP_RANK[b.role] ?? 99);
    if (groupDiff !== 0) return groupDiff;
    return a.order - b.order;
  });
}
