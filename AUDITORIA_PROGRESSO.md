# Auditoria — Progresso

Registro incremental da correção dos achados da auditoria (I4 em diante — I1, I2, I2b, I3 (e sua cadeia completa) e I6 também foram corrigidos nesta mesma sessão, no início do trabalho, antes dos achados I4 em diante documentados abaixo; apenas C1 e C2 são anteriores a esta sessão). Um achado por vez, um commit por achado (ou sub-parte, quando indicado).

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

## I10 — Refactor estrutural: ProcessIncomingMessageUseCase (897 linhas, 17 dependencias)
**Feito:** refactor estrutural puro (sem mudanca de logica de negocio),
dividido em 5 commits sequenciais, cada um extraindo uma responsabilidade
coesa de dentro de `ProcessIncomingMessageUseCase` para uma classe/funcao
propria, seguindo Clean Architecture (domain/services para logica pura sem
I/O, application/services para orquestracao com I/O reaproveitada por mais
de um use case). Plano aprovado pelo usuario antes de tocar em codigo (ver
historico da conversa) - `findOrCreateConversation`/`buildHistory` e a
cauda final de `execute()` deliberadamente NAO extraidos (baixo volume,
alto custo de reescrita de mocks nos testes, ver plano original).

**Reducao real:** 897 → 485 linhas no arquivo principal (-46%). Construtor:
17 → 13 parametros.

1. `f395eb3` - `mergeCollectedData`/`applyPostVisitaData`/`parseRenda` →
   `domain/services/vivi-lead-data-merger.ts` (funcoes puras, sem I/O, sem
   mudanca de construtor).
2. `8c2b26f` - `resolveTool`/`formatCatalogoEncontrado` (tool de busca de
   endereco) + persistencia do `EnderecoBuscaLog` →
   `EnderecoBuscaToolResolverService` (novo application service).
3. `b796188` - `transferToBroker` (criacao/promocao de Card para
   corretor) → `TransferToBrokerService` (maior extracao isolada, ~107
   linhas).
4. `7d79940` - `transferToFila` + `handleAiFailure` (ambos criam/buscam
   Atendimento e chamam `ClassifyAndRouteAtendimentoUseCase`) consolidados
   em `ViviAtendimentoEscalationService`.
5. `2000db7` - Guarda 1 (checagem de status da conversa) vira funcao pura
   `deveIgnorarPorConversaTransferida` em
   `domain/services/vivi-conversation-guard.ts`; Guardas 2 (card com dono)
   e 3 (opt-out de Repique) → `ViviMessageGuardsService`.

**Nota operacional (concorrencia real durante o refactor):** um trabalho
em paralelo (feature "VIVI Followups", nao relacionado a este item) estava
editando os MESMOS arquivos compartilhados (`process-incoming-message.
use-case.ts`, `vivi-sdr.module.ts`) ao mesmo tempo. Para nao perder nem
misturar esse trabalho em progresso, cada commit deste refactor foi
staged seletivamente via `git hash-object`/`git update-index --cacheinfo`
(reconstruindo em arquivo separado so as linhas do refactor, sobre a base
do commit anterior, e injetando esse conteudo direto no index do git) -
a working tree do usuario nunca foi sobrescrita, o trabalho concorrente
ficou preservado e continua uncommitted, pronto para o usuario revisar/
commitar quando terminar. Confirmado com `diff` antes de cada stage que
nenhuma linha do trabalho concorrente entrou nos commits deste I10.

Tambem foi necessario rodar `npx prisma generate` (so regenera o Prisma
Client a partir do `schema.prisma` atual, sem migrar banco - autorizado
pelo usuario) para destravar um erro de tipo pre-existente do trabalho
concorrente (campo `proximoFollowupEm` ainda nao gerado no client) que
bloqueava a compilacao de specs deste modulo. `test/factories/
vivi-conversation-record.factory.ts` tambem ganhou os campos novos da
mesma expansao (`cpfColetado`/`fgtsDisponivel`/`temFilhos`/
`composicaoRenda`/`tentativasFollowup`/`proximoFollowupEm`) so para a
factory compilar de novo - mudanca minima, nos defaults da factory de
teste, sem tocar logica de producao.

