// src/features/configuracoes/constants.ts
// Espelha domain/services/preencher-contrato-template.ts (backend) - lista
// dos placeholders aceitos hoje no corpo do ContratoTemplate, exibida no
// editor (aba "Template de Contrato" do Painel de Configuracao, hoje uma
// aba de /dashboard/rh/aprovacoes) para o Administrador clicar e inserir
// na posicao do cursor.
export const CONTRATO_TEMPLATE_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{NOME_TENANT}}", label: "Razao social da empresa (CONTRATANTE)" },
  { token: "{{CNPJ_TENANT}}", label: "CNPJ da empresa" },
  { token: "{{ENDERECO_TENANT}}", label: "Endereco da empresa" },
  { token: "{{NOME}}", label: "Nome do corretor/parceiro (CONTRATADO)" },
  { token: "{{CPF}}", label: "CPF do corretor/parceiro" },
  { token: "{{CRECI}}", label: "CRECI (ou CNPJ, se pessoa juridica)" },
  { token: "{{ENDERECO}}", label: "Endereco do corretor/parceiro" },
  { token: "{{CEP}}", label: "CEP do corretor/parceiro" },
  { token: "{{DATA_ATUAL}}", label: "Data de hoje" },
];

// Espelha domain/services/contrato-template-padrao.ts (backend) - usado
// pelo botao "Restaurar Padrao" (so preenche o formulario, nao salva
// sozinho). Projetos separados, sem compartilhamento de codigo - mesmo
// padrao ja usado para DEFAULT_EMAIL_SUBJECT em features/edoc/constants.ts.
export const DEFAULT_CONTRATO_TEMPLATE_NOME =
  "Contrato de Prestação de Serviços de Corretagem Imobiliária (Padrão)";

export const DEFAULT_CONTRATO_TEMPLATE_CORPO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CORRETAGEM IMOBILIÁRIA

CONTRATANTE: {{NOME_TENANT}}, CNPJ nº {{CNPJ_TENANT}}, com sede em {{ENDERECO_TENANT}}.

CONTRATADO(A): {{NOME}}, CPF nº {{CPF}}, CRECI nº {{CRECI}}, residente e domiciliado(a) em {{ENDERECO}}, CEP {{CEP}}.

CLÁUSULA 1ª – DO OBJETO
O presente contrato tem por objeto a prestação de serviços de corretagem imobiliária pelo(a) CONTRATADO(A) em favor do CONTRATANTE, atuando na intermediação de negócios imobiliários (venda e locação de imóveis) sob a marca e estrutura do CONTRATANTE.

CLÁUSULA 2ª – DAS OBRIGAÇÕES DO CONTRATADO
O(A) CONTRATADO(A) obriga-se a exercer suas atividades com zelo, ética e em conformidade com a legislação aplicável à profissão de corretor de imóveis, mantendo seu registro no CRECI regular durante toda a vigência deste contrato.

CLÁUSULA 3ª – DA REMUNERAÇÃO
A remuneração do(a) CONTRATADO(A) corresponderá a percentual sobre as comissões efetivamente recebidas pelo CONTRATANTE em razão dos negócios intermediados pelo(a) CONTRATADO(A), conforme tabela de comissionamento vigente do CONTRATANTE.

CLÁUSULA 4ª – DO PRAZO
Este contrato vigora por prazo indeterminado, a partir da data de assinatura.

CLÁUSULA 5ª – DA RESCISÃO
Qualquer das partes poderá rescindir o presente contrato mediante aviso prévio por escrito, sem prejuízo das obrigações já assumidas.

CLÁUSULA 6ª – DO FORO
Fica eleito o foro da comarca do CONTRATANTE para dirimir quaisquer questões oriundas deste contrato.

{{DATA_ATUAL}}

_____________________________
{{NOME_TENANT}} (CONTRATANTE)

