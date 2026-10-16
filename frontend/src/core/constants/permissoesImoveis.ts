// src/core/constants/permissoesImoveis.ts
// Espelha src/modules/gestao_imobiliaria/domain/services/permissao-imovel.ts
// do backend - aqui so decide o que MOSTRAR. Quem bloqueia de verdade e
// sempre o backend (use cases + RolesGuard). Ver CLAUDE.md, "Permissoes da
// area Imoveis e WhatsApp (16/10/2026)".
import { DASHBOARD_ROLES } from "./dashboardRoles";

export const CARGOS_QUE_ALTERAM_STATUS = [
  "coordenador",
  "gerente",
  "gerente_regional",
  "superintendente",
  "diretor",
  "diretor_regional",
];

export function podeAlterarStatusUnidade(role: string | null, cargo: string | null): boolean {
  if (role === "Administrador") return true;
  if (!role || !DASHBOARD_ROLES.includes(role)) return false;
  return !!cargo && CARGOS_QUE_ALTERAM_STATUS.includes(cargo);
}

// Cadastro/fotos: Administrador sempre; os demais so o imovel que eles mesmos
// criaram e enquanto nao publicado (criadoPorUserId nulo = do Administrador).
export function podeEditarCadastroImovel(
  me: { id: string | null; role: string | null },
  imovel: { criadoPorUserId?: string | null; publicado?: boolean },
): boolean {
  if (me.role === "Administrador") return true;
  if (!me.id || !imovel.criadoPorUserId || imovel.criadoPorUserId !== me.id) return false;
  return !imovel.publicado;
}
