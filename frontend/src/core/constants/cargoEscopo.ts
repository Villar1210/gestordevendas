// src/core/constants/cargoEscopo.ts
// Espelha src/shared/domain/services/cargo-escopo.ts do backend - so a
// parte usada pelo frontend (esconder botao de excluir). A visibilidade de
// DADOS (escopo todos/equipe/proprio) continua 100% resolvida no backend -
// o frontend nunca decide "quais cards mostrar", so recebe a lista ja
// filtrada. Aqui so decidimos SE renderiza o botao de excluir - a
// aplicacao real da regra (o que realmente bloqueia) e sempre o
// BlockDeleteForCargoGuard no backend.
const CARGO_PODE_EXCLUIR: Record<string, boolean> = {
  diretor: false,
  diretor_regional: false,
  gerente: false,
  gerente_regional: false,
  superintendente: false,
  coordenador: false,
  corretor: true,
};

export function podeExcluirRegistroDeNegocio(role: string, cargo: string | null): boolean {
  if (role === "Administrador") return true;
  if (!cargo) return true;
  return CARGO_PODE_EXCLUIR[cargo] ?? true;
}