_____________________________
{{NOME}} (CONTRATADO/A)`;

// Preview em texto puro (nao PDF) com dados ficticios - espelha
// preencherContratoTemplate() do backend (troca literal de token por
// valor), so que com valores de exemplo fixos em vez dos dados reais de
// um cadastro.
const DADOS_FICTICIOS_PREVIEW: Record<string, string> = {
  "{{NOME_TENANT}}": "Imobiliaria Exemplo Ltda",
  "{{CNPJ_TENANT}}": "12.345.678/0001-90",
  "{{ENDERECO_TENANT}}": "Rua Exemplo, 123, Centro, CEP 12345-000",
  "{{NOME}}": "João da Silva",
  "{{CPF}}": "123.456.789-00",
  "{{CRECI}}": "CRECI 12345-F",
  "{{ENDERECO}}": "Avenida Fictícia, 456",
  "{{CEP}}": "98765-000",
  "{{DATA_ATUAL}}": new Intl.DateTimeFormat("pt-BR").format(new Date()),
};

export function preencherContratoTemplatePreview(corpo: string): string {
  let resultado = corpo;
  for (const [token, valor] of Object.entries(DADOS_FICTICIOS_PREVIEW)) {
    resultado = resultado.split(token).join(valor);
  }
  return resultado;
}

// Espelha domain/services/email-template-tipos.ts (backend) - os 3 tipos
// de e-mail editaveis na aba "Templates de E-mail".
export const EMAIL_TEMPLATE_TIPOS = [
  { tipo: "boas_vindas_corretor", label: "Boas-vindas do Corretor" },
  { tipo: "rejeicao_cadastro", label: "Rejeição de Cadastro" },
  { tipo: "aprovacao_cadastro", label: "Aprovação de Cadastro" },
] as const;

// Espelha domain/services/preencher-email-template.ts (backend). Nem todo
// placeholder faz sentido em todo template (ex: SENHA_TEMPORARIA so no
// boas-vindas) - a lista fica disponivel em todos por simplicidade, o
// Administrador escolhe o que faz sentido para cada um.
export const EMAIL_TEMPLATE_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{NOME}}", label: "Nome do destinatário" },
  { token: "{{EMAIL}}", label: "E-mail do destinatário" },
  { token: "{{EMPRESA}}", label: "Razão social da empresa" },
  { token: "{{SENHA_TEMPORARIA}}", label: "Senha temporária (só boas-vindas)" },
  { token: "{{CARGO}}", label: "Cargo hierárquico (só aprovação)" },
  { token: "{{PERFIL}}", label: "Perfil/role (só aprovação)" },
];

// Espelha domain/services/email-template-padrao.ts (backend) - usado pelo
// botao "Restaurar Padrao" de cada template (so preenche o formulario,
// nao salva sozinho).
export const EMAIL_TEMPLATE_PADRAO: Record<string, { assunto: string; corpo: string }> = {
  boas_vindas_corretor: {
    assunto: "Bem-vindo(a) à {{EMPRESA}}",
    corpo: `<p>Olá, {{NOME}}.</p><p>Sua conta de corretor foi criada na {{EMPRESA}}.</p><p>Acesse com o e-mail <strong>{{EMAIL}}</strong> e a senha temporária abaixo. Recomendamos trocá-la após o primeiro login.</p><p><strong>Senha temporária:</strong> {{SENHA_TEMPORARIA}}</p>`,
  },
  rejeicao_cadastro: {
    assunto: "Sobre o seu cadastro",
    corpo: `<p>Olá, {{NOME}}.</p><p>Analisamos seu cadastro na {{EMPRESA}} e, no momento, não foi possível aprová-lo. Se tiver dúvidas, entre em contato com a nossa equipe.</p>`,
  },
  aprovacao_cadastro: {
    assunto: "Seu cadastro foi aprovado!",
    corpo: `<p>Olá, {{NOME}}.</p><p>Seu cadastro na {{EMPRESA}} foi aprovado! Você já pode entrar no sistema com o e-mail e a senha que você escolheu no cadastro.</p>`,
  },
};

const DADOS_FICTICIOS_EMAIL_PREVIEW: Record<string, string> = {
  "{{NOME}}": "João da Silva",
  "{{EMAIL}}": "joao.silva@exemplo.com",
  "{{EMPRESA}}": "Imobiliaria Exemplo Ltda",
  "{{SENHA_TEMPORARIA}}": "a1b2c3d4e5f6",
  "{{CARGO}}": "corretor",
  "{{PERFIL}}": "Corretor",
};

export function preencherEmailTemplatePreview(texto: string): string {
  let resultado = texto;
  for (const [token, valor] of Object.entries(DADOS_FICTICIOS_EMAIL_PREVIEW)) {
    resultado = resultado.split(token).join(valor);
  }
  return resultado;
}