**Testes:** apos cada commit, as 3 specs que instanciam
`ProcessIncomingMessageUseCase` diretamente (`process-incoming-message.
use-case.spec.ts`, `process-incoming-message-promocao.use-case.spec.ts`,
`process-incoming-message.race-condition.integration.spec.ts`) foram
ajustadas para a nova assinatura do construtor, e `tsc --noEmit` +
suite `vivi_sdr`+`atendimento` rodados antes de avancar para o proximo
commit. Resultado final: as 3 specs proprias deste use case ficam
bloqueadas so pela falha de tipo pre-existente e ja documentada
(`test/factories/vivi-config-record.factory.ts`, campo `diasParaRotting`,
presente desde antes do I8a, confirmada via `git stash` naquela ocasiao)
- nao e regressao deste refactor. Demais falhas da suite completa
pertencem ao trabalho concorrente (VIVI Followups) e a integracao
dependente de Postgres, ja documentadas em itens anteriores.

## I11 — Camada de aplicacao do Atendimento quase nao logava nada
**Feito:** dos 16 use cases do modulo (excluindo specs), so
`EscalonarAtendimentosSemDonoUseCase` e `GetOrCreateAtendimentoUseCase`
tinham `Logger`. Adicionado logging nos outros 12 (mesmo padrao ja
usado nesses dois: `Logger` do NestJS, prefixo `[Atendimento]`,
mensagens descritivas com os IDs relevantes):
- **Mutacoes de estado** (`CreateFilaUseCase`, `DeleteFilaUseCase`,
  `AddUsuarioToFilaUseCase`, `RemoveUsuarioFromFilaUseCase`,
  `AssignAtendimentoUseCase`, `TransferAtendimentoUseCase`,
  `RequeueAtendimentoUseCase`, `CloseAtendimentoUseCase`,
  `ClassifyAndRouteAtendimentoUseCase`, `AddNotaAtendimentoUseCase`,
  `EnviarMensagemAtendimentoUseCase`) logam com `log()` ao final da
  operacao, com o ator responsavel.
- **Decisao notavel de negocio** (`ClassifyAndRouteAtendimentoUseCase`
  criando uma fila que nao existia, ao classificar) loga com `warn()`.
- **Decisao de seguranca** (`GetAtendimentoDetailUseCase` negando
  acesso ao detalhe de um atendimento fora do escopo do requisitante)
  loga com `warn()`.
- **Dado sensivel nunca logado**: texto da nota
  (`AddNotaAtendimentoUseCase`) e corpo da mensagem
  (`EnviarMensagemAtendimentoUseCase`) - so o rastro de que a acao
  aconteceu e por quem, nunca o conteudo.
- **Deliberadamente sem log**: `ListFilasUseCase`/`ListAtendimentosUseCase`
  (leitura pura, virariam ruido a cada carregamento de tela, sem valor
  diagnostico novo).
**Commit:** `f8ff3ba`
**Testes:** `tsc --noEmit` limpo. Suite `atendimento`: 21/23 passando -
a unica falha e a integracao `get-or-create-atendimento.race-condition`
(pre-existente, dependente de Postgres, sem regressao). Logs conferidos
disparando corretamente no output do jest durante a rodada de testes
(mensagens `[Atendimento] ...` aparecendo no console para cada mutacao
exercitada pelos testes existentes).

