// src/modules/vivi_sdr/constants/vivi-interna.ts
// Decisao do dono (27/10/2026): a VIVI oficial e SO a do fazer.ai
// (vivi.ivillar.com.br), que chega ao Gestor pelas rotas /vivi/* do modulo
// vivi-integration. A VIVI interna deste modulo (Claude chamado direto pelo
// Gestor) foi DESLIGADA: nao responde WhatsApp (sessao Baileys), nem DM de
// Instagram/Facebook, nem o webhook do Chatwoot (rota removida do modulo).
// O codigo continua guardado (nao apagado). Para religar no futuro, trocar
// para true E rever o mapa de processos (claude/mapa-processos-2026-10.md
// no Projeto) - religar sem isso faz duas VIVIs responderem o mesmo lead.
export const VIVI_INTERNA_ATIVA = false;

export const MENSAGEM_VIVI_INTERNA_DESLIGADA =
  'A VIVI interna foi desativada. A VIVI oficial atende pelo fazer.ai.';
