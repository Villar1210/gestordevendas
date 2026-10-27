// src/modules/vendas_kanban/domain/services/conflito-novo-negocio.ts
// Camada de DOMINIO (funcao pura). Fase B (27/10/2026), ajustada apos a
// revisao independente: quando uma PESSOA (nao o sistema) cria um negocio
// ("+ Novo Negocio" ou o lead rapido da Caixa de Entrada) para um telefone que
// ja tem card aberto no MESMO funil, o que fazer:
// - card no Repique (cliente perdido/sem resposta): libera - e uma nova
//   oportunidade e quem atende hoje pode ser outro corretor;
// - card do proprio corretor: libera no "+ Novo Negocio" (2o negocio do mesmo
//   cliente); no lead rapido recusa (iria para a Roleta e cair com outro);
// - card de outro corretor: recusa;
// - lead com a VIVI ou na Caixa de Entrada esperando a Roleta: recusa (quem
//   decide e a VIVI/Roleta ou a gestao).
// Devolve a mensagem de recusa, ou null quando pode criar.
import { REPIQUE_STAGE_NAME } from './protected-stages';

export interface CardAbertoResumo {
  pipelineId: string;
  ownerId: string | null;
  stageName: string | null;
  emAtendimentoVivi?: boolean;
}

export function conflitoNovoNegocio(
  existente: CardAbertoResumo,
  requesterUserId: string | null | undefined,
  opcoes: { permitirProprio: boolean },
): string | null {
  if (existente.stageName === REPIQUE_STAGE_NAME) return null;
  if (existente.ownerId) {
    if (existente.ownerId === requesterUserId) {
      return opcoes.permitirProprio ? null : 'Este cliente já tem um negócio aberto na sua carteira.';
    }
    return 'Este cliente já está em atendimento com outro corretor.';
  }
  if (existente.emAtendimentoVivi) {
    return 'Este cliente está em atendimento pela VIVI. Peça para a gestão encaminhar para a Roleta.';
  }
  return 'Este cliente já está na Caixa de Entrada aguardando distribuição.';
}
