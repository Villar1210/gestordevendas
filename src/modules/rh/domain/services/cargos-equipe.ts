// src/modules/rh/domain/services/cargos-equipe.ts
// RH - cadastro completo da equipe interna (25/11/2026). Cargos que o
// candidato escolhe na ficha e como eles se encaixam na hierarquia do Gestor
// (decisao do Villar): o cargo define o cargoHierarquico sugerido na
// aprovacao e QUEM ele pode indicar como superior.
export const CARGOS_EQUIPE = [
  'Consultor de Vendas',
  'Corretor Imobiliário',
  'Coordenador de Vendas',
  'Gerente de Vendas',
  'Gerente Regional',
  'Coordenador de Parcerias',
  'Supervisor de Parcerias',
] as const;

export type CargoEquipe = (typeof CARGOS_EQUIPE)[number];

interface RegraCargo {
  cargoHierarquico: string;
  superioresPermitidos: string[];
  perguntaSuperior: string;
}

const PERGUNTA_GERENTE = 'Quem é o seu gerente?';

export const REGRAS_CARGO: Record<CargoEquipe, RegraCargo> = {
  'Consultor de Vendas': { cargoHierarquico: 'corretor', superioresPermitidos: ['gerente'], perguntaSuperior: PERGUNTA_GERENTE },
  'Corretor Imobiliário': { cargoHierarquico: 'corretor', superioresPermitidos: ['gerente'], perguntaSuperior: PERGUNTA_GERENTE },
  'Coordenador de Vendas': { cargoHierarquico: 'coordenador', superioresPermitidos: ['gerente'], perguntaSuperior: PERGUNTA_GERENTE },
  'Coordenador de Parcerias': { cargoHierarquico: 'coordenador', superioresPermitidos: ['gerente'], perguntaSuperior: PERGUNTA_GERENTE },
  'Supervisor de Parcerias': { cargoHierarquico: 'coordenador', superioresPermitidos: ['gerente'], perguntaSuperior: PERGUNTA_GERENTE },
  'Gerente de Vendas': {
    cargoHierarquico: 'gerente',
    superioresPermitidos: ['superintendente', 'gerente_regional'],
    perguntaSuperior: 'Quem é o seu superintendente ou gerente regional?',
  },
  'Gerente Regional': {
    cargoHierarquico: 'gerente_regional',
    superioresPermitidos: ['superintendente', 'diretor', 'diretor_regional'],
    perguntaSuperior: 'Quem é o seu superintendente ou diretor?',
  },
};

export function ehCargoEquipe(cargo: string): cargo is CargoEquipe {
  return (CARGOS_EQUIPE as readonly string[]).includes(cargo);
}

// "Itau" -> "Itau"; "12345-6" -> "•••45-6"; mostra so o fim.
export function mascarar(valor: string | null | undefined, visiveis = 4): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (v.length <= visiveis) return '•'.repeat(v.length);
  return '•'.repeat(Math.min(6, v.length - visiveis)) + v.slice(-visiveis);
}
