// src/modules/gestao_imobiliaria/domain/services/permissao-imovel.ts
// Camada de DOMINIO: regras puras de permissao da area Imoveis (sem Prisma/
// NestJS). Aplicadas DENTRO dos use cases (nao so no RolesGuard), para que
// qualquer caminho que chegue no use case respeite a mesma regra. Ver
// CLAUDE.md, "Permissoes da area Imoveis e WhatsApp (16/10/2026)".
//
// role = Role.name (Administrador/Corretor/Corretor Parceiro); cargo =
// cargoHierarquico (vem do JWT, req.user.cargo - ver jwt.strategy.ts).

import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

// R1: cargos de gestao que podem mudar o status da unidade (inclusive via
// contrato criar/encerrar). "corretor" e "sem cargo" ficam de fora.
export const CARGOS_QUE_ALTERAM_STATUS: readonly string[] = [
  'coordenador',
  'gerente',
  'gerente_regional',
  'superintendente',
  'diretor',
  'diretor_regional',
];

export const MENSAGENS_PERMISSAO_IMOVEL = {
  statusSomenteGestao: 'Somente gerência ou administração altera o status da unidade.',
  naoEDono: 'Você só pode editar imóveis que você mesmo cadastrou.',
  jaPublicado: 'Este imóvel já foi publicado. Somente a administração pode editá-lo.',
  publicadoSomenteAdmin: 'Somente a administração publica ou retira o imóvel do site.',
  vinculoSomenteAdmin: 'Somente a administração vincula imóveis a empreendimentos.',
  statusPeloSeletor:
    'O status da unidade não é alterado pelo cadastro. Use o seletor de status (gerência ou administração).',
} as const;

export function ehAdministrador(role: string | null | undefined): boolean {
  return role === ADMINISTRADOR_ROLE_NAME;
}

export function podeAlterarStatusUnidade(
  role: string | null | undefined,
  cargo: string | null | undefined,
): boolean {
  if (ehAdministrador(role)) return true;
  // Defesa extra: role fora do dashboard (Cliente, Imobiliaria Parceira...)
  // nunca altera, mesmo que algum dia tenha cargo preenchido.
  if (!role || !DASHBOARD_ROLES.includes(role)) return false;
  if (!cargo) return false;
  return CARGOS_QUE_ALTERAM_STATUS.includes(cargo);
}

// R2: quem nao e Administrador so edita cadastro/fotos de imovel que ele
// mesmo criou E enquanto nao foi publicado. criadoPorUserId nulo (imoveis
// antigos, lote, book) = tratado como do Administrador.
export type BloqueioEdicaoImovel = 'nao_e_dono' | 'ja_publicado' | null;

export function verificarEdicaoCadastroImovel(
  ator: { userId: string; role: string | null | undefined },
  imovel: { criadoPorUserId: string | null; publicado: boolean },
): BloqueioEdicaoImovel {
  if (ehAdministrador(ator.role)) return null;
  if (!imovel.criadoPorUserId || imovel.criadoPorUserId !== ator.userId) return 'nao_e_dono';
  if (imovel.publicado) return 'ja_publicado';
  return null;
}

export function mensagemBloqueioEdicao(bloqueio: Exclude<BloqueioEdicaoImovel, null>): string {
  return bloqueio === 'nao_e_dono'
    ? MENSAGENS_PERMISSAO_IMOVEL.naoEDono
    : MENSAGENS_PERMISSAO_IMOVEL.jaPublicado;
}

// Quem esta executando a acao (montado no controller a partir de req.user).
export interface AtorImovel {
  userId: string;
  role: string;
  cargo: string | null;
}