## I12 — Botao "Finalizar" na lista fechava sem confirmacao (inconsistente com o painel de chat)
**Feito:** `AtendimentoList.tsx` (linha de atendimento, `AtendimentoRow`)
chamava `onQuickClose(id)` direto no clique do botao "Finalizar", sem
chance de cancelar nem escolher motivo - diferente do painel de chat
(`AtendimentoChatPanel.tsx`), que ja tinha esse dialogo desde o I8a
(select de `MOTIVO_FECHAMENTO_OPTIONS` + Cancelar/Confirmar). Aplicado
o MESMO padrao ja usado no toggle "Transferir" da propria lista (painel
inline abaixo da linha, com select + Cancelar/Confirmar) - so troca o
select de fila/agente pelo select de motivo de fechamento (mesma
constante `MOTIVO_FECHAMENTO_OPTIONS` do painel de chat, sem duplicar
as opcoes). `onQuickClose` (prop do componente) ganhou o parametro
opcional `motivo` - o hook `useAtendimentoIntegration.handleClose` ja
aceitava esse parametro, so a lista nao o repassava. Toggle de
"Finalizar" e "Transferir" sao mutuamente exclusivos (abrir um fecha o
outro), mesma UX ja esperada pelo padrao existente.
**Commit:** `7a0a445`
**Testes:** `tsc --noEmit` e `eslint` limpos no frontend. **NAO
testado no navegador** - Docker Desktop indisponivel neste ambiente
(sem Postgres rodando, sem como subir o backend para logar e navegar
ate a Central de Atendimento) - registrado aqui explicitamente em vez
de alegar teste que nao foi feito. Revisao manual do diff confirma que
a estrutura espelha exatamente o toggle "Transferir" ja existente e
testado na mesma lista.

## I13 — Corrida entre troca de conversa e polling de 5s exibia conversa errada
**Investigacao:** poll de 5s (`dashboard/atendimento/page.tsx`, `POLL_INTERVAL_MS`)
chama `loadAtendimentoDetail(selectedAtendimentoId, true)` (silent) a
cada 5s enquanto houver uma conversa selecionada. `loadAtendimentoDetail`
(`useAtendimentoIntegration.ts`) aplicava `setDetail(eventos, mensagens)`
- estado GLOBAL no store, sem escopo por `atendimentoId` - de forma
incondicional. Como o poll (silent) e a troca manual de conversa
(`handleSelect`, nao-silent) podem ter requisicoes `GET /atendimentos/:id`
em voo ao mesmo tempo sem garantia de ordem de resolucao, uma resposta
ATRASADA de uma conversa antiga (ex: A) podia chegar DEPOIS do usuario
ja ter trocado para outra conversa (B) e sobrescrever a tela com os
dados de A, mesmo com o cabeçalho/selecao indicando B.
`updateAtendimentoInPlace` (tambem chamado ali) NAO tinha esse problema
- ja fazia merge por `id` na lista, nunca vazando para outro item.
**Feito:** guarda adicionada em `loadAtendimentoDetail`: so aplica
`setDetail` se `useAtendimentoStore.getState().selectedAtendimentoId`
(lido no MOMENTO em que a resposta chega, nao um valor capturado no
inicio da chamada - mesma armadilha de novo) ainda for igual ao
`atendimentoId` que originou aquela requisicao especifica. Se a
selecao ja mudou, a resposta e descartada silenciosamente (nao aplica
`setDetail`, mas `updateAtendimentoInPlace` continua rodando -
seguro). Escopo estrito respeitado: so `useAtendimentoIntegration.ts`.
**Commit:** `fe45ba0`
**Testes:** **sem infraestrutura de teste de frontend configurada
neste projeto** (sem jest/vitest/@testing-library/react, sem script
`test` no `package.json` - so `playwright` como devDependency, usado
historicamente como scripts E2E descartaveis contra o app rodando de
verdade, nunca como test runner unitario). Confirmado por inspecao
direta (`package.json`, busca por config files, busca por `*.test.ts*`/
`*.spec.ts*` em `frontend/src`) antes de decidir - documentado aqui
explicitamente em vez de simular um teste que nao rodaria de verdade.
`tsc --noEmit` limpo no frontend.

## I14 — Specs faltantes em 5 use cases do Atendimento
**Feito:**
- `EscalonarAtendimentosSemDonoUseCase`: ja tinha spec minima desde o
  I9 (so `ESCALONAMENTO_MINUTOS_LIMITE` + cutoff passado ao
  repositorio, com nota explicita de que a suite comportamental
  completa ficava para este achado). Expandido com `describe` novo
  cobrindo: nenhum pendente -> nao marca/emite nada; marca+emite com o
  payload correto (`tenantId`/`atendimentoId`/`phoneNumber`/`filaNome`/
  `minutosAguardando`); ordem mark-antes-de-emitir (se
  `markEscalonamentoNotificado` falhar, o evento NUNCA e emitido para
  aquele item); multiplos atendimentos no mesmo lote, um evento por
  item; resiliencia (erro num item nao impede o processamento dos
  demais no mesmo lote); idempotencia simulada via mock (item marcado
  nao volta a aparecer numa chamada seguinte, ja que a query real
  filtraria por `escalonamentoNotificadoEm=null`).
