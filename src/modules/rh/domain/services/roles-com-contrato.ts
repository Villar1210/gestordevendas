// src/modules/rh/domain/services/roles-com-contrato.ts
// Camada de DOMINIO: funcao pura. So estes 3 perfis (corretores/parceiros
// que prestam servico para a imobiliaria) geram contrato de prestacao de
// servico na aprovacao - "Cliente" (comprador/proprietario) nao presta
// servico, nao faz sentido gerar contrato para ele.
export const ROLES_QUE_EXIGEM_CONTRATO = ['Corretor', 'Corretor Parceiro', 'Imobiliaria Parceira'];

export function exigeContrato(roleName: string): boolean {
  return ROLES_QUE_EXIGEM_CONTRATO.includes(roleName);
}

// "Imobiliaria Parceira" e pessoa juridica - usa CNPJ no lugar do CRECI
// pessoal (o template ainda assim usa o placeholder {{CRECI}} para o
// numero de registro profissional, seja CRECI ou CRECI-J/CNPJ - ver
// GerarContratoPrestacaoServicoUseCase).
export function ehPessoaJuridica(roleName: string): boolean {
  return roleName === 'Imobiliaria Parceira';
}
