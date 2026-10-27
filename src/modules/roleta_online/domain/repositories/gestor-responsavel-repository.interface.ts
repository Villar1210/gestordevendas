// src/modules/roleta_online/domain/repositories/gestor-responsavel-repository.interface.ts
// Fase B (Q6, 27/10/2026): quando o corretor sorteado nao aceita o lead no
// prazo e nao ha outro corretor para receber, o lead sobe para a gestao.
export interface GestorResponsavel {
  id: string;
  name: string;
}

export interface IGestorResponsavelRepository {
  // Ordem: (1) superior direto do corretor (coordenador/gerente, User.superiorId)
  // se for do mesmo tenant e estiver aprovado; (2) senao, o Administrador mais
  // antigo do tenant. null so se o tenant nao tiver nenhum dos dois.
  encontrarParaCorretor(tenantId: string, corretorId: string | null): Promise<GestorResponsavel | null>;
}
