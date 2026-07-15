// src/modules/rh/domain/services/preencher-email-template.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS. Troca os placeholders
// {{...}} do assunto/corpo do EmailTemplate pelos dados reais - aplicada
// tanto no assunto quanto no corpo (o assunto tambem pode usar {{EMPRESA}}
// etc). Campos opcionais (senhaTemporaria/cargo/perfil) so fazem sentido
// para alguns tipos de template - viram string vazia quando ausentes.
export interface DadosEmailTemplate {
  nome: string;
  email: string;
  empresa: string;
  senhaTemporaria?: string;
  cargo?: string;
  perfil?: string;
}

const PLACEHOLDERS: Record<keyof DadosEmailTemplate, string> = {
  nome: '{{NOME}}',
  email: '{{EMAIL}}',
  empresa: '{{EMPRESA}}',
  senhaTemporaria: '{{SENHA_TEMPORARIA}}',
  cargo: '{{CARGO}}',
  perfil: '{{PERFIL}}',
};

export function preencherEmailTemplate(texto: string, dados: DadosEmailTemplate): string {
  let resultado = texto;
  for (const chave of Object.keys(PLACEHOLDERS) as (keyof DadosEmailTemplate)[]) {
    resultado = resultado.split(PLACEHOLDERS[chave]).join(dados[chave] ?? '');
  }
  return resultado;
}
