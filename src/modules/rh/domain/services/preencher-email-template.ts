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
  // Endereco de login da plataforma (so aprovacao) - ver aprovar-cadastro.
  linkAcesso?: string;
}

const PLACEHOLDERS: Record<keyof DadosEmailTemplate, string> = {
  nome: '{{NOME}}',
  email: '{{EMAIL}}',
  empresa: '{{EMPRESA}}',
  senhaTemporaria: '{{SENHA_TEMPORARIA}}',
  cargo: '{{CARGO}}',
  perfil: '{{PERFIL}}',
  linkAcesso: '{{LINK_ACESSO}}',
};

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// opcoes.html: escapa os valores antes de inserir - usar SEMPRE no corpo
// (HTML). O nome, por exemplo, vem do cadastro publico, digitado por
// qualquer pessoa; sem escapar, um "<a href=...>" no nome viraria link
// dentro do e-mail oficial da empresa. O assunto e texto puro: nao escapa.
export function preencherEmailTemplate(
  texto: string,
  dados: DadosEmailTemplate,
  opcoes: { html?: boolean } = {},
): string {
  let resultado = texto;
  for (const chave of Object.keys(PLACEHOLDERS) as (keyof DadosEmailTemplate)[]) {
    const valor = dados[chave] ?? '';
    resultado = resultado.split(PLACEHOLDERS[chave]).join(opcoes.html ? escaparHtml(valor) : valor);
  }
  return resultado;
}

// Botao "Acessar a plataforma" (e-mail de aprovacao). Acrescentado ao fim do
// corpo quando o template do tenant nao usa {{LINK_ACESSO}} - assim templates
// ja personalizados antes desta mudanca tambem ganham o link.
export function botaoAcessoHtml(link: string): string {
  const href = escaparHtml(link);
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:10px;">Acessar a plataforma</a></p><p style="margin:0;font-size:13px;color:#64748b;">Ou copie este endereço no navegador: ${href}</p>`;
}
