// src/features/configuracoes/constants.ts
// Espelha domain/services/preencher-contrato-template.ts (backend) - lista
// dos placeholders aceitos hoje no corpo do ContratoTemplate, exibida no
// editor (aba "Template de Contrato" do Painel Administrativo) para o
// Administrador clicar e inserir na posicao do cursor.
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