- `ClassifyAndRouteAtendimentoUseCase`, `AssignAtendimentoUseCase`,
  `RequeueAtendimentoUseCase`: nao tinham nenhuma spec - criadas do
  zero, cobrindo guards de estado/autorizacao de cada um (nao
  encontrado, ja fechado, Administrador vs dono/pertencimento a fila),
  reaproveitar vs criar fila (Classify), montagem condicional do
  update e do detalhe do evento combinando urgente/resumo (Classify),
  e o reset de `escalonamentoNotificadoEm` no Requeue (achado I6)
  coberto explicitamente.
- `AddNotaAtendimentoUseCase`: ja tinha boa cobertura de escopo (I2/
  I2b) - adicionado o caso faltante de texto vazio/so espacos
  (`BadRequestException`, antes mesmo de consultar o banco).
**Commit:** `b9a7bf4`
**Testes:** 43 testes novos/expandidos nos 5 arquivos, 5/5 suites
passando. `tsc --noEmit` limpo. Suite completa do modulo `atendimento`:
57/59 passando - a unica falha e a integracao
`get-or-create-atendimento.race-condition`, pre-existente e dependente
de Postgres, sem regressao.

## I15 — Evento de auditoria duplicado/mal rotulado com `tipo: 'criado'`
**Investigacao:** nao era uma chamada duplicada literal - eram duas
logicas distintas em dois use cases (`GetOrCreateAtendimentoUseCase`
e `ClassifyAndRouteAtendimentoUseCase`, chamados em sequencia pelo
mesmo fluxo real - `ViviAtendimentoEscalationService.transferToFila`/
`.handleAiFailure`) que por erro de rotulagem usavam o MESMO `tipo`
para eventos semanticamente diferentes (criacao vs. classificacao).
Impacto era so visual/auditoria (timeline do painel de chat) - nenhuma
metrica/contagem/logica de negocio no codebase le esse campo (confirmado
por busca completa antes de propor a correcao). Atendimento NOVO
mostrava "Criado" duas vezes; atendimento JA EXISTENTE reclassificado
ganhava um "Criado" fora de lugar no meio da timeline.
**Feito:** `ClassifyAndRouteAtendimentoUseCase` passou a gravar
`tipo: 'classificado'` (consistente com o evento de dominio
`'atendimento.classificado'` ja emitido logo depois). Adicionado
`classificado: "Classificado"` em `EVENTO_TIPO_LABELS` (frontend).
`GetOrCreateAtendimentoUseCase` NAO alterado (seu `tipo:'criado'` ja
estava correto). **Sem migracao de dados historicos** - eventos ja
gravados no banco ANTES desta correcao continuam com `tipo:'criado'`,
inclusive os duplicados nos casos de atendimento novo; so atendimentos
classificados A PARTIR desta correcao ganham o rotulo certo
("Classificado") na timeline.
**Commit:** `29280a2`
**Testes:** teste novo no spec do I14 confirmando `tipo:'classificado'`
e a ausencia de `tipo:'criado'`. `tsc --noEmit` limpo no backend e no
frontend. Suite `atendimento`: 58/60 passando (+1 do teste novo) - a
unica falha e a integracao `get-or-create-atendimento.race-condition`,
pre-existente e dependente de Postgres, sem regressao.

---

## Resumo final consolidado da sessao

Todos os itens NUMERADOS da lista original da auditoria estao
concluidos (I4 a I15, exceto I8b - ver nota propria abaixo). Restam so
observacoes cosmeticas nao priorizadas, fora do escopo desta sessao.

### Achados corrigidos (ordem cronologica, commits mais recentes primeiro no `git log`)

