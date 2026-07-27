-- Auditoria de seguranca/integridade (achado C2, 26/07/2026): mensagens
-- concorrentes do mesmo lead podem disparar processamento paralelo do
-- fluxo "buscar-ou-criar" em 3 pontos (ViviConversation, Atendimento, Card
-- de captura automatica da VIVI), sem nenhuma protecao de banco - cada
-- execucao concorrente pode criar seu proprio registro duplicado pro mesmo
-- lead. Os 3 indices abaixo sao PARCIAIS (WHERE), nao globais, de proposito:
-- cada entidade ja permite legitimamente multiplos registros historicos
-- para a mesma chave ao longo do tempo (conversa/atendimento anterior
-- fechado + um novo depois, ou varios Cards manuais pro mesmo telefone) -
-- so o registro "ativo"/"desta origem especifica" precisa ser unico por vez.
--
-- Nao expressos como @@unique no schema.prisma porque o Prisma DSL nao
-- suporta indice unico parcial/filtrado nativamente (ver comentario acima
-- de cada model afetado) - mas o Postgres rejeita a violacao normalmente,
-- e o Prisma Client reporta como erro P2002 (tratado em
-- GetOrCreateAtendimentoUseCase, ProcessIncomingMessageUseCase e
-- CapturarLeadMinimoUseCase: ao capturar P2002, o codigo busca de novo o
-- registro que a mensagem concorrente ja criou, em vez de propagar o erro).

-- ViviConversation: no maximo 1 conversa "em_andamento" por sessao+telefone.
CREATE UNIQUE INDEX "vivi_conversations_active_session_phone_key"
  ON "vivi_conversations" ("whatsapp_session_id", "phone_number")
  WHERE "status" = 'em_andamento';

-- Atendimento: no maximo 1 atendimento aberto (status != 'fechado') por
-- sessao+remoteJid.
CREATE UNIQUE INDEX "atendimentos_active_session_remote_jid_key"
  ON "atendimentos" ("whatsapp_session_id", "remote_jid")
  WHERE "status" != 'fechado';

-- Card: no maximo 1 card de CAPTURA AUTOMATICA da VIVI por tenant+telefone.
-- Escopado somente a origem='captura_auto_vivi' - Cards manuais/outras
-- origens continuam sem restricao de unicidade por telefone.
CREATE UNIQUE INDEX "cards_captura_auto_vivi_tenant_phone_key"
  ON "cards" ("tenant_id", "phone")
  WHERE "origem" = 'captura_auto_vivi';
