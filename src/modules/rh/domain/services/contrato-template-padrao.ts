// src/modules/rh/domain/services/contrato-template-padrao.ts
// Camada de DOMINIO: texto puro, sem Prisma/NestJS. Modelo de TESTE
// generico (nao e assessoria juridica - revisar com advogado antes de
// usar como contrato real) usado por GetOrCreateContratoTemplateUseCase
// para criar automaticamente o ContratoTemplate padrao de um tenant, na
// primeira aprovacao de cadastro que precisar dele. Placeholders
// preenchidos por preencher-contrato-template.ts.
export const DEFAULT_CONTRATO_TEMPLATE_NOME =
  'Contrato de Prestação de Serviços de Corretagem Imobiliária (Padrão)';

export const DEFAULT_CONTRATO_TEMPLATE_CORPO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CORRETAGEM IMOBILIÁRIA

CONTRATANTE: {{NOME_TENANT}}

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
