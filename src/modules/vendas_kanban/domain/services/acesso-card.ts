// src/modules/vendas_kanban/domain/services/acesso-card.ts
// Camada de DOMINIO (funcao pura, sem NestJS/Prisma). Regra decidida pelo
// dono em 27/10/2026 (mapa de processos, Etapa 3): um card so pode ser
// alterado (mover, editar, excluir, atividades, notas) pelo DONO, pelos
// SUPERIORES dele e pelo Administrador. "Superior" segue exatamente o mesmo
// escopo de visibilidade do board (shared/domain/services/cargo-escopo.ts):
// - 'todos' (Administrador, diretor, diretor_regional): qualquer card;
// - 'equipe' (gerente, gerente_regional, superintendente): os proprios e os
//   da arvore inteira de subordinados;
// - 'plantao' (coordenador): os dos corretores escalados hoje no stand dele;
// - 'proprio' (corretor, sem cargo, Corretor Parceiro): so os proprios.
// Card SEM dono (Caixa de Entrada): qualquer um VE (e o pool de onde o
// corretor assume o lead - ver GetInboxUseCase), mas so quem tem escopo
// acima de 'proprio' ALTERA. O corretor pega o lead pela rota de assumir
// (ClaimCardUseCase), nunca editando/movendo direto.
import { EscopoVisibilidade } from '../../../../shared/domain/services/cargo-escopo';

export type OperacaoCard = 'ver' | 'alterar';

export interface AcessoCardEntrada {
  escopo: EscopoVisibilidade;
  operacao: OperacaoCard;
  cardOwnerId: string | null;
  requesterUserId: string;
  // Donos alcancados pelo escopo do requisitante (subordinados ou escalados
  // de hoje). null quando o escopo nao precisa de lista ('todos'/'proprio').
  idsDoEscopo: string[] | null;
}

export function podeAcessarCard(entrada: AcessoCardEntrada): boolean {
  if (entrada.escopo === 'todos') return true;

  if (!entrada.cardOwnerId) {
    return entrada.operacao === 'ver' || entrada.escopo !== 'proprio';
  }

  if (entrada.cardOwnerId === entrada.requesterUserId) return true;
  if (entrada.escopo === 'proprio') return false;

  return (entrada.idsDoEscopo ?? []).includes(entrada.cardOwnerId);
}

export const MENSAGEM_SEM_ACESSO_CARD =
  'Você não tem permissão para alterar este negócio. Somente o corretor responsável, os superiores dele e a administração podem.';
