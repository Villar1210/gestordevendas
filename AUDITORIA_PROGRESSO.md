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

## I9 — Escalonamento fixo de 15min → 5min
**Feito:** `ESCALONAMENTO_MINUTOS_LIMITE` (`EscalonarAtendimentosSemDonoUseCase`) reduzido de 15 para 5 minutos, mesma regra uniforme para todos os tenants/filas (sem configuração por caso).
**Nota:** existe uma constante espelhada e independente em `roleta_online/EscalonarCardsSemDonoUseCase` (caminho do Kanban) que permanece em 15min — fora do escopo desta auditoria (módulo Atendimento). Registrado no commit para decisão futura se precisar alinhar.
**Commit:** `8748cd5`
**Testes:** nova spec (2 testes: valor da constante, cutoff de exatamente 5min passado ao repositório) — 2/2 passando. Suíte completa cobrindo comportamento (evento, idempotência, resiliência a erro) fica para o I14. `tsc --noEmit` limpo. Suíte `atendimento`: 1 falha pré-existente de integração (Postgres indisponível, `get-or-create-atendimento.race-condition.integration.spec.ts`, não relacionada), sem regressão.

## I8a — Lista fixa de motivos de fechamento do Atendimento (texto livre -> lista fechada)
**Feito:** `MOTIVOS_FECHAMENTO` (`atendimento/domain/services/motivo-fechamento.ts`,
mesmo padrao de `MOTIVOS_REPIQUE`/`motivo-repique.ts`): `venda_concluida`,
`desistencia`, `finalizacao_normal` — **sem** `abandono` (ver I8b abaixo).
`CloseAtendimentoDto.motivo` passou de `@IsString()` (texto livre) para
`@IsIn(MOTIVOS_FECHAMENTO)`. Frontend (`AtendimentoChatPanel.tsx`) trocou o
`<input>` de texto livre por um `<select>` com essas 3 opcoes (mais uma
opcao vazia, ja que o motivo continua opcional). `CloseAtendimentoUseCase`
passou a incluir `motivoFechamento` no payload do evento
`atendimento.fechado` (antes so tenantId/atendimentoId/sessao/remoteJid/
phoneNumber) — `AtendimentoFechadoListener` (modulo `vivi_sdr`) repassa esse
campo para `ReabrirViviAposFechamentoUseCase`, que ganhou um filtro adicional
no INICIO do metodo (antes de qualquer consulta a repositorio): se
`motivoFechamento` for um dos 3 motivos de negocio, retorna imediatamente
sem reabrir — mesmo que o sinal tecnico (`ViviConversation.status ===
'encaminhado_fila'`) esteja presente. O comportamento pre-existente baseado
so nesse sinal tecnico foi mantido inalterado para `motivoFechamento` nulo
ou fora da lista (ex: um motivo de texto livre anterior a esta correcao).
**Escopo estrito respeitado:** nenhum mecanismo de timeout/deteccao
automatica de abandono foi criado nesta etapa (ver I8b).
**Commit:** `d2390ee`
**Testes:** `close-atendimento.use-case.spec.ts` ganhou 1 teste novo
(motivo de negocio propaga `motivoFechamento` no evento emitido) + o teste
existente do evento foi atualizado para incluir `motivoFechamento: null`.
`reabrir-vivi-apos-fechamento.use-case.spec.ts` ganhou 5 testes novos: os 3
motivos de negocio (`it.each`) nunca reabrem mesmo com o sinal tecnico
presente (e nem chegam a consultar repositorio); motivo nulo e motivo fora
da lista (texto livre antigo) mantem o comportamento anterior inalterado
(ainda reabrem quando o sinal tecnico indica). 13/13 passando nos 2 specs
tocados. Suite completa `atendimento`+`vivi_sdr`: as mesmas falhas
pre-existentes ja documentadas (integracao dependente de Postgres) mais uma
falha de tipo pre-existente e nao relacionada em
`test/factories/vivi-config-record.factory.ts` (`diasParaRotting`) —
confirmado via `git stash` que ambas falham identicamente sem as mudancas
desta tarefa, sem regressao introduzida. `tsc --noEmit` limpo.

## I8b — Deteccao automatica de abandono (PENDENTE, fora de escopo por decisao)
Motivo "abandono" (fechamento automatico por timeout de inatividade, sem
acao humana) foi deliberadamente deixado de fora do I8a. Nenhum mecanismo de
timeout foi construido. Decisao registrada com o usuario: avaliar em uma
tarefa futura se vale a pena construir esse mecanismo (e, se sim, definir a
janela de tempo e se ele dispara o fechamento sozinho ou so sinaliza para
um humano decidir).

---

*Itens pendentes: I8b, I10, I11, I12, I13, I14, I15.*
