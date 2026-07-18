# Progresso do Ecossistema gestordevendas

## Sessao 18/07/2026 - Super Usuario (dono da plataforma SaaS) - 3 fatias - CONCLUIDO
Fecha a PRIORIDADE 1 registrada no BACKLOG.md/PROGRESS.md. Diagnostico
previo (sem alterar codigo) confirmou 3 pontos criticos antes de
projetar a arquitetura: (1) `JwtStrategy.validate()` confia nos claims
do JWT sem re-consultar o banco por request; (2) todo o isolamento de
tenants hoje depende de `tenantId` vindo do JWT e passado explicitamente
para cada use case/repositorio (`findByIdAndTenant`/`findAllByTenant`);
(3) nao existia NENHUM conceito de "plataforma" no codigo - seria
construido do zero.

**Decisao de arquitetura**: em vez de espalhar "se for Super Usuario,
ignore o filtro de tenant" por dezenas de use cases (arriscado), o
Super Usuario nunca opera diretamente nos dados de um tenant - ele so
tem acesso a UMA leitura cross-tenant (lista de tenants) e UMA acao
(impersonar). Ao "entrar como Administrador" de um tenant, ele recebe
um JWT normal de Administrador DAQUELE tenant - toda a maquinaria de
isolamento ja existente continua funcionando sem nenhuma mudanca.

- Tenant reservado "Plataforma" + Role "Super Usuario" (constantes em
  `shared/domain/constants/super-usuario.ts`), criados SO via
  `scripts/seed-super-usuario.ts` (`npm run seed:super-usuario`,
  mesmo padrao do `seed:admin` ja existente) - nunca uma rota HTTP.
  Confirmado por leitura de codigo (nao e suposicao): nenhum fluxo
  normal do sistema (cadastro publico, aprovacao, criacao de corretor,
  `UpdateUserCargoUseCase`) aceita nome de Role como entrada livre, e
  nao existe hoje nenhuma rota que troque a Role de um usuario ja
  criado - Role so e definida na criacao, sempre hardcoded no proprio
  use case.
- Modulo novo `super_usuario`: `ListTenantsUseCase` (UNICA leitura
  cross-tenant deliberada do sistema inteiro, com checagem de role em
  profundidade alem do `RolesGuard` do controller) e
  `ImpersonarTenantUseCase` (acha o primeiro Administrador do tenant
  escolhido - `IUserRepository.findAllByTenantAndRole` ganhou
  `orderBy: createdAt asc` pra isso ser deterministico -, emite um JWT
  de vida CURTA, 2h - bem menor que o padrao de 1-30 dias -, com o
  claim extra `impersonadoPor`, e grava a auditoria).
- Exclusao do tenant "Plataforma" da listagem por uma propriedade
  ESTRUTURAL (ter uma Role chamada "Super Usuario"), nao pelo nome do
  tenant - `Tenant.name` e editavel por qualquer Administrador (aba
  "Dados da Empresa"), entao filtrar por nome seria fragil a uma
  renomeacao acidental ou deliberada.
- `AcessoPlataformaLog` (nova tabela): `tenantId` NULLABLE com
  `onDelete: SetNull` (nao Cascade) + `tenantNome` snapshot - o log de
  auditoria deve sobreviver mesmo se o tenant acessado for excluido no
  futuro, diferente de toda outra relacao tenant-scoped do sistema
  (que sempre usa Cascade).
- `JwtStrategy`/`GetMeUseCase` passaram a expor `impersonadoPor` (claim
  do JWT, nao campo do banco) - prepara a barra de "modo simulacao" da
  Fatia 2 sem precisar de endpoint novo.

Testado de ponta a ponta em PRODUCAO (2 tenants + 1 Super Usuario
descartaveis, criados/removidos via Prisma direto, migration aplicada
de verdade): listagem retornou exatamente os 2 tenants de teste com
`totalUsuarios` correto e SEM o tenant "Plataforma"; impersonacao
emitiu um token cujo `/auth/me` mostrou o Administrador REAL do tenant
(nome/e-mail corretos) com `impersonadoPor` preenchido; esse mesmo
token chamou `GET /pipelines` normalmente (200, lista vazia) - prova
que a maquinaria de isolamento existente funciona sem nenhuma alteracao
para um token de impersonacao. `AcessoPlataformaLog` confirmado com 1
registro correto. Testes negativos: Administrador comum tentando
listar tenants (403) ou impersonar (403), e impersonar um tenant
inexistente (404) - todos bloqueados como esperado. Achado a parte
(dado real de producao, nao tocado): a listagem tambem revelou 2
tenants reais ja existentes - "Gestor de Vendas - Admin" (o
`seed:admin` de producao) e "TESTE Debug Sidebar" (resíduo aparente de
uma investigacao antiga) - registrado aqui so como observacao, decisao
de limpar fica para o usuario. Antes da aprovacao final, o codigo foi
testado numa copia temporaria dos arquivos direto na VPS (sem commit),
revertido via `git checkout` apos o teste (mantendo a migration/coluna
aplicada, mesmo padrao ja usado no Onboarding do Corretor), e so depois
da aprovacao o commit real foi feito e re-deployado (so backend -
frontend nao muda nesta fatia).

- **Fatia 2 (frontend)**: Login/`/` passam a redirecionar role "Super
  Usuario" para `/super-usuario` (antes de qualquer logica de
  DASHBOARD_ROLES/cargo) - tela fora do layout do dashboard normal,
  lista de tenants com botao "Entrar como Administrador" por linha.
  Novo `ImpersonationBanner` (renderizado no layout do dashboard,
  visivel em qualquer pagina) mostra "Modo simulacao: voce esta
  atuando como Administrador de \<tenant\>" enquanto `/auth/me`
  retornar `impersonadoPor` preenchido, com botao "Sair da simulacao"
  que desloga por completo.
- **Fatia 3 (auditoria visivel + reforco)**: `ListAcessosPlataformaUseCase`
  novo (`GET /super-usuario/meus-acessos`) - cada Super Usuario ve so
  os PROPRIOS acessos, ordenados do mais recente pro mais antigo.
  `/super-usuario` ganhou abas "Tenants"/"Meus Acessos". **Correcao em
  relacao ao planejado**: a confirmacao extra ao impersonar (digitar o
  nome exato do tenant) NAO tinha sido implementada na Fatia 2 como se
  pensava - implementada agora, como modal bloqueando o botao
  "Confirmar" ate o nome digitado bater exatamente com o nome do
  tenant. Testes de seguranca DEDICADOS (via API real, nao so leitura
  de codigo): `POST /rh/cadastro-publico` e
  `PATCH /rh/usuarios-hierarquia/:id` com campos `role`/`roleId`
  injetados no payload - ambos rejeitados com 400 pelo `ValidationPipe`
  global (`whitelist: true` + `forbidNonWhitelisted: true`), provando
  em tempo de execucao (nao so por leitura de codigo) que nenhum
  caminho normal do sistema aceita promover alguem a "Super Usuario".

Testado de ponta a ponta em cada fatia (tenants/Super Usuario
descartaveis criados/removidos via Prisma direto na VPS, migration da
Fatia 1 aplicada de verdade e mantida entre as fatias): fluxo completo
login -> lista de tenants -> impersonar (com confirmacao) -> banner
persistente entre paginas do dashboard -> sair da simulacao, historico
de acessos mostrando os registros corretos na ordem certa, e os 2
testes de injecao de campo de role confirmados bloqueados. Antes de
cada aprovacao final, o codigo foi testado numa copia temporaria dos
arquivos direto na VPS (sem commit), revertido via `git checkout` apos
o teste, e so depois da aprovacao o commit real foi feito e
re-deployado.

## Sessao 18/07/2026 - Notificacao de lead atribuido pela Roleta Online - CONCLUIDO
Fecha o item registrado no BACKLOG.md ("Futuro modulo Roleta Online" ->
"Notificacao de lead atribuido"). O sino de notificacoes in-app
(`NotificationBell.tsx`) e o model `Notification` ja existiam (Fatia 5
do Painel Administrativo) - faltava so o GATILHO, 100% backend, nenhuma
mudanca de frontend nesta fatia.

`DistributeLeadUseCase` (modo `automatico`) e `ConfirmSuggestedOwnerUseCase`
(ao confirmar a sugestao, modo `semi_automatico`) passam a emitir o
evento generico `'lead.atribuido'` `{tenantId, cardId, ownerId}` logo
apos `ClaimCardUseCase` - decisao confirmada: so quando o lead REALMENTE
vira dono de alguem, nunca so no momento da sugestao (testado
explicitamente - nenhuma notificacao e criada so por
`updateSuggestedOwner`, so depois do `POST /cards/:id/confirmar-sugestao`).

Novo `LeadAtribuidoListener` (modulo `notificacoes`, mesmo padrao de
evento generico desacoplado ja usado por `CardSemDonoCriadoListener`/
`CadastroPendenteCriadoListener`) busca o titulo do card + o nome da
stage atual (`ICardRepository`/`IStageRepository`, ja exportados por
`VendasKanbanModule` - `NotificacoesModule` passou a importa-lo, mesma
dependencia de modulo nao-circular ja usada por `roleta_online`) e cria
a `Notification` com mensagem `"Novo lead atribuido: <titulo>
(<estagio>)"` e `link` direto pro card no Kanban
(`/dashboard/kanban?pipelineId=&cardId=`, mesmo formato de deep-link ja
usado pelo Dashboard do Corretor - Fatia 2) - o sino ja sabia navegar
por esse link sem nenhuma mudanca.

Testado de ponta a ponta contra PRODUCAO (sem banco local disponivel
nesta sessao, mesma limitacao das fatias anteriores): tenant/
Administrador/2 corretores online de teste, pipeline padrao criado via
API real, card criado via `POST /cards/quick` (simulando webhook) com a
Roleta em modo `automatico` - notificacao correta confirmada para o
corretor escolhido pelo round_robin. Roleta trocada para
`semi_automatico`, novo card criado - confirmado que NENHUMA notificacao
nova aparece so com a sugestao pendente; so apos
`POST /cards/:id/confirmar-sugestao` (pelo corretor sugerido certo -
uma tentativa inicial com o corretor errado corretamente barrada com
409/403, confirmando que o bloqueio de seguranca pre-existente
continua intacto) a notificacao foi criada, com mensagem e link
corretos. Antes da aprovacao final, o codigo foi testado numa copia
temporaria dos arquivos direto na VPS (sem commit, sem migration
envolvida desta vez), revertido via `git checkout` apos o teste, e so
depois da aprovacao o commit real foi feito e re-deployado (so backend
- frontend nao mudou nesta fatia). Tenant de teste removido ao final
via cascata.

## Sessao 18/07/2026 - Onboarding do Corretor (troca de senha obrigatoria) - CONCLUIDO
Fecha o item registrado no BACKLOG.md ("Modulo RH" -> "Fluxo de
onboarding do Corretor"). `User.mustChangePassword` (Boolean, default
`false`, migration `20260718010000_add_must_change_password`) - gravado
`true` SO por `CreateCorretorUseCase` (Administrador cadastrando um
corretor), mesmo quando ele digita a senha manualmente em vez de deixar
gerar automaticamente (decisao confirmada com o usuario: o corretor
nunca escolheu essa senha nos dois casos). Cadastro publico e demais
fluxos continuam default `false` sem nenhuma mudanca de codigo.

`PrismaUserRepository.updatePassword` passou a zerar
`mustChangePassword` automaticamente a cada troca de senha real - como
tanto `UpdateMyProfileUseCase` ("Meu Perfil") quanto `ResetPasswordUseCase`
("Esqueci minha senha") ja chamam esse mesmo metodo, nenhum dos dois
precisou de alteracao propria. `AuthenticateUserUseCase`,
`VerifyTwoFactorCodeUseCase` e `GetMeUseCase` passaram a devolver o
flag (mesmo padrao ja usado para `cargoHierarquico`).