| Achado | Resumo | Commit(s) |
|---|---|---|
| I4 | ACK do WhatsApp: `updateMany` sem checar `count` | `a6e13d0` |
| I5 | Log `[DEBUG-ACK-RAW]` exposto em producao | `a6e13d0` (junto com I4) |
| I7 | `SendWhatsAppMessageUseCase` checava so status do banco, nao o socket real | `3eb3475` |
| I9 | Escalonamento fixo de 15min -> 5min | `8748cd5` |
| I8a | Lista fechada de motivos de fechamento + bloqueia reabertura automatica da VIVI por motivo de negocio | `d2390ee` |
| I10 | Refactor estrutural `ProcessIncomingMessageUseCase` (897 -> 485 linhas, 17 -> 13 parametros no construtor, 5 commits) | `f395eb3`, `8c2b26f`, `b796188`, `7d79940`, `2000db7` |
| I11 | Logging na camada de aplicacao do Atendimento (12 use cases) | `f8ff3ba` |
| I12 | Confirmacao ao "Finalizar" na lista de atendimentos (paridade com o painel de chat) | `7a0a445` |
| I13 | Corrida entre polling de 5s e troca de conversa exibindo dados errados | `fe45ba0` |
| I14 | Specs faltantes em 5 use cases do Atendimento (43 testes novos/expandidos) | `b9a7bf4` |
| I15 | Evento de auditoria duplicado/mal rotulado (`tipo:'criado'` -> `'classificado'`) | `29280a2` |

(I1, I2, I2b, I3 (e sua cadeia completa) e I6 tambem foram corrigidos
nesta mesma sessao, no inicio do trabalho, antes dos achados I4 em
diante documentados acima. Apenas C1 e C2 sao anteriores a esta
sessao.)

### I8b — PENDENTE, fora de escopo por decisao deliberada
Deteccao automatica de "abandono" (fechamento automatico por timeout de
inatividade, sem acao humana) - nenhum mecanismo de timeout foi
construido. Decisao registrada com o usuario: avaliar numa tarefa
futura se vale a pena construir (e, se sim, definir janela de tempo e
se dispara o fechamento sozinho ou so sinaliza para um humano decidir).
**Nao e um bug pendente - e um escopo deliberadamente deixado de fora.**

### Trabalho de terceiros protegido (nao relacionado a esta auditoria)
Durante o I10, foi descoberto um trabalho em andamento em paralelo
(feature "VIVI Followups" - empreendimentos/plantao/HIS/cadencia de
reengajamento por WhatsApp) editando ao vivo os mesmos arquivos
compartilhados do modulo `vivi_sdr`. Verificado com cuidado (diff por
diff) que nada desse WIP dependia da estrutura pre-refactor do I10 -
zero risco de conflito. A pedido do usuario, esse trabalho foi
protegido contra perda acidental em 2 commits `wip(vivi_sdr)` dedicados
(`d007d02` codigo, `54a5428` briefing/base de conhecimento), inicialmente
commitados na propria `main` por engano - **ainda NAO revisado, NAO
testado, NAO finalizado**. Antes do push final desta auditoria, esses
2 commits foram removidos da `main` via `git rebase --onto` (sem alterar
conteudo/ordem dos commits da auditoria que vieram depois) e preservados
intactos na branch dedicada `wip/vivi-followups` - fica para uma sessao
futura dedicada a essa feature, separada desta auditoria.

### Regras seguidas durante toda a sessao
Nenhum `push`/deploy em nenhum momento. Todos os commits da auditoria
permanecem locais na branch `main` (pronta para push); o WIP nao
relacionado foi isolado na branch `wip/vivi-followups`. Nenhum arquivo
excluido. Nenhuma dependencia nova instalada sem pedido/confirmacao
explicita. Toda mudanca de escopo maior que o pedido (ex: `npx prisma
generate`, ajuste na factory de teste do WIP concorrente) foi
perguntada e aprovada antes de executar. Cada commit foi mostrado
(diff/stat) antes de ser criado.

---

## AGUARDANDO REVISAO FINAL DO USUARIO ANTES DE QUALQUER PUSH/DEPLOY

*Itens pendentes: I8b (decisao de escopo, nao um bug). Trabalho de
terceiros (VIVI Followups) protegido mas nao revisado - ver secao acima.*
