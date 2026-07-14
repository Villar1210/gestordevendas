// src/modules/rh/domain/services/preencher-contrato-template.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS/pdf-lib. Troca os
// placeholders {{...}} do corpo do ContratoTemplate pelos dados reais do
// cadastro aprovado - usada tanto para o modelo padrao quanto para
// templates customizados (Fatia 3), desde que usem os mesmos placeholders.
export interface DadosContrato {
  nomeTenant: string;
  cnpjTenant: string;
  enderecoTenant: string;
  nome: string;
  cpf: string;
  creci: string;
  endereco: string;
  cep: string;
  dataAtual: string;
}

const PLACEHOLDERS: Record<keyof DadosContrato, string> = {
  nomeTenant: '{{NOME_TENANT}}',
  cnpjTenant: '{{CNPJ_TENANT}}',
  enderecoTenant: '{{ENDERECO_TENANT}}',
  nome: '{{NOME}}',
  cpf: '{{CPF}}',
  creci: '{{CRECI}}',
  endereco: '{{ENDERECO}}',
  cep: '{{CEP}}',
  dataAtual: '{{DATA_ATUAL}}',
};

export function preencherContratoTemplate(corpo: string, dados: DadosContrato): string {
  let resultado = corpo;
  for (const chave of Object.keys(PLACEHOLDERS) as (keyof DadosContrato)[]) {
    resultado = resultado.split(PLACEHOLDERS[chave]).join(dados[chave]);
  }
  return resultado;
}
