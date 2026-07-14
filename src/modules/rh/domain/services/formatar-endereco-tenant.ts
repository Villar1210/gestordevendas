// src/modules/rh/domain/services/formatar-endereco-tenant.ts
// Camada de DOMINIO: funcao pura. Junta os campos separados de endereco do
// Tenant (ver ITenantConfigRepository) num unico texto para o placeholder
// {{ENDERECO_TENANT}} do contrato - so inclui as partes preenchidas.
export interface EnderecoTenantInput {
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
}

export function formatarEnderecoTenant(input: EnderecoTenantInput): string {
  const partes = [
    input.endereco,
    input.numero ? `nº ${input.numero}` : null,
    input.complemento,
    input.bairro,
    input.cep ? `CEP ${input.cep}` : null,
  ].filter((parte): parte is string => !!parte && parte.trim().length > 0);

  return partes.length > 0 ? partes.join(', ') : 'endereço não informado';
}
