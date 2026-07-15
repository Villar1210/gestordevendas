// src/modules/rh/domain/services/email-template-tipos.ts
// Camada de DOMINIO: fonte unica de verdade dos tipos de e-mail
// customizaveis (Fatia 4 do Painel Administrativo). Cada tipo corresponde
// a exatamente 1 ponto de envio no fluxo de RH.
export const EMAIL_TEMPLATE_TIPOS = [
  'boas_vindas_corretor',
  'rejeicao_cadastro',
  'aprovacao_cadastro',
] as const;

export type EmailTemplateTipo = (typeof EMAIL_TEMPLATE_TIPOS)[number];

export function isValidEmailTemplateTipo(tipo: string): tipo is EmailTemplateTipo {
  return (EMAIL_TEMPLATE_TIPOS as readonly string[]).includes(tipo);
}
