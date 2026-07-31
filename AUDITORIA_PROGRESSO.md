# Auditoria — Progresso

Registro incremental da correção dos achados da auditoria (I4 em diante — I1/I2/I3/I6 já fechados em sessões anteriores, ver histórico de commits). Um achado por vez, um commit por achado (ou sub-parte, quando indicado).

---

## I4 — ACK do WhatsApp: `updateMany` sem checar `count`
**Feito:** `updateStatusEntregaByBaileysMessageId` passou a retornar `{ count }`; caller loga `warn` quando `count === 0` em vez de log de sucesso incondicional.
**Commit:** `a6e13d0` (junto com I5, mesmo trecho de código)
**Testes:** suíte `whatsappmarketing` — 3 falhas pré-existentes de integração (Postgres indisponível no sandbox), sem regressão real. Specs unitárias/integração editadas passando (exceto a parte que depende de banco real).

## I5 — Log `[DEBUG-ACK-RAW]` exposto em produção
**Feito:** log removido por completo (não rebaixado para `.debug()` — confirmado que o projeto não diferencia nível de log por ambiente hoje).
**Commit:** `a6e13d0` (junto com I4)
**Testes:** idem I4.

## I7 — `SendWhatsAppMessageUseCase` checava só o status do banco, não o socket real
**Feito:** `isConnected(sessionId)` já existia em `IWhatsAppProvider`/`BaileysWhatsAppProvider` (estado real do socket em memória, distinto do `status` no banco que pode ficar stale após restart do processo). Use case agora usa o banco como filtro rápido (`status !== 'CONNECTED'` → 400 imediato) + `isConnected()` como checagem real antes de enviar (400 com mensagem distinta se o socket não estiver de fato conectado).
**Commit:** `3eb3475`
**Testes:** nova spec `send-whatsapp-message.use-case.spec.ts` (4 testes: envia normalmente, bloqueia quando status stale, bloqueia quando já desconectado no banco, 404 quando sessão não existe) — 4/4 passando. `tsc --noEmit` limpo. Suíte `whatsappmarketing`: mesmas 3 falhas pré-existentes de integração (Postgres indisponível), sem regressão.

---

*Itens pendentes: I8, I9, I10, I11, I12, I13, I14, I15.*
