// src/modules/edoc/domain/services/envelope-validation.ts
// Camada de DOMINIO: funcoes puras, sem Prisma/Nest/infra - regras de
// negocio compartilhadas por CreateEnvelopeUseCase e
// UpdateEnvelopeDraftUseCase (Fatia 4), para nao duplicar a mesma
// validacao/montagem de destinatarios em dois lugares. Retorna uma
// mensagem de erro (string) em vez de lancar excecao HTTP - quem chama
// (camada de aplicacao) decide o tipo de excecao a lancar.

export interface RecipientInputLike {
  name: string;
  email: string;
  role?: string;
}

export interface FieldInputLike {
  recipientIndex: number;
  tipo?: string;
}

const DEFAULT_ROLE = 'destinatario';
const DEFAULT_FIELD_TIPO = 'assinatura';

export const DEFAULT_EMAIL_SUBJECT = 'Por favor, assine este documento — Gestor de Vendas';

export function validateRecipientsAndFields(
  recipients: RecipientInputLike[],
  fields: FieldInputLike[],
): string | null {
  if (!recipients || recipients.length === 0) {
    return 'Informe pelo menos um destinatario.';
  }

  // Cada destinatario precisa de pelo menos 1 campo posicionado - sem
  // isso o GenerateSignedPdfUseCase nao saberia onde carimbar a assinatura.
  const fieldsByRecipientIndex = new Map<number, FieldInputLike[]>();
  for (const field of fields ?? []) {
    if (field.recipientIndex < 0 || field.recipientIndex >= recipients.length) {
      return 'Campo de assinatura aponta para um destinatario invalido.';
    }
    const list = fieldsByRecipientIndex.get(field.recipientIndex) ?? [];
    list.push(field);
    fieldsByRecipientIndex.set(field.recipientIndex, list);
  }
  for (let i = 0; i < recipients.length; i++) {
    if (!fieldsByRecipientIndex.get(i)?.length) {
      return `Posicione o campo de assinatura de "${recipients[i].name}" no documento.`;
    }
  }

  // Testemunha so assina na ultima pagina - nao rubrica o documento (ver
  // CLAUDE.md, regra do campo).
  for (const field of fields ?? []) {
    const role = recipients[field.recipientIndex].role ?? DEFAULT_ROLE;
    const tipo = field.tipo ?? DEFAULT_FIELD_TIPO;
    if (role === 'testemunha' && tipo === 'rubrica') {
      return `"${recipients[field.recipientIndex].name}" e testemunha e nao pode ter campo de rubrica.`;
    }
  }

  return null;
}

// Ordem sequencial DENTRO DO PROPRIO GRUPO de role (Fatia 3) - nao uma
// ordem global entre todos os participantes do envelope (ver
// recipient-sequence.ts, que combina isso com o grupo para decidir quem
// assina primeiro).
export function buildRecipientsWithGroupOrder(
  recipients: RecipientInputLike[],
): { name: string; email: string; role: string; order: number }[] {
  const orderWithinRole = new Map<string, number>();
  return recipients.map((recipient) => {
    const role = recipient.role ?? DEFAULT_ROLE;
    const nextOrder = (orderWithinRole.get(role) ?? 0) + 1;
    orderWithinRole.set(role, nextOrder);
    return { name: recipient.name, email: recipient.email, role, order: nextOrder };
  });
}