Frontend: nova rota `/trocar-senha-obrigatoria` (fora do layout do
dashboard, mesmo padrao de `/minha-conta`) - formulario de senha
atual/nova/confirmacao reaproveitando `PATCH /auth/me` ja existente.
Login e `/` checam `mustChangePassword` ANTES de qualquer logica de
role/cargo hierarquico e redirecionam pra la; ao trocar com sucesso,
o proprio formulario decide o destino certo (Kanban ou Dashboard do
Corretor) reaproveitando a mesma logica de `ehCargoSupervisor()`.
Texto do e-mail padrao de boas-vindas (`boas_vindas_corretor`) ajustado
para deixar clara a obrigatoriedade - so afeta tenants novos, os que ja
tem o proprio `EmailTemplate` materializado nao mudam sozinhos.

**Decisao deliberada de escopo** (confirmada com o usuario antes de
codar): o reforço fica só no frontend (login/`/` redirecionam) - não
existe um guard novo no backend bloqueando chamadas de API do
dashboard enquanto `mustChangePassword=true`. Mesmo tipo de gap já
aceito em outras partes do projeto (ver CLAUDE.md, controle de acesso
por role) - se um usuário digitar uma URL do dashboard direto na barra
sem passar pelo redirecionamento, as chamadas de API continuam
funcionando. Avaliar no futuro se isso incomoda na prática.

Testado de ponta a ponta com Playwright real contra PRODUCAO (sem
banco local disponivel nesta sessao): migration aplicada na VPS antes
do teste (`prisma migrate deploy`), tenant/Administrador de teste
criados direto via Prisma, corretor de teste criado pela API REAL
(`POST /rh/corretores`, com o e-mail de teste do Resend
`delivered@resend.dev` para não disparar e-mail de verdade a ninguem)
- confirmado que `mustChangePassword=true` foi gravado pelo caminho
real de codigo, nao so por insercao direta no banco. Login com a senha
temporaria redirecionou para `/trocar-senha-obrigatoria`; apos trocar,
redirecionou para `/dashboard/inicio` (corretor novo, sem cargo); um
segundo login (nova sessao) com a senha JA TROCADA foi direto para o
dashboard, sem forçar a troca de novo. Antes da aprovacao final, o
codigo foi testado numa copia temporaria dos arquivos direto na VPS
(sem commit) - a migration em si foi aplicada de verdade (adicionar
uma coluna com default seguro nao e uma operacao destrutiva) e mantida
mesmo durante o revert do codigo (so o codigo foi revertido via `git
checkout`, a coluna ficou no banco ate a aprovacao final, quando o
commit real foi feito e `prisma migrate deploy` so confirmou "no
pending migrations" - idempotente). Tenant de teste removido ao final
via cascata.

## Sessao 17-18/07/2026 - Dashboard do Corretor (2 fatias) - CONCLUIDO
Fecha a lacuna registrada no BACKLOG.md ("Dashboard do Corretor"): nova
tela `/dashboard/inicio`, landing page padrao para quem NAO supervisiona
equipe (role Corretor/Corretor Parceiro sem cargo hierarquico de
supervisao) - Administrador e quem tem cargo Diretor/Gerente/
Coordenador continuam indo direto pro Kanban, como antes.

- **Fatia 1**: `GetMeuDashboardUseCase` (modulo `vendas_kanban`) -
  resumo dos proprios leads por etapa (contagem), atividades de hoje
  ainda pendentes (join `Activity`->`Card.ownerId`, janela do dia em
  horario local do processo) e os 5 ultimos leads recebidos. Rota nova
  `GET /pipelines/meu-dashboard`, sempre escopada a `ownerId =
  requesterUserId` (independente de cargo/RBAC - e sempre "o que e
  meu", diferente do escopo todos/equipe/plantao usado no Kanban).
  Login/`/` passam a decidir a landing page por `role` +
  `cargoHierarquico` (`ehCargoSupervisor()`, novo em
  `core/constants/cargoHierarquico.ts`) - a resposta de login
  (`AuthenticateUserUseCase`/`VerifyTwoFactorCodeUseCase`) passou a
  incluir `cargoHierarquico` no objeto `user` pra essa decisao nao
  exigir uma chamada extra a `/auth/me`. Item "Inicio" novo no
  Sidebar. `ACTIVITY_TYPE_OPTIONS` extraido de
  `CardDetailPanel.tsx` para `core/constants/activityTypes.ts`
  (reaproveitado agora pelos dois lugares).
- **Fatia 2**: badge de origem do lead na lista "Ultimos leads
  recebidos" (`vivi_repique` -> "VIVI" azul, `roleta_online` ->
  "Roleta" verde, `webhook` -> "Web" cinza, `manual` sem badge - cores
  proprias deste contexto, deliberadamente distintas do badge de
  origem ja existente no `KanbanCard`, que continua igual). Clique num
  lead ou numa atividade do dia navega para
  `/dashboard/kanban?pipelineId=&cardId=` com o card correspondente ja
  aberto e destacado (`highlightedCardId` novo no `useKanbanStore`,
  com scroll automatico ate o card). Poll silencioso de 60s (mesmo
  padrao ja usado em `/dashboard/atendimento`) atualiza os dados sem
  piscar a tela.

Testado de ponta a ponta com Playwright real contra PRODUCAO (sem
banco local disponivel nesta sessao) - tenant/corretor/pipeline/cards
de teste criados direto via Prisma na propria VPS (script descartavel,
sem tocar dados reais), removidos ao final via cascata. Confirmado:
redirecionamento certo por cargo (Administrador e Gerente -> Kanban;
Corretor -> Inicio); os 4 badges de origem corretos; clique em lead e
em atividade do dia abrindo o card certo, destacado, no Kanban; poll de
60s sem o spinner de carregamento reaparecer (um falso-positivo do
proprio script de teste, capturado no instante exato da transicao de
rota entre login e o dashboard, foi investigado e descartado - nao era
um bug real). Antes da aprovacao final de cada fatia, o codigo foi
testado numa copia temporaria dos arquivos direto na VPS (sem commit),
depois revertido (`git checkout`) e a VPS trazida de volta ao ultimo
commit aprovado - so depois da aprovacao explicita o commit real foi
feito e re-deployado.

## Sessao 13-15/07/2026 - VIVI escopo completo, Kanban, Atendimento, RH, seguranca, Painel Administrativo, RBAC por cargo, Plantao/Stand - resumo

Sessao muito longa, 14 frentes concluidas e deployadas em producao, cada
uma com commit(s) proprio(s) e verificacao de ponta a ponta antes do
deploy seguinte. Fecha com o Painel Administrativo completo (5 fatias), o
RBAC por cargo hierarquico (3 fatias) e o modulo Plantao/Stand (3 fatias)
- ver secoes proprias abaixo.

### VIVI - escopo completo do documento original de instrucoes (5 fatias) - CONCLUIDO
Documento original de instrucoes da VIVI (encontrado pelo usuario)
descrevia um escopo bem maior do que o implementado ate entao. 5 fatias
implementadas em sequencia, cada uma testada com chamada REAL a API da
Anthropic (Claude Haiku, sem mock) antes de avancar:
- **Fatia 1**: meta absoluta da VIVI vira agendar uma visita presencial
  (qualificacao passa a ser o meio, nao o fim). Nova tool
  `agendar_visita` (dataVisita, horario, imovelInteresse) ->
  `AgendarVisitaUseCase` cria Card + Activity tipo "visita".
  `ViviConversation` ganha `visitaAgendadaEm`. Injecao da data de hoje
  no prompt (sem isso o modelo chutava o ano errado em datas relativas).
- **Fatia 2**: 3 blocos de conhecimento de fundo no prompt (financiamento
  80/20 Caixa/construtora, Evolucao de Obra - analogia do restaurante -,
  regra de preco "a partir de R$ 264 mil") - usados com reciprocidade,
  nunca despejados de uma vez.
- **Fatia 3**: `classificarRenda()` (funcao pura de dominio) classifica a
  renda declarada em HIS1/HIS2/HMP/R2V/SEM_PERFIL por faixa fixa -
  classificacao SEMPRE em codigo, nunca pela IA. Cada faixa usa um
  argumento de venda diferente no prompt, sem nunca revelar a sigla ao
  lead.
- **Fatia 4**: apos visita confirmada, loop de captura pos-visita (data
  de nascimento + e-mail, tipo de renda, declaracao de IR se autonomo) via
  nova tool `salvar_dados_pos_visita` (rejeitada em codigo se ainda nao
  ha visita agendada). Deteccao de urgencia ("quero falar com uma
  pessoa") aciona `transferir_para_fila` com `urgente=true`, badge
  visual na Central de Atendimento.
- **Fatia 5**: correcao de design - "Repique" (leads SEM_PERFIL) deixa de
  ser uma Fila da Central de Atendimento e vira uma **Stage fixa do
  Kanban** (ultima coluna, deposito estrategico para remarketing
  futuro). `transferir_para_corretor` ganha motivo `"sem_perfil"`,
  cria Card direto na coluna Repique sem disparar a Roleta Online. Nova
  funcao `buildResumoAtendimento()` monta um resumo automatico (nome,
  telefone, tipo de imovel, renda/categoria interna, regiao, finalidade,
  visita, dados pos-visita, urgencia) gravado em `Card.description`
  toda vez que a VIVI cria um Card.

2 bugs reais encontrados e corrigidos durante os testes: duplicacao de
Card quando a IA re-chamava `agendar_visita` no mesmo turno (resolvido
com idempotencia via `existingCardId`), e `salvar_dados_pos_visita`
as vezes chamada sem `tipoRenda` no mesmo turno (resolvido reforcando o
prompt a exigir a chamada na MESMA resposta). Deploy: 5 commits
separados por fatia + script de backfill (`Repique` como Stage nos
pipelines existentes) rodado em producao. Confirmado em producao com
teste real: lead SEM_PERFIL cai na coluna Repique, Card com resumo
completo, Roleta Online nao disparada.

### Modulo Central de Atendimento - 2 bugs corrigidos - CONCLUIDO
- **Painel piscando continuamente**: o poll de 5s chamava
  `loadAtendimentoDetail()` acionando a MESMA flag de loading do
  carregamento inicial, que troca todo o conteudo do chat por um
  spinner - piscava a tela mesmo sem mensagem nova. Corrigido com um
  parametro `silent` (poll em segundo plano nao aciona mais o loading).
- **Mensagens da VIVI (OUT) nao apareciam no chat**: `toNumber` das
  mensagens OUT era gravado com o JID completo
  ("...@s.whatsapp.net"/"...@lid"), enquanto `fromNumber` (IN) e
  `Atendimento.phoneNumber` guardam so digitos - a busca de historico
  (`findRecentBySessionAndNumber`, tambem usada pela VIVI para montar o
  proprio historico de conversa) nunca batia no lado OUT. Corrigido
  gravando so digitos; backfill rodado em producao corrigiu **27
  mensagens antigas malformadas**.

### Kanban - melhorias (renomear/excluir/nova coluna, multiplos pipelines) - CONCLUIDO
Diagnostico revelou que reordenar colunas por arraste **ja estava
implementado** ponta a ponta (backend `MoveStageUseCase` + frontend
`@hello-pangea/dnd`) - so nao tinha sido percebido. Implementado nesta
fatia: renomear coluna (duplo-clique ou lapis, inline), excluir coluna
(lixeira, bloqueada se tiver cards dentro ou se protegida), "+
Adicionar Coluna" no final do board, seletor de multiplos funis no
cabecalho + "+ Novo Funil". Colunas **"Fechamento" e "Repique"** sao
protegidas (rename/delete bloqueados no backend, nao so escondidos na
UI) por serem referenciadas por nome literal na Roleta Online e na
VIVI. Testado de ponta a ponta com Playwright real (renomear, criar,
excluir, trocar de funil, e os 4 bloqueios de seguranca testados direto
via API).

### RH - contrato automatico de prestacao de servico - CONCLUIDO (Fatias 1+2)
- **Fatia 1**: `AprovarCadastroUseCase` bloqueia a aprovacao de
  Corretor/Corretor Parceiro/Imobiliaria Parceira se faltar CPF, ou
  CRECI (pessoa fisica)/CNPJ (Imobiliaria Parceira). Novo model
  `ContratoTemplate` (texto com placeholders, por tenant, guardado no
  banco - nao fixo no codigo, ja pensando na Fatia 3) com um modelo
  generico de teste criado automaticamente na primeira aprovacao que
  precisar dele (NAO e assessoria juridica - revisar com advogado antes
  de usar como contrato real). `GerarPdfContratoService` desenha o
  texto preenchido num PDF A4 multi-pagina via `pdf-lib`. O contrato
  vira um `SignatureEnvelope` real, criado e enviado automaticamente
  (reaproveitando `CreateEnvelopeUseCase`/`SendEnvelopeUseCase` do
  modulo edoc).
- **Fatia 2**: `User` ganha `contratoPrestacaoServicoEnvelopeId` (FK
  para o envelope) - rastreamento visivel numa nova aba "Aprovados" na
  tela de Aprovacoes (badge de status do contrato + link direto para o
  envelope no E-doc).
- **Gap resolvido durante a Fatia 1**: `Tenant` nao tinha CNPJ/endereco
  proprios para qualificar o CONTRATANTE no contrato. Novo modulo
  `configuracoes` (dono canonico desses dados, `GET/PATCH
  /configuracoes/empresa`, so Administrador edita) com tela em
  `/dashboard/configuracoes`.

Testado de ponta a ponta com Playwright real (bloqueio de aprovacao sem
CPF, aprovacao completa gerando o contrato, dados da empresa preenchidos
pela UI alimentando o texto do contrato, aba "Aprovados" mostrando o
status e o link certo). RH Fatia 3 (template editavel pelo
Administrador) registrada no BACKLOG.md como proximo passo natural.

### Sidebar - investigacao de bug + rename - CONCLUIDO
Usuario reportou "Equipe"/"Aprovacoes" sumindo do menu. Investigado a
fundo (codigo-fonte, dados do usuario real em producao, teste ao vivo
com conta admin nova contra producao) - **nao havia bug de codigo**:
role do usuario e o filtro do Sidebar estavam corretos, o menu renderizou
normalmente no teste. Causa mais provavel: chunk JS desatualizado numa
aba aberta durante os varios deploys seguidos do dia (resolve com hard
refresh). Aproveitado para renomear "Aprovacoes" -> "RH" no menu
(icone trocado de UserCheck para Briefcase, evitando repetir o Users ja
usado em "Equipe").

### Rate limiting no login + helmet + log de auditoria (Fase C parcial) - CONCLUIDO
Primeira fatia de hardening de seguranca (Fase C), disparada por pedido
explicito do usuario ("seguranca urgente"). Sem NENHUM pacote de rate
limiting/seguranca instalado antes desta fatia - `@nestjs/throttler` e
`helmet` sao dependencias novas, aprovadas explicitamente antes de
instalar.

- `ThrottlerModule` global (`APP_GUARD`, throttler nomeado `default`,
  100 req/min por IP) + `@Throttle` sobrescrevendo so a rota
  `POST /auth/login` para 5 tentativas / 15 min (429 depois disso) -
  um so throttler nomeado, nao dois, para o override por decorator
  funcionar (dois throttlers nomeados aplicariam AMBOS os limites a
  TODAS as rotas, nao so a de login).
- `app.set('trust proxy', 1)` em `main.ts` - necessario porque a VPS
  roda atras de nginx (reverse proxy); confirmado via SSH que o nginx ja
  envia `X-Forwarded-For`/`X-Real-IP` num unico hop - sem isso, todo
  mundo apareceria com o IP do proprio nginx e um usuario bloqueado
  bloquearia todos os outros.
- `helmet()` em `main.ts` com `crossOriginResourcePolicy: 'cross-origin'`
  - o default do helmet (`same-origin`) quebraria o carregamento das
    fotos de imoveis/documentos em `/uploads`, servidas pelo backend e
    consumidas pelo frontend numa origem separada (`NEXT_PUBLIC_API_URL`).
    Testado explicitamente apos aplicar (header confirmado tanto em
    `/auth/login` quanto em `/uploads/*`).
- `AuthenticateUserUseCase` loga um `WARN` (Logger nativo do NestJS, sem
  pacote novo) a cada tentativa de login com falha (e-mail inexistente
  ou senha errada), com e-mail + IP + timestamp - visivel via
  `pm2 logs`. Decisao deliberada de NAO usar `pino`/logger estruturado
  nesta fatia (pino ja e dependencia do projeto, mas so usado hoje para
  silenciar o log interno do Baileys - nao ha logger de aplicacao
  configurado ainda, fica para uma fatia futura de Fase C se fizer
  falta).

Achado curioso durante o teste em producao: a primeira tentativa de
testar `/auth/login` direto bateu 404 - a API de producao fica sob
`/api/` (nginx remove esse prefixo ao repassar pro backend,
`/api/auth/login` chega la como `/auth/login`), diferente do dev local
(sem prefixo). Corrigido no proprio teste, sem mudanca de codigo.

Testado em producao de verdade (nao so local): 6 tentativas de login
errado em `https://gestordevendas.ivillar.com.br/api/auth/login` - 5x
401, 6a retornou 429; `pm2 logs` confirmou os 5 WARNs com o IP REAL do
cliente (nao `127.0.0.1`/loopback), confirmando que `trust proxy` esta
funcionando corretamente atras do nginx.

Nota lateral (nao e problema de seguranca, so registro): o pacote
oficial `dotenv` (v17.4.2, ja usado no projeto) imprime uma linha de
autopromocao ("dica") no console a cada `.config()` chamado, incluindo
no boot do backend em producao (`pm2 logs`) - confirmado lendo o
proprio `CHANGELOG.md`/codigo-fonte do pacote instalado, nao e injecao
nem pacote comprometido. Cosmetico, nao foi silenciado.

Pendente ainda dentro da Fase C (nao coberto por esta fatia): testes
automatizados, logs estruturados/monitoramento mais amplo (alem do
`Logger` pontual do login), revisao de seguranca mais ampla.

### RH Fatia 3 - template de contrato editavel pelo Administrador - CONCLUIDO
Fecha a ultima pendencia do modulo RH (Fatias 1+2 do contrato automatico
de prestacao de servico ja estavam concluidas - ver secao propria mais
acima). Antes desta fatia, `ContratoTemplate` ja existia no banco (model
pronto desde a Fatia 1) mas sem NENHUM endpoint HTTP - so `create` e
`findPadraoByTenant` no repositorio, usados internamente pelo
`GetOrCreateContratoTemplateUseCase`. Escopo desta fatia foi
deliberadamente limitado a editar o template padrao UNICO existente por
tenant (nao "multiplos templates") - o proprio backlog so pedia editar o
texto, e suportar multiplos exigiria tambem mudar
`GerarContratoPrestacaoServicoUseCase` para escolher qual usar.

Backend: `IContratoTemplateRepository.update()` + implementacao Prisma;
`UpdateContratoTemplateUseCase` (Administrador only, bloqueia corpo
vazio, reaproveita `GetOrCreateContratoTemplateUseCase` para garantir
que existe uma linha antes de atualizar); rotas
`GET/PATCH /rh/contrato-template` em `RhController`.

Frontend: nova 3a aba "Template de Contrato" em
`/dashboard/rh/aprovacoes` (`ContratoTemplateTab.tsx`) - textarea +
input de nome, lista lateral dos 9 placeholders disponiveis
(`{{NOME_TENANT}}`, `{{CNPJ_TENANT}}`, `{{ENDERECO_TENANT}}`, `{{NOME}}`,
`{{CPF}}`, `{{CRECI}}`, `{{ENDERECO}}`, `{{CEP}}`, `{{DATA_ATUAL}}`),
clicaveis para inserir na posicao do cursor. Preview em TEXTO PURO (nao
PDF, decisao deliberada para nao exigir uma chamada nova ao backend/
pdf-lib so para isso) com dados ficticios fixos, atualizado em tempo
real conforme o Administrador digita. Botao "Restaurar Padrao" so
preenche o formulario com o texto padrao (mirror local, mesmo padrao ja
usado para `DEFAULT_EMAIL_SUBJECT` no E-doc) - nao salva sozinho, o
Administrador ainda precisa clicar "Salvar" para confirmar. Texto padrao
mirror conferido programaticamente como identico byte-a-byte ao do
backend (1606 caracteres, `===` estrito) antes do teste.

Testado de ponta a ponta com Playwright real (script descartavel,
removido ao final): aba carrega o texto padrao corretamente, edicao do
corpo + nome, preview em tempo real confirmado substituindo `{{NOME}}`
por dado ficticio, clique num placeholder da lista lateral insere o
token no textarea, "Salvar" persiste (confirmado apos reload da
pagina), e o teste decisivo - um cadastro de Corretor pendente (CPF+
CRECI preenchidos) aprovado via API gerou um envelope de assinatura com
o TITULO igual ao nome EDITADO do template, confirmando que a proxima
aprovacao usa mesmo o template atualizado, nao o padrao antigo em
cache/hardcoded. Tenant de teste removido ao final (cascata).

### Painel Administrativo (5 fatias) - CONCLUIDO
Expande o modulo `configuracoes` (ate entao so "Dados da Empresa") para um
Painel Administrativo completo com 6 abas em `/dashboard/configuracoes`
(Sidebar renomeado de "Configuracoes" para "Painel Administrativo").
5 fatias implementadas em sequencia, cada uma testada com Playwright real
(script descartavel, tenant/admin de teste via Prisma, removido ao final)
antes do deploy seguinte:

- **Fatia 1** (casca + Meu Perfil + mover Template de Contrato): abas
  "Dados da Empresa" (realocada, comportamento identico) e "Meu Perfil"
  (nova - editar nome/trocar senha, `PATCH /auth/me`). A aba "Template de
  Contrato" (ja existente desde RH Fatia 3) migrou de RH/Aprovacoes pra ca
  - `ContratoTemplateTab.tsx` + as constantes de placeholder foram
  fisicamente movidas de `features/aprovacoes/` para `features/
  configuracoes/` (backend continua em `rh`, so a UI mudou de lugar).
  **Bug real pego pelo teste**: `UpdateMyProfileUseCase` usava
  `UnauthorizedException` (401) pra "senha atual incorreta" - como
  `apiRequest` do frontend trata QUALQUER 401 numa chamada autenticada
  como "sessao expirada" e forca logout, digitar a senha atual errada
  deslogava o Administrador no meio do fluxo. Corrigido pra
  `BadRequestException` (400) antes do deploy.
- **Fatia 2** (Permissoes/Cargos): nova aba lista usuarios aprovados
  (roles com hierarquia - Corretor/Imobiliaria Parceira) com cargo/
  superior atuais, editaveis a qualquer momento (antes so eram definidos
  uma vez, na aprovacao, e ficavam travados). `VALID_CARGOS_HIERARQUICOS`
  extraido de dentro de `AprovarCadastroUseCase` pra
  `domain/services/cargos-hierarquicos.ts` (fonte unica de verdade,
  reaproveitada pelos dois fluxos). `CARGO_HIERARQUICO_OPTIONS`/
  `ROLES_COM_HIERARQUIA` promovidos de `features/aprovacoes/constants.ts`
  para `core/constants/cargoHierarquico.ts` (agora usados por 2 features).
- **Fatia 3** (Configuracoes da VIVI): novo model `ViviConfig` por
  tenant - preco minimo (antes fixo em "R$ 264 mil" no prompt) e as 4
  faixas de renda (SEM_PERFIL/HIS1/HIS2/HMP - acima de HMP e R2V) viram
  editaveis. `VIVI_SYSTEM_PROMPT` (constante estatica) virou
  `buildViviSystemPrompt(config)` (funcao que interpola os 5 valores) e
  `classificarRenda()` passou a receber os limites como parametro em vez
  de hardcoded - `ProcessIncomingMessageUseCase` busca o `ViviConfig` do
  tenant no inicio do `execute()` e usa nos dois lugares. SEM toggle
  geral de liga/desliga (ja existe um controle por-sessao de WhatsApp,
  seria redundante - decisao tomada com o usuario antes de implementar).
  Fraseado do preco mudou de "R$ 264 mil" pra "R$ 264.000" (formatacao
  padrao), ja que um valor editavel nao-redondo ficaria estranho
  abreviado. Teste decisivo: `classificarRenda(3200, ...)` retorna HIS1
  com o novo limite HIS1=3500 configurado via UI, mas retornaria HIS2 com
  o limite antigo (2850) - mesma renda, categoria diferente, provando que
  a mudanca via UI realmente chega na classificacao real.
- **Fatia 4** (Templates de E-mail): novo model `EmailTemplate`
  (unico por tenant+tipo), 3 tipos migrados dos 3 pontos de e-mail
  hardcoded do fluxo de RH (`boas_vindas_corretor`, `rejeicao_cadastro`,
  `aprovacao_cadastro` - `CreateCorretorUseCase`/`RejeitarCadastroUseCase`/
  `AprovarCadastroUseCase`), com placeholders `{{NOME}}`, `{{EMAIL}}`,
  `{{EMPRESA}}`, `{{SENHA_TEMPORARIA}}`, `{{CARGO}}`, `{{PERFIL}}`. O
  texto trocou "gestordevendas" (nome do produto) por `{{EMPRESA}}` (razao
  social do tenant) - mais apropriado, ja que quem manda o e-mail e a
  imobiliaria especifica, nao a plataforma. Teste decisivo: usando
  `Test.createTestingModule` com o `AppModule` real (so `IEmailSender`
  substituido por um capturador, sem mandar e-mail de verdade via Resend),
  `RejeitarCadastroUseCase.execute()` real confirmou que o e-mail gerado
  usa o template EDITADO com `{{NOME}}` interpolado corretamente.
- **Fatia 5** (Notificacoes in-app): novo modulo `notificacoes` (model
  `Notification` por usuario, nao por tenant inteiro), sino na Topbar com
  contador de nao lidas + dropdown + poll de 5s (mesmo padrao do modulo
  Atendimento). Gatilho unico desta leva:
  `PublicSignupUseCase` (modulo `rh`) emite o evento generico
  `cadastro.pendente.criado` (desacoplado - `rh` nao conhece
  `notificacoes`, mesmo padrao ja usado em `vendas_kanban` ->
  `roleta_online`), `CadastroPendenteCriadoListener` cria 1 notificacao
  por Administrador do tenant (fan-out), engolindo qualquer erro (nunca
  derruba o cadastro publico). Teste decisivo: `PublicSignupUseCase` REAL
  chamado via `Test.createTestingModule(AppModule)` (com
  `PUBLIC_SIGNUP_TENANT_ID` trocado so durante a chamada, ja que essa env
  var e fixa pra 1 imobiliaria) confirmou 1 notificacao por Administrador
  de teste (2 no cenario), sino mostrando contador certo, clique marcando
  como lida E navegando pro link, com a notificacao do outro Admin
  permanecendo intocada (independencia por usuario confirmada).

Escopo deliberadamente NAO incluido nesta leva (registrado no BACKLOG.md
como trabalho futuro, nao esquecido): RBAC granular de verdade
(permissoes continuam fixas em `@Roles(...)` no codigo, so o cargo
hierarquico em si ficou editavel - ver secao propria logo abaixo, onde
isso e resolvido), mais gatilhos de notificacao (so "cadastro pendente"
por enquanto), e mais tipos de e-mail alem dos 3 do fluxo de RH (reset de
senha, e-mails do E-doc continuam hardcoded).

### RBAC por cargo hierarquico (3 fatias) - CONCLUIDO
Fecha a lacuna deixada pelo Painel Administrativo: o cargo hierarquico
(Diretor/Gerente/Coordenador/Corretor, ver Permissoes/Cargos acima) ate
entao era so um campo descritivo, sem nenhum efeito real de acesso -
`RolesGuard` sempre leu so `Role.name` (Administrador/Corretor/etc.),
nunca o cargo. Diagnostico previo (auditoria completa dos ~70 endpoints
do backend, todos os `@Roles()` mapeados) confirmou isso antes de
codar - cargo controla QUANTO DADO o usuario ve dentro das telas que o
Role dele ja acessa, Role continua controlando QUAIS TELAS abrem
(inalterado). Escopo final (apos discussao) deixou "Plantao" de fora
desta leva (registrado como pendencia, ver Proximos passos) - Coordenador
usa a MESMA logica hierarquica do Gerente por enquanto.

```ts
CARGO_ESCOPO = {
  diretor: { escopo: 'todos', podeExcluir: false },
  diretor_regional: { escopo: 'todos', podeExcluir: false },
  gerente: { escopo: 'equipe', podeExcluir: false },       // equipe = recursivo
  gerente_regional: { escopo: 'equipe', podeExcluir: false },
  superintendente: { escopo: 'equipe', podeExcluir: false }, // legado, tratado como gerente
  coordenador: { escopo: 'equipe', podeExcluir: false },
  corretor: { escopo: 'proprio', podeExcluir: true },       // comportamento preservado
};
// Administrador: sempre 'todos'+podeExcluir=true (bypass). Sem cargo
// definido / Corretor Parceiro: fallback 'proprio'+podeExcluir=true.
```

- **Fatia 1 (infraestrutura)**: `GetSubordinadosRecursivosUseCase` (modulo
  auth, BFS por niveis, nao 1 CTE recursiva - Prisma nao suporta isso via
  query builder) + `findAllByTenantAndSuperiorIds` (busca em lote, 1 query
  por nivel); `shared/domain/services/cargo-escopo.ts` (`resolveEscopo`/
  `podeExcluirRegistroDeNegocio`, funcoes puras); JWT ganhou o claim
  `cargo` (corrigido em 2 pontos de emissao - login direto E o fluxo de
  2FA, achado durante a auditoria de todos os `jwtService.sign()` do
  projeto); `BlockDeleteForCargoGuard` aplicado SO em
  `DELETE /cards/:id` e `DELETE /stages/:id` (as unicas 2 rotas de
  exclusao de registro de negocio abertas a `DASHBOARD_ROLES` amplo -
  as demais ja eram Administrador-only via Role, sem relacao com cargo);
  `VALID_CARGOS_HIERARQUICOS` expandido com `diretor_regional`/
  `gerente_regional`. Confirmado em producao (antes do deploy) que
  nenhum usuario real tinha cargo definido ainda - risco pratico zero no
  momento do deploy.
- **Fatia 2 (filtro de dados)**: `GetBoardUseCase` (Kanban) trocou o
  `if (role==='Corretor')` binario por `resolveEscopo()`. Caixa de
  Entrada (`GetInboxUseCase`) ficou DELIBERADAMENTE intocada - lead sem
  dono nao pertence a "equipe" nenhuma ainda. `ListAtendimentosUseCase`/
  `GetAtendimentoDetailUseCase` passaram a SOMAR o escopo por cargo ao
  filtro por fila ja existente (nao substituir) - visivel se pertencer a
  uma fila do requisitante OU se o dono estiver dentro do escopo de
  cargo dele. Achado sobre WhatsApp: `GetMyWhatsAppSessionUseCase`
  filtra so por `tenantId`, nunca por dono - e uma conexao compartilhada
  do tenant (QR/connect/disconnect), nao uma caixa de conversas por
  corretor; visibilidade de conversa real ja e coberta por Kanban +
  Atendimento, nenhuma mudanca feita ali.
- **Fatia 3 (frontend)**: `GetMeUseCase`/`/auth/me` passou a devolver
  `cargoHierarquico`. Achado real: nao existe nenhum botao de "excluir
  Card" no frontend (so backend) - nada pra esconder ali. Botao de
  excluir Stage (coluna) ganhou `core/constants/cargoEscopo.ts` (mirror
  do backend) + `podeExcluirRegistroDeNegocio` no `useKanbanStore`,
  calculado uma vez via `/auth/me` no init da pagina - o botao de
  RENOMEAR continua visivel (so excluir e bloqueado). Outros botoes de
  exclusao do sistema (fotos de imovel, filas, documentos de inquilino,
  desconectar sessao WhatsApp) NAO foram tocados - nenhum e coberto pelo
  `BlockDeleteForCargoGuard`, continuam controlados so pelo Role
  existente, sem relacao com cargo (esconde-los por cargo seria
  inconsistente com o que o backend realmente permite). RH/Financeiro/
  Painel Administrativo ja ficavam ocultos pro Sidebar de
  Diretor/Gerente/Coordenador SEM nenhuma mudanca de codigo - todos
  continuam com `Role=Corretor` (so o cargo muda), e o Sidebar ja
  gateava esses itens por `requiredRole: "Administrador"` desde antes
  desta fatia - so confirmado com teste, nao reimplementado.

Testado de ponta a ponta em cada fatia (scripts descartaveis, removidos
ao final): Fatia 1 confirmou hierarquia de 4 niveis via JWT (login E
2FA) + `getSubordinadosRecursivos` recursivo de verdade + Guard
bloqueando Diretor/Gerente/Coordenador mas liberando Corretor + token
sem o claim `cargo` (simulando sessao antiga) nao quebra. Fatia 2 rodou
a matriz completa de 4 cenarios (Administrador/Diretor/Gerente-com-
equipe/Corretor-solo) em 2 modulos (Kanban + Atendimento), 12
verificacoes, incluindo a prova de que Caixa de Entrada continua igual
pra todo mundo. Fatia 3 confirmou com Playwright real que o botao de
excluir coluna some do DOM pro Gerente (nao so via CSS) mas o de
renomear continua, e que o Administrador continua vendo tudo
normalmente.

### Modulo Plantao/Stand (3 fatias) - CONCLUIDO
Fecha a lacuna deixada de proposito pelo RBAC por cargo hierarquico (ver
secao acima): ate aqui, Coordenador usava a MESMA logica do Gerente
(`escopo: 'equipe'`, arvore de subordinados via `superiorId`). Este
modulo modela "escala" pela primeira vez no schema e substitui isso por
`escopo: 'plantao'` - Coordenador passa a ver so os corretores
ESCALADOS HOJE no stand fisico que ele supervisiona, um eixo totalmente
diferente de `superiorId`.

Modelagem: `Stand` (local fisico de venda) + `EscalaPlantao`
(corretor x stand x dia da semana recorrente, `diaSemana` 0-6 igual
`Date.getDay()`, `@@unique([standId, userId, diaSemana])`) +
`User.standId` (stand FIXO que um Coordenador supervisiona - diferente
de `EscalaPlantao`, que e o padrao ROTATIVO de um corretor, podendo
estar em varios stands em dias diferentes). Decisoes confirmadas antes
de codar: escala semanal (nao data especifica), 1 corretor pode estar
em varios stands, so Administrador gerencia, Coordenador sem `standId`
resolve para lista VAZIA (nunca cai num fallback pra "ve tudo" ou "ve
equipe").

- **Fatia 1 (modelagem + CRUD)**: modulo `src/modules/plantao/`, Clean
  Architecture, exporta `IStandRepository` (consumido por `rh` para
  atribuir `standId` ao Coordenador na tela de Permissoes/Cargos, e por
  `vendas_kanban`/`atendimento` na Fatia 2). CRUD de Stand
  (`@Roles('Administrador')`) bloqueia exclusao se houver escala ou
  Coordenador vinculados. `SetEscalaUseCase` idempotente (find-or-create,
  sem erro em duplicata). Nova aba "Stands/Plantao" no Painel
  Administrativo (grade semanal de 7 dias por stand) + coluna "Stand" em
  Permissoes/Cargos (so aparece pra cargo="coordenador", limpa
  automaticamente se o cargo mudar).
- **Fatia 2 (integracao RBAC)**: `CARGO_ESCOPO.coordenador.escopo` migrou
  de `'equipe'` para o novo valor `'plantao'`.
  `GetCorretoresEscaladosHojeUseCase` (modulo `plantao`, exportado)
  resolve `standId -> userId[]` via `new Date().getDay()` contra
  `EscalaPlantao.diaSemana`, retornando lista vazia se `standId` for
  `null` - sem fallback. `GetBoardUseCase`/`ListAtendimentosUseCase`/
  `GetAtendimentoDetailUseCase` ganharam o branch `escopo === 'plantao'`
  chamando esse use case. Peca extra descoberta como necessaria durante a
  implementacao (fora da lista original, mas indispensavel): `standId`
  passou a viajar no JWT (mesmo padrao ja usado pra `cargo` no RBAC
  Fatia 1), pra o Coordenador nao precisar de uma consulta extra ao
  banco a cada request so pra saber o proprio stand.
- **Fatia 3 (frontend)**: `GetMeUseCase`/`/auth/me` passou a devolver
  `standId`. Nova rota `GET /stands/meu-status-hoje` (sobrescreve o
  `@Roles('Administrador')` da classe com `DASHBOARD_ROLES` no metodo -
  qualquer role de dashboard pode chamar, o use case ja resolve "vazio"
  se o requisitante nao tiver `standId`) devolve nome do stand + quantos
  corretores estao escalados hoje. Componente reaproveitavel
  `PlantaoStatusBadge` (so renderiza algo se `cargoHierarquico ===
  "coordenador"`) mostra "Stand: X - N corretores hoje" (ou "Nenhum
  stand atribuido") no header do Kanban e da Central de Atendimento.

Testado de ponta a ponta em cada fatia (scripts descartaveis + Playwright
real, removidos ao final): Fatia 2 rodou a matriz de 5 cenarios
(Administrador/Diretor/Gerente-com-equipe/Coordenador-com-stand/
Coordenador-sem-stand/Corretor-solo) em Kanban e Atendimento, confirmando
que o Coordenador ve so o corretor escalado hoje (nao o proprio card) e
que "sem stand" realmente resolve pra lista vazia, nao fallback. Fatia 3
confirmou o badge certo pra Coordenador-com-stand e
Coordenador-sem-stand, ausencia total do badge pra Corretor comum, e um
teste de virada de dia (consulta simulando terca encontra o corretor
escalado so na terca; consulta simulando quarta nao encontra - confirma
que a fronteira do dia e respeitada na camada de dados).

### Metodologia desta sessao (registrar para as proximas)
- Todo commit de cada frente foi feito **separado por assunto** (nunca
  um commit unico misturando fatias/modulos diferentes), mesmo quando
  os arquivos-fonte evoluiram de forma entrelacada entre fatias - nesses
  casos, os estados intermediarios de cada arquivo foram reconstruidos
  manualmente para produzir um historico git fiel a cada fatia.
- Todo deploy seguiu o mesmo roteiro: `git pull` -> (`prisma migrate
  deploy` + `npm run db:generate`, se houver migration nova) -> `npm
  run build` (backend e/ou frontend) -> `pm2 restart` SO dos processos
  `gestordevendas-backend`/`gestordevendas-frontend` (nunca
  `igrejaboamorte`/`ivillar-crm`) -> confirmacao de
  `https://gestordevendas.ivillar.com.br` retornando 200.
- Achado operacional importante: `npx prisma migrate deploy` **nao
  regenera o Prisma Client automaticamente** neste projeto (sem
  `postinstall`) - sempre rodar `npm run db:generate` explicitamente
  antes do build apos aplicar migrations, local ou em producao, ou o
  build falha com "Unknown field" do Prisma.
- Todo teste de ponta a ponta que precisou de navegador real usou
  Playwright contra um tenant descartavel (criado direto via Prisma,
  removido via cascade ao final) - inclusive contra a **propria
  producao** quando o objetivo era confirmar comportamento real do
  ambiente deployado (ex: investigacao do bug do Sidebar, verificacao
  do Repique).

## Ultima sessao de trabalho (12/07/2026) - resumo

- E-doc Fatia 3: papeis Destinatario/Remetente/Testemunha + rubrica
  multi-pagina - CONCLUIDA, em producao
- E-doc Fatia 4: correcao do bug de rascunho, conversao Word/Excel
  para PDF via LibreOffice, validacao inline, dashboard com
  estatisticas/filtros/busca, e-mail customizavel - CONCLUIDA, em
  producao (LibreOffice instalado tambem na VPS)
- Modulo Central de Atendimento (Filas): Fila/FilaUsuario/Atendimento/
  AtendimentoEvento, 3 filas padrao auto-criadas (Suporte/Financeiro/
  Duvidas Gerais), VIVI orquestrando classificacao (lead qualificado
  -> Kanban; duvida/suporte -> Fila via nova tool
  transferir_para_fila) - CONCLUIDA, em producao
- Identidade visual: logo oficial (frontend/public/logo.png) + cor
  azul (blue-600) aplicados em todas as telas, incluindo cadastro
  publico

### Sessao 13/07/2026 - correcoes aplicadas nesta sessao
- VIVI: corrigido para nao responder se lead ja tem Card com corretor
  responsavel (Guard 1: verifica status da ultima ViviConversation;
  Guard 2: verifica existsByTenantAndPhoneWithOwner no ICardRepository)
  - CONCLUIDA
- Bad MAC / ruido de log WhatsApp: removidos todos os blocos de debug
  [VIVI-DEBUG] que sobraram da investigacao do bug @lid; adicionado
  try/catch por mensagem no messages.upsert do BaileysWhatsAppProvider,
  suprimindo silenciosamente erros "Bad MAC" conhecidos do Signal
  Protocol - CONCLUIDA
- E-doc: preview de Word/Excel no Passo 2 do wizard corrigido via novo
  endpoint POST /edoc/convert-preview (EdocStatsController, reutiliza
  PrepareEnvelopeDocumentService + LibreOffice) - frontend chama o
  endpoint imediatamente ao selecionar o arquivo, exibe spinner durante
  conversao, renderiza o PDF convertido no FieldPositionEditor -
  CONCLUIDA

### Port visual da Central de Atendimento (4 fatias) - CONCLUIDO
Baseado no levantamento do design original do wacalls-chat (referencia
MIT estudada como conceito, sem copiar codigo - ver CLAUDE.md), 4
fatias implementadas em sequencia, cada uma revisada e aprovada antes
de avancar para a proxima:
- Fatia 1 (layout base + abas): cards flutuantes `rounded-2xl border
  shadow-sm`, 3 abas de status (Atendendo/Aguardando/Todos) com pill
  de contagem, dropdown de filtro por fila coexistindo com as abas
  (nao substituindo), grid colorido de filas em /dashboard/equipe (cor
  por hash deterministico do nome, sem alterar o Prisma) com editar
  (expande vinculo de agentes) e excluir - unica mudanca de BACKEND
  desta leva, `DELETE /filas/:id`, aprovada explicitamente antes de
  implementar (atendimentos vinculados voltam a "nao classificado" via
  onDelete:SetNull, nunca sao apagados).
- Fatia 2 (ChatRow): avatar com iniciais do telefone (sem avatarUrl no
  backend), badge de canal WhatsApp, chip de fila colorido, botoes de
  acao 24x24 contextuais PELA ABA ATIVA (Aceitar/Transferir/Finalizar
  em Aguardando; Transferir/Finalizar/Devolver em Atendendo; so
  Finalizar, desabilitado se ja fechado, em Todos), popover inline de
  transferencia.
- Fatia 3 (ChatView header/corpo/historico): header com
  avatar/chip de fila/badges e os mesmos 4 botoes coloridos (Aceitar
  restrito a status=aguardando - mudanca deliberada de comportamento,
  ver detalhe abaixo), fundo com padrao sutil de losangos (SVG inline
  em camada propria opacity-5, sem imagem externa), bolhas agrupadas
  por dia (Hoje/Ontem/data), aviso ambar quando aguardando, painel de
  historico deslizante w-80 (ESC + clique fora fecham) calculado
  client-side a partir da lista ja carregada (sem endpoint novo).
- Fatia 4 (composer): nota privada (reaproveita o
  `POST /atendimentos/:id/nota` ja existente, sem payload novo), emoji
  picker (grid estatica 8 colunas - emoji-mart nao instalado, sem
  dependencia nova), dropdown de anexos e botao de audio presentes na
  UI mas DESABILITADOS ("em breve") porque nao existe nenhum endpoint
  de upload de midia no backend hoje (confirmado por busca no codigo
  ANTES de implementar, nao e pendencia esquecida) - os 3 itens
  faltantes registrados no BACKLOG.md.

Mudanca de comportamento deliberada (Fatia 3): o botao "Aceitar" do
header agora so aparece com `status=aguardando` - antes tambem
aparecia para "tomar" um atendimento `em_atendimento` de outro agente
sem passar por Transferir. Simplificacao pedida explicitamente nesta
fatia; o Transferir continua cobrindo esse caso.

`tsc --noEmit` limpo (frontend e backend) em cada uma das 4 fatias;
`/dashboard/atendimento` confirmado renderizando 200 apos cada uma.
100% frontend, exceto o `DELETE /filas/:id` ja citado - nenhuma outra
mudanca de schema/autenticacao.

### Pendencias conhecidas registradas para retomar
NOTA (atualizada apos o Plantao/Stand): as 3 correcoes citadas
originalmente aqui (guard anti-duplicidade da VIVI, supressao de "Bad
MAC", preview Word/Excel no E-doc) ja foram commitadas ha algumas
sessoes (`07b4fc7`, `8ebdc1b`, `d7c1d02`) - a nota antiga ficou
desatualizada, removida. RH: contrato automatico de prestacao de
servico (Fatias 1+2), RH Fatia 3 (template editavel), o Painel
Administrativo completo (5 fatias), o RBAC por cargo hierarquico (3
fatias) e o modulo Plantao/Stand (3 fatias) ja foram CONCLUIDOS - ver
secoes proprias acima. Rate limiting no login + helmet + log de
auditoria (parte da Fase C) tambem ja CONCLUIDO - ver secao propria
acima.
Pendencias reais atuais:
- Super Usuario: hoje nao existe conta que acesse MAIS DE UM tenant -
  cada Administrador so ve o proprio tenant (isolamento multitenant
  correto e desejado para clientes). Precisa de um papel novo, fora da
  hierarquia normal de Role/cargo de um tenant, para o DONO da
  plataforma SaaS (nao um cliente) acessar todos os tenants - avaliar
  com cuidado pra nao abrir brecha de vazamento entre tenants
- Modulo de Cloud API oficial da Meta (Agente de Atendimento
  Online/multicanal) - ainda nao iniciado, maior escopo do roteiro
- Fase C do roteiro, restante: testes automatizados, logs estruturados/
  monitoramento mais amplo (alem do log pontual de login), revisao de
  seguranca mais ampla - rate limiting/helmet/auditoria de login ja
  feitos, mas o resto ainda nao foi iniciado
- Treinar a VIVI: item novo registrado sem escopo detalhado ainda -
  avaliar com o usuario o que exatamente significa "treinar" (ajuste de
  prompt? novos casos de teste? feedback loop sobre conversas reais?)
  antes de planejar fatias
- Central de Atendimento: upload de midia/audio/contato no composer
  (sem endpoint de midia no backend hoje - ver BACKLOG.md)

### Proximos passos sugeridos (atualizado apos Super Usuario concluido)
NOTA: Dashboard do Corretor (2 fatias), Onboarding do Corretor (troca de
senha obrigatoria), Notificacao de lead atribuido pela Roleta Online e
Super Usuario (3 fatias completas) ja CONCLUIDOS - ver secoes proprias
no topo deste arquivo. Ordem de prioridade revisada:
1. Modulo Agente de Atendimento Online (Cloud API oficial Meta) -
   multiatendimento/multicanal, distribuicao de leads entre SDRs,
   tudo registrado no CRM (ver CLAUDE.md "Decisao tecnica: Integracao
   WhatsApp") - maior escopo, decisao estrategica de priorizacao,
   sessao dedicada
2. Logs estruturados + monitoramento basico (restante da Fase C) -
   barato de implementar
3. Treinar a VIVI - por ultimo, escopo ainda nao detalhado

## Status atual (ultima atualizacao: verificar data do commit/arquivo)

### Modulo de Autenticacao - COMPLETO E TESTADO
- Registro de empresa (Tenant) + usuario Administrador
- Login com JWT (tenantId + role embutidos, isolamento multitenant)
- Lembre-se de mim (rememberMe: token de 1 dia ou 30 dias)
- Servico de e-mail via Resend, atras da interface IEmailSender (trocavel)
- Esqueci a senha (token de uso unico, 15 min de validade)
- 2FA por e-mail (codigo de 6 digitos, 5 min de validade)
- Todos os endpoints em src/modules/auth/

### Modulo WhatsApp Marketing - COMPLETO E TESTADO
- Localizacao: src/modules/whatsappmarketing/
- Biblioteca: baileys (fixada em versao segura, ver CLAUDE.md)
- Conexao via QR Code: FUNCIONANDO (testado com numero real 5511973879858)
- Envio de mensagem real: FUNCIONANDO (testado e confirmado)
- Recebimento de mensagem real (direction: IN): FUNCIONANDO (testado com
  mensagens 1:1 reais, incluindo formato @lid)
- Filtro de grupos/status/mensagens de protocolo: FUNCIONANDO (bloqueia
  @g.us e @broadcast por JID, e mensagens de protocolo/sistema como
  senderKeyDistributionMessage via getContentType() - ver CLAUDE.md)
- Sessao de teste foi desconectada e o banco (WhatsAppMessage) e disco
  (.whatsapp-sessions/) foram limpos ao final dos testes - nenhuma
  sessao ativa no momento

### Modulo VIVI (Assistente SDR de IA) - ESCOPO COMPLETO CONCLUIDO
Conversa/qualificacao CONFIRMADA funcionando de ponta a ponta com teste
real e prova visual de entrega (ver CLAUDE.md "Bug RESOLVIDO: VIVI
agora entrega mensagens para destinatarios reais via @lid"). Sessao
13-14/07 implementou as 5 fatias do documento original de instrucoes
da VIVI (encontrado pelo usuario, descrevia escopo maior do que o
implementado ate entao) - ver secao "VIVI - escopo completo..." no
topo deste arquivo para o detalhe de cada fatia: meta de agendar visita,
conteudo pedagogico de financiamento, enquadramento por renda (HIS1/
HIS2/HMP/R2V), coleta pos-visita + urgencia, e Repique como Stage do
Kanban com resumo automatico no Card.

### Modulo RH - fatia minima (contas de Corretor + status + Kanban) - CONCLUIDA
Contas de Corretor (cadastro pelo Administrador, Role "Corretor"
criado automaticamente), status de disponibilidade (online/ausente/
offline, com seletor na Topbar e "online" automatico no login) e
restricao de visibilidade no Kanban (Corretor so ve os proprios cards
nas colunas; Administrador ve tudo; Caixa de Entrada sempre visivel a
todos, sem filtro). Backend em src/modules/rh/ (Clean Architecture,
isolado do modulo auth). Frontend em /dashboard/equipe + item "Equipe"
no Sidebar (so para Administrador) + seletor de status na Topbar.
Testado de ponta a ponta com Playwright (tenant/admin/corretor de
teste, visibilidade cruzada confirmada, dados de teste removidos ao
final).

RESOLVIDO: todos os e-mails do modulo RH (boas-vindas de corretor,
aprovacao/rejeicao de cadastro publico) agora usam ResendEmailSender
de verdade (nao mais ConsoleEmailSender) - ver CLAUDE.md, secao
"Envio de e-mail real (RESOLVIDO)".

### Modulo RH completo (cadastro publico multi-perfil + aprovacao + hierarquia) - CONCLUIDA
Expande a fatia minima acima: cadastro publico sem login (POST
/rh/cadastro-publico) para 4 perfis - Cliente, Corretor House,
Corretor Parceiro, Imobiliaria Parceira -, cada um criando o User com
statusCadastro="pendente_aprovacao" (login bloqueado ate aprovacao,
com mensagem especifica). Administrador aprova/rejeita em
/dashboard/rh/aprovacoes (item "Aprovacoes" no Sidebar), definindo
cargoHierarquico + superior (hierarquia corretor -> gerente) para
Corretor House e Imobiliaria Parceira - os outros 2 perfis nao usam
hierarquia. Frontend publico completo em /cadastro (selecao de perfil
-> formulario especifico -> confirmacao), fora do layout do dashboard,
com link "Criar cadastro" na tela de login. Corretor House reaproveita
o mesmo Role "Corretor" da fatia minima (mesmas regras de visibilidade
no Kanban). Testado de ponta a ponta com Playwright (cadastro,
bloqueio de login, aprovacao com hierarquia de 2 niveis confirmada no
banco, login liberado, fluxo simplificado de Cliente). Dados de teste
removidos ao final. Detalhes completos em CLAUDE.md.

### Correcao: controle de acesso por role no dashboard - CONCLUIDA
Fechou a pendencia acima. RolesGuard (complementar ao JwtAuthGuard)
aplicado em todos os controllers do dashboard (Kanban, Imoveis,
WhatsApp, Equipe, RH) - so Administrador, Corretor e Corretor Parceiro
acessam; Cliente e Imobiliaria Parceira recebem 403 em qualquer rota
do dashboard, embora o login continue funcionando normalmente.
Confirmado que corretor_house (role "Corretor") e corretor_parceiro
(role "Corretor Parceiro") sao roles SEPARADAS hoje - decisao tomada
com o usuario: manter separadas no banco, mas dar acesso ao dashboard
para as duas. Frontend: login redireciona Cliente/Imobiliaria Parceira
para /minha-conta (pagina publica simples, fora do dashboard) em vez
de /dashboard/kanban. Testado de ponta a ponta com Playwright (403 via
API, redirecionamento via UI, tentativa de acesso direto por URL falha
sem mostrar dados reais, Corretor continua funcionando normalmente).
Detalhes completos em CLAUDE.md.

### Modulo E-doc (assinatura eletronica) - Fatia 1 e Fatia 2 - CONCLUIDAS
Logica PORTADA do projeto antigo de Daniel (ivillar/crm) - o backend
de assinaturas de la foi apagado por acidente num commit de build nao
relacionado, mas recuperado via git history e adaptado para Clean
Architecture em src/modules/edoc/. Fluxo: envelope (PDF + hash
SHA-256) -> destinatarios em ordem sequencial estrita (so o proximo
recebe o link depois que o anterior assinar, reforcado tanto no envio
do e-mail quanto num bloqueio direto no SignDocumentUseCase) ->
assinatura via canvas (desenhado, validado por magic-bytes) ou nome
digitado -> ultimo signatario fecha o envelope numa transaction.
Trilha de auditoria completa (IP/User-Agent/timestamp por evento).
Rotas de assinatura publicas (sem login) protegidas so pelo token, com
expiracao configuravel.

Fatia 2 adicionou o editor de posicionamento: cada destinatario recebe
UM campo de assinatura posicionavel (pagina + x/y, arrastado com
react-rnd sobre o PDF renderizado no proprio modal de criacao). Ao
concluir o envelope, GenerateSignedPdfUseCase usa pdf-lib para carimbar
a assinatura (imagem ou texto) de cada destinatario na posicao exata,
gerando um PDF final (SignatureEnvelope.signedDocumentUrl) disponivel
para download na pagina de detalhe do envelope. Testado de ponta a
ponta com Playwright (2 signatarios em sequencia, campos em paginas
diferentes, destaque exibido na pagina correta na tela de assinatura
publica, PDF final gerado com 2 paginas e conteudo carimbado
confirmado por leitura do arquivo). Detalhes completos em CLAUDE.md,
incluindo a pendencia de build resolvida (react-pdf/pdfjs-dist
precisou de downgrade + ssr:false por incompatibilidade com o
Next.js).

RESOLVIDO: e-mails do E-doc (convite + repasse ao proximo signatario)
agora usam ResendEmailSender de verdade (nao mais ConsoleEmailSender).

### Modulo E-doc (assinatura eletronica) - Fatia 3 (papeis + rubrica) - CONCLUIDA
Adiciona papeis de participante e campo de rubrica (alem da assinatura
ja existente). Regra final do campo, valendo para qualquer envelope
daqui pra frente:
- **Destinatario** e **Remetente**: rubrica em TODAS as paginas do
  documento + assinatura completa na ULTIMA pagina.
- **Testemunha**: SOMENTE assinatura completa na ULTIMA pagina - nunca
  rubrica (a opcao nem aparece na UI para esse papel).

`SignatureRecipient.role` ("destinatario"/"remetente"/"testemunha",
default "destinatario") substitui a nocao de ordem global unica:
`order` agora conta DENTRO DO PROPRIO GRUPO de papel. A sequencia real
de assinatura (quem recebe o e-mail e quando) combina grupo + ordem
(destinatarios primeiro, depois remetentes, depois testemunhas) via
`domain/services/recipient-sequence.ts` (funcao pura, sem infra) -
usada tanto no envio (so o primeiro da sequencia recebe o e-mail logo
de cara) quanto no bloqueio de assinatura fora de vez
(`SignDocumentUseCase`, HTTP 409). `SignatureField.tipo`
("assinatura"/"rubrica", default "assinatura") identifica cada campo;
`GenerateSignedPdfUseCase` nao precisou de nenhuma mudanca funcional -
ja iterava por campo (nao por destinatario), entao "rubrica repetida
em N paginas" e so "N campos com o mesmo recipientId e a mesma imagem
de assinatura", tratado naturalmente pelo loop existente.

A repeticao da rubrica em todas as paginas e responsabilidade do
FRONTEND: o botao "Adicionar Rubrica" gera 1 `SignatureField` por
pagina do documento, todos com a mesma posicao (arrastar qualquer um
propaga a nova posicao aos demais, mantendo a mesma posicao em todas
as paginas) - o backend so recebe e salva a lista final de campos,
com validacao que rejeita qualquer campo `tipo=rubrica` associado a um
participante `role=testemunha`.

Frontend: wizard de criacao ganhou 3 badges explicativos de papel
(Destinatario azul, Remetente verde, Testemunha amber/laranja - cor
semantica de papel, mesma familia dos badges de status, nao um
elemento de marca), cards de participante coloridos por papel com
dropdown de papel, e 3 botoes de adicionar dedicados. O editor de
posicionamento mostra caixas menores/tracejadas para rubrica vs.
maiores/solidas para assinatura, na cor do papel do participante. A
tela publica de assinatura mostra um indicador "Campo X de Y" com
navegacao entre os campos quando o destinatario/remetente tem mais de
1 campo - a assinatura e desenhada/digitada UMA UNICA VEZ e aplicada a
todos os campos daquele participante automaticamente (a UI so navega
para PREVIEW de cada posicao, nao pede a assinatura de novo).

Testado de ponta a ponta com Playwright real (headless, dev servers
locais): envelope com 3 participantes (1 de cada papel) num PDF de 3
paginas, opcao de rubrica confirmada AUSENTE para Testemunha na UI,
Destinatario e Remetente com rubrica nas 3 paginas + assinatura na
ultima (4 campos cada, confirmado no banco), Testemunha com so 1 campo
de assinatura (confirmado no banco, sem nenhum campo de rubrica).
Ordem de assinatura confirmada por tentativa direta (nao so
inspecao): Remetente e Testemunha bloqueados (409) tentando assinar
antes do Destinatario; apos o Destinatario assinar, Testemunha
continua bloqueada (409) ate o Remetente tambem assinar; so entao a
Testemunha consegue. Envelope fechou "concluido", PDF final com 3
paginas confirmado (crescimento de tamanho do arquivo original ao
final comprova o carimbo dos 9 campos - 4+4+1 - mesmo usando "digitar
nome", sem imagem). Tenant de teste, envelopes e arquivos fisicos
removidos ao final.

### Modulo E-doc (assinatura eletronica) - Fatia 4 (rascunho, Word/Excel, e-mail, dashboard) - CONCLUIDA
Corrige um bug real: antes desta fatia, um envelope que ficasse em
"rascunho" (ex: falha no envio logo apos criar) nao tinha NENHUMA
forma de ser reaberto - ficava morto para sempre. Agora e possivel
reabrir, editar (titulo/documento/participantes/campos/e-mail) e
completar/enviar um rascunho a qualquer momento
(`GetEnvelopeForEditUseCase`/`UpdateEnvelopeDraftUseCase`, rotas
`GET /edoc/envelopes/:id/edit` e `PATCH /edoc/envelopes/:id`) - na
lista `/dashboard/edoc`, envelopes com status "Rascunho" agora sao
clicaveis e abrem o wizard ja preenchido.

Adiciona tambem: conversao automatica de Word/Excel (.doc/.docx/.xls/
.xlsx) para PDF via LibreOffice headless (`LibreOfficeConverterService`,
child_process, configuravel via `LIBREOFFICE_PATH`) antes de salvar o
envelope; dropzone de upload (arrastar-e-soltar) com validacao de
extensao/tamanho (30MB); validacao inline de participantes (mensagens
em vermelho "Nome obrigatorio"/"E-mail invalido", sem mais alert()
generico); passo novo no wizard "Mensagem do E-mail" (assunto/mensagem
customizaveis, aplicados no envio real via Resend); e dashboard com 4
cards de estatisticas (Total/Aguardando Assinatura/Concluidos/
Rascunhos), abas de filtro por status e busca por titulo.

PENDENCIA DE INFRAESTRUTURA registrada: o LibreOffice ainda NAO esta
instalado na VPS de producao - precisa ser instalado (`apt install
libreoffice`) antes desta fatia funcionar em producao; testado e
confirmado funcionando so no ambiente local ate agora.

LIMITACAO CONHECIDA (documentada, nao corrigida nesta fatia): o Passo
2 do wizard (posicionar campos) nao tem preview convertido para
arquivos Word/Excel - mostra "Failed to load PDF file." ate o
documento ser salvo (a conversao real so acontece no backend, no
momento de salvar/enviar). Os campos ainda sao salvos corretamente nas
posicoes padrao, so falta o retorno visual nesse caso especifico.

Testado de ponta a ponta com Playwright real: (a) bug do rascunho
confirmado corrigido (criar -> salvar rascunho sem enviar e-mail ->
recarregar pagina -> reabrir pelo clique na lista -> dados
pre-preenchidos confirmados -> completar -> enviar com sucesso); (b)
upload de um .docx minimo (OOXML/ZIP gerado por codigo, sem
biblioteca nova) convertido de verdade via LibreOffice real, PDF final
validado; (c) validacao inline confirmada (nome vazio + e-mail
invalido bloqueiam o avanco com as mensagens certas); (d) os 4 cards
de estatisticas conferidos contra contagem direta no banco apos varios
envelopes de teste - todos batendo; (e) assunto/mensagem customizados
confirmados persistidos no banco e envio concluindo sem erro (Resend
aceitou a chamada) - o conteudo do e-mail recebido nao pode ser
confirmado via API do Resend nesta rodada por falta de acesso a rede
externa no ambiente de teste usado (a logica de uso do assunto/mensagem
customizados foi confirmada por leitura de codigo). Tenant de teste e
arquivos fisicos removidos ao final.

### Modulo Portal do Cliente - CONCLUIDA
Substitui a tela placeholder /minha-conta por um portal real (Meus
Imoveis, Meu Atendimento, Assinaturas Pendentes, Meus Documentos) para
quem loga com Role "Cliente". src/modules/portal_cliente/ so LE dados
ja existentes em gestao_imobiliaria/vendas_kanban/edoc, sem modelos
proprios. LIMITACAO CONHECIDA (deliberada, documentada em CLAUDE.md):
vinculo por CORRESPONDENCIA DE E-MAIL (User.email == Proprietario.email
/ Card.email / SignatureRecipient.email), nao por FK formal - se o
e-mail usado no cadastro do cliente for diferente do usado no
contrato/card/envelope, a secao correspondente aparece vazia (nao e um
bug). Testado de ponta a ponta com Playwright: Cliente Proprietario
(imovel/contrato corretos, assinatura pendente, assina via link
publico reaproveitado, migra para Meus Documentos apos reload) e
Cliente Comprador (atendimento com etapa amigavel + corretor
responsavel). Detalhes completos em CLAUDE.md.

### Modulo Gestao Imobiliaria - Fatia 4 (Financeiro) - CONCLUIDA
Expande src/modules/gestao_imobiliaria/ com lancamentos financeiros
manuais (avulsos ou vinculados a um Contrato) e geracao automatica de
cobranca de aluguel para Contratos de locacao ativos
(GerarCobrancasDoMesUseCase, idempotente por mes-alvo - seguro clicar
mais de uma vez). Status pendente/pago/atrasado, com atualizacao
automatica para atrasado toda vez que a lista e buscada (sem scheduler).
So Administrador acessa (mais estrito que os demais controllers do
modulo). Frontend: 5a aba "Financeiro" em /dashboard/imoveis, so
visivel para Administrador, com cards de resumo, filtros e botao
"Gerar cobrancas do mes". Testado de ponta a ponta com Playwright
(cobranca gerada com vencimento correto, confirmado que gerar 2x nao
duplica, lancamento manual avulso, marcar como pago). Detalhes
completos em CLAUDE.md.

RESOLVIDO em tarefa dedicada logo apos esta fatia: bug sistemico de
fuso horario em campos "date-only" (new Date("YYYY-MM-DD") era
interpretado como UTC, nao local, perdendo 1 dia na exibicao em fusos
negativos como o Brasil) - corrigido em todo o codebase via
parseDateOnly()/formatDateOnly() (src/shared/utils/date-only.util.ts).
Ver secao propria em CLAUDE.md.

### Modulo Gestao Imobiliaria - Fatia 5 (Moradores/Inquilinos) - CONCLUIDA
Fecha as 5 fatias planejadas do modulo. InquilinoComprador ganhou
analise de credito (profissao, rendaDeclarada, statusAnaliseCredito,
observacoesAnalise) e documentos anexados (InquilinoDocumento - RG/CPF,
comprovante de renda, comprovante de residencia, outro), mesmo padrao
de armazenamento das fotos de imovel e do E-doc. So Administrador
acessa a analise de credito e os documentos (dados sensiveis) - a
listagem basica continua aberta a qualquer DASHBOARD_ROLES. Frontend:
nova aba "Inquilinos" com badge de status colorido, painel de detalhe
com secoes condicionais por role. Testado de ponta a ponta com
Playwright (preencher profissao/renda, mudar status para "Em Analise",
upload de documento, mudar para "Aprovado", badge atualizado na
lista). Detalhes completos em CLAUDE.md.

### Modulo Roleta Online (distribuicao automatica de leads) - CONCLUIDA
Distribui automaticamente cards sem dono (Caixa de Entrada) entre
corretores online, via evento 'card.sem_dono.criado' (EventEmitter2,
mesmo padrao da VIVI) disparado pelo CreateQuickCardUseCase. Duas
opcoes configuraveis por tenant (so Administrador altera, em
/dashboard/equipe): algoritmo (round_robin ou menor_fila) e modo
(automatico - atribui de vez, reaproveitando o ClaimCardUseCase - ou
semi_automatico - so sugere, com confirmacao via POST
/cards/:id/confirmar-sugestao). Sem corretor online ou com a Roleta
inativa, o lead continua caindo na Caixa de Entrada normalmente, sem
erro. Backend em src/modules/roleta_online/ (Clean Architecture,
importa vendas_kanban e rh como modulos, sem dependencia circular).
Testado de ponta a ponta com Playwright (2 corretores de teste, 3
leads alternando round-robin, troca para semi-automatico com sugestao
+ confirmacao pela UI, e cenario de 0 corretores online). Dados de
teste removidos ao final. Detalhes completos em CLAUDE.md.

NOTA DE NOMENCLATURA: este e o unico "Roleta Online" do projeto agora
- distribuicao de leads do Kanban entre corretores, sem relacao com
WhatsApp/Meta. O futuro sistema multiatendimento/multicanal via API
oficial da Meta (item 4 dos Proximos Passos, abaixo) era as vezes
chamado de "Roleta Online" em anotacoes antigas deste arquivo - esse
apelido foi removido daqui para nao confundir com este modulo ja
concluido. Esse futuro modulo continua sendo chamado de "Agente de
Atendimento Online" (nome usado em CLAUDE.md), ainda nao iniciado.

### Modulo Central de Atendimento (Filas + Inbox de conversas) - CONCLUIDA
NOTA DE NOMENCLATURA (adicionar a lista acima): "Central de
Atendimento" e um TERCEIRO nome, diferente dos outros dois - nao
confundir com "Roleta Online" (distribuicao de leads do Kanban) nem
com o futuro "Agente de Atendimento Online" (API oficial da Meta,
ainda nao iniciado). A Central de Atendimento e para mensagens de
WhatsApp que NAO sao sobre comprar/alugar um imovel (suporte,
financeiro, duvidas gerais) - roda hoje sobre a mesma conexao Baileys
ja existente (QR Code), so separa o ASSUNTO da conversa, nao o
canal/numero.

Novo modulo `src/modules/atendimento/`: `Fila` (nome + descricao,
escopada por tenant) com agentes vinculados N:N (`FilaUsuario`), e
`Atendimento` (paralelo ao Card do Kanban mas fora do funil de vendas -
`whatsappSessionId`+`remoteJid` identificam a conversa, `filaId`/
`ownerId` opcionais ate classificar/assumir, status aguardando ->
em_atendimento -> fechado) com trilha de auditoria completa
(`AtendimentoEvento`: criado/atribuido/transferido/devolvido/fechado/
nota). 3 filas padrao ("Suporte", "Financeiro", "Duvidas Gerais")
criadas automaticamente no primeiro Atendimento de um tenant sem
nenhuma Fila - sem depender de setup manual.

Referencia conceitual estudada antes de construir (nao copiada -
`raphaelbat/wacalls-chat`, MIT, escrito em Go, incompativel com nossa
stack): confirmado por leitura de codigo que os campos de "rotation"/
round-robin do schema deles sao vestigiais (nunca implementados em
nenhuma camada) - por isso nossa Fila e deliberadamente so
organizacional, sem round-robin proprio (a Roleta Online ja resolve
distribuicao automatica, para o Kanban).

Dois caminhos entram no modulo: (1) sessao WhatsApp SEM VIVI ativa ->
o mesmo `WhatsAppMessageReceivedListener` que ja existia (modulo
vivi_sdr) agora tambem cria um Atendimento "nao classificado"
automaticamente, visivel so para Administrador ate classificar
manualmente (reaproveitando a acao de "Transferir"); (2) a propria
VIVI, quando decide que a pergunta NAO e sobre compra/aluguel, chama
uma tool nova ("transferir_para_fila", com categoria e resumo) em vez
de "transferir_para_corretor" - classifica automaticamente, sem criar
Card no Kanban.

Corretor/Agente ve so os atendimentos das proprias filas + os que ja
assumiu; Administrador ve tudo. Frontend: item "Atendimento" no
Sidebar, pagina `/dashboard/atendimento` (lista + chat + acoes
Assumir/Transferir/Devolver/Fechar/Nota, inspirada na estrutura do
wacalls-chat estudado mas com identidade visual propria), e gestao de
filas/vinculo de agentes na pagina `/dashboard/equipe` (Administrador).

Testado de ponta a ponta com uma combinacao de tecnicas (numero de
WhatsApp real pareado via QR nao pode ser automatizado neste
ambiente): contexto standalone do Nest para disparar os use cases que
normalmente rodam via evento, Playwright para toda a UI real
(classificar, assumir, transferir, devolver, fechar, nota - trilha de
auditoria completa confirmada), e uma chamada REAL a API da Anthropic
(Claude Haiku, sem mock) confirmando que a VIVI decide sozinha por
"transferir_para_fila" numa pergunta de suporte financeiro e classifica
na fila certa, sem criar Card. Envio de mensagem retornou o erro
esperado (sem numero real conectado neste ambiente de teste - mesma
limitacao ja documentada para outras fatias que dependem de WhatsApp
real). Dados de teste removidos ao final.

## Decisoes tecnicas importantes (ver CLAUDE.md para detalhes completos)
- NestJS v11 + Prisma v7 (nao suporta MongoDB - usar driver nativo no futuro)
- WhatsApp: dois caminhos propositalmente separados - QR/Baileys (corretor,
  agora) vs API Oficial Meta (futuro "Agente de Atendimento Online" -
  multiatendimento/multicanal, ainda nao iniciado - nao confundir com o
  modulo Roleta Online ja concluido, que e so distribuicao de leads no
  Kanban)
- Codigo 515 do Baileys e excecao normal (restart pos-pareamento), nao
  e queda de conexao real

## Proximos passos (em ordem sugerida)
1. Modulo de Vendas/Kanban (Stages, Cards, posicao flutuante, webhook de leads)
2. Frontend em Next.js 15 (login, depois Kanban)
3. Modulos de Atendimento, Marketing, Qualificacao, Pagamentos
4. "Agente de Atendimento Online" - API oficial Meta, multiatendimento/multicanal
5. Deploy em VPS + CI/CD

## Como retomar em uma nova sessao
Ao abrir um novo chat/sessao do Claude Code neste projeto, leia primeiro
CLAUDE.md (regras) e este PROGRESS.md (status), depois pergunte ao usuario
se quer continuar do proximo passo sugerido ou mudar de direcao.

## Roteiro Geral do Projeto (Fases)

### Fase A - Modulos de negocio (backend) - EM ANDAMENTO
- Autenticacao: COMPLETO
- WhatsApp Marketing (conexao do corretor): COMPLETO
- Vendas/Kanban: backend completo, frontend com formulario/filtros
  completo (badges de temperatura, WhatsApp, busca), + melhorias
  13-14/07 (renomear/excluir/nova coluna, multiplos pipelines)
- Gestao Imobiliaria: Fatias 1-5 CONCLUIDAS - COMPLETO (Catalogo/
  Espelho de Vendas, Proprietarios/Contratos, Financeiro com geracao
  automatica de cobranca de aluguel, Moradores/Inquilinos com analise
  de credito e documentos - Financeiro e a analise de credito/
  documentos dos inquilinos so Administrador acessa)
- RH/Cadastros e Perfis: CONCLUIDO (fatia minima + cadastro publico
  multi-perfil + aprovacao + hierarquia + contrato automatico de
  prestacao de servico Fatias 1+2+3, incluindo template editavel pelo
  Administrador - ver CLAUDE.md). E-mails reais via ResendEmailSender.
- VIVI (Assistente SDR de IA): escopo COMPLETO (agendar visita,
  conteudo pedagogico, enquadramento por renda, coleta pos-visita,
  Repique no Kanban) - ver secao propria no topo deste arquivo.
- Painel Administrativo (ex-"Configuracoes"): CONCLUIDO - 6 abas em
  /dashboard/configuracoes (Dados da Empresa, Meu Perfil, Permissoes/
  Cargos, Template de Contrato, Configuracoes da VIVI, Templates de
  E-mail) + sino de Notificacoes na Topbar - ver secao propria "Painel
  Administrativo (5 fatias)" mais acima.
- RBAC por cargo hierarquico: CONCLUIDO - cargo (Diretor/Gerente/
  Coordenador/Corretor) agora controla visibilidade de dados (Kanban +
  Atendimento) e permissao de exclusao, alem de so ser descritivo -
  ver secao propria "RBAC por cargo hierarquico (3 fatias)" acima.
- Plantao/Stand: CONCLUIDO - Stand (local fisico) + escala semanal por
  corretor, Coordenador agora ve so os corretores escalados HOJE no
  proprio stand (escopo 'plantao', substitui o 'equipe' generico que o
  RBAC por cargo tinha deixado como fallback pra esse cargo) + badge
  visual no Kanban/Atendimento - ver secao propria "Modulo Plantao/Stand
  (3 fatias)" acima. Super Usuario continua fora, registrado como
  proximo passo.
- Roleta Online (distribuicao automatica de leads entre corretores): CONCLUIDA
- E-doc (assinatura eletronica): Fatias 1, 2, 3 e 4 CONCLUIDAS
  (envelope + assinatura sequencial + editor de posicionamento de
  campos + PDF final carimbado para download + papeis de participante
  Destinatario/Remetente/Testemunha com rubrica multi-pagina + edicao
  de rascunho + conversao Word/Excel via LibreOffice + e-mail
  customizavel + dashboard com estatisticas/filtros/busca -
  LibreOffice confirmado instalado na VPS de producao)
- Portal do Cliente (/minha-conta): CONCLUIDO (Meus Imoveis, Meu
  Atendimento, Assinaturas Pendentes, Meus Documentos - vinculo por
  e-mail, ver limitacao conhecida em CLAUDE.md)
- Central de Atendimento (Filas + Inbox para WhatsApp de suporte/
  financeiro/duvidas gerais, VIVI orquestrando a classificacao entre
  Kanban de vendas vs Fila de atendimento): CONCLUIDA + 2 bugs
  corrigidos 13-14/07 (painel piscando, mensagens OUT da VIVI nao
  aparecendo) - nao confundir com o futuro "Agente de Atendimento
  Online" (API oficial da Meta), que continua nao iniciado
- Marketing, Agente de Atendimento Online (Meta), Pagamentos: nao iniciados

### Fase B - Frontend completo
Login e Kanban (com formulario/filtros) prontos. Demais modulos
seguem conforme forem construidos no backend.

### Fase C - Hardening (blindagem antes de producao)
- Rate limiting no login (bloquear tentativas em excesso)
- Suite de testes automatizados
- Logs estruturados + monitoramento
- Revisao geral de seguranca

### Fase D - Preparacao para VPS + dominio proprio - CONCLUIDA
- Configuracao do servidor VPS
- Docker Compose de producao
- HTTPS + dominio proprio (Nginx ou Caddy)
- CI/CD (GitHub Actions)
- Backup automatico do banco de dados

Nota: gestordevendas em producao desde 07/07/2026 em
https://gestordevendas.ivillar.com.br, VPS compartilhada com
ivillar.com.br sem conflitos, HTTPS valido via Let's Encrypt, PM2
gerenciando backend (3003) e frontend (3004), Postgres/Redis em Docker
com portas alternativas (5434/6381).

### Fase E - Lancamento

Nota: a arquitetura (Clean Architecture, modulos isolados, interfaces
trocaveis) foi escolhida deliberadamente para minimizar dificuldade de
manutencao/atualizacao futura. Upgrades de versao MAJOR de dependencias
centrais continuam exigindo cautela (ver regra correspondente no
CLAUDE.md).

## Checklist de Riscos Conhecidos (atualizar conforme o projeto cresce)

Nenhum sistema real e 100% seguro - o objetivo e risco gerenciado e
reduzido continuamente, nao risco zero. Riscos identificados ate agora:

### Risco estrutural permanente
- WhatsApp via Baileys (biblioteca nao-oficial): pode ser banido pela
  Meta ou parar de funcionar sem aviso a qualquer momento. Nao ha
  correcao definitiva - e um risco aceito do caminho escolhido (ver
  CLAUDE.md). Mitigacao: API oficial da Meta reservada para o futuro
  "Agente de Atendimento Online" (nao confundir com o modulo Roleta
  Online ja concluido, que e so distribuicao de leads no Kanban).

### Riscos que crescem com a superficie do sistema
- Cada modulo novo adiciona rotas e pontos de entrada. Superficie de
  ataque cresce proporcionalmente ao numero de funcionalidades.
- Mitigacao em andamento: todo modulo segue o mesmo padrao testado
  (Clean Architecture, isolamento por tenant, JwtAuthGuard), reduzindo
  a chance de erro por reinvencao de abordagem a cada modulo.

### Pendencias antes de qualquer uso em producao (Fase C do roteiro)
- [ ] Rate limiting no login (sem isso, ataque de forca bruta na senha
      nao e bloqueado)
- [ ] Suite de testes automatizados (hoje toda validacao e manual,
      via curl/Playwright a cada funcionalidade)
- [ ] Logs estruturados + monitoramento (hoje nao ha alerta automatico
      se o sistema cair)
- [ ] Revisao de seguranca externa/independente antes do primeiro
      cliente real usar - o processo atual (1 desenvolvedor + IA) e
      adequado para a fase de construcao, mas tem menos "olhos" do
      que uma revisao formal de seguranca antes de um lancamento serio

### Processo de mitigacao continua
- CLAUDE.md acumula decisoes e armadilhas ja resolvidas, evitando
  redescobrir o mesmo problema duas vezes
- Toda funcionalidade e testada de ponta a ponta antes de seguir para
  a proxima (nao ha "codigo que a gente espera que funcione")
