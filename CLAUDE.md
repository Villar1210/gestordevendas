# Regras do projeto gestordevendas

## Sobre o projeto
CRM multitenant para mercado imobiliario e importacao. Stack: NestJS,
Prisma, PostgreSQL, Redis, MongoDB (futuro), Next.js (futuro).
Arquitetura: Monolito Modular + Clean Architecture (domain/application/infra).

## Regras obrigatorias antes de agir
1. NUNCA faca upgrade de versao MAJOR de qualquer dependencia (ex: v5 -> v7)
   sem antes explicar o que muda e pedir confirmacao explicita.
2. NUNCA delete ou sobrescreva arquivos existentes sem antes explicar
   o que sera perdido e pedir confirmacao.
3. NUNCA rode comandos que apaguem dados do banco (drop, reset) sem
   confirmacao explicita.
4. Antes de instalar uma dependencia nova que nao foi pedida
   explicitamente, explique por que ela e necessaria e peca confirmacao.
5. Sempre que uma correcao exigir mudar mais do que o arquivo pedido
   originalmente, pare e explique o motivo antes de aplicar.
6. Mantenha a separacao de camadas: domain/ nao pode importar nada de
   infra/ ou de bibliotecas externas (Prisma, Express, etc.).
7. Todo dado de banco deve respeitar isolamento multitenant (tenant_id).
8. Ao terminar uma tarefa, rode npm run build para confirmar que nada quebrou.

## Decisao tecnica: Prisma v7
O projeto usa Prisma v7. O Prisma NAO suporta mais MongoDB nesta versao.
Quando o modulo de Atendimento precisar de MongoDB para historico pesado,
usar o driver oficial "mongodb" (npm) diretamente, numa camada infra/database
separada, mantendo Postgres+Prisma para tudo o mais. Nunca tentar
configurar MongoDB como datasource do Prisma neste projeto.

## Decisao tecnica: Integracao WhatsApp
Duas integracoes WhatsApp estao planejadas, propositalmente separadas:
1. Conexao via QR Code (biblioteca nao-oficial Baileys) - usada para o
   WhatsApp do corretor/imobiliaria se comunicar diretamente. Risco
   conhecido e aceito: pode ser banido pela Meta a qualquer momento,
   nao ha garantia de estabilidade a longo prazo.
2. API Oficial da Meta (Cloud API) - reservada para o futuro "Agente de
   Atendimento Online", sistema multiatendimento/multicanal com
   distribuicao de leads entre SDRs, tudo registrado no CRM. Ainda nao
   implementado. (Nota: este modulo era as vezes chamado de "Roleta
   Online" em anotacoes antigas - esse apelido foi removido daqui para
   nao confundir com o modulo Roleta Online ja concluido, que e so
   distribuicao automatica de leads no Kanban entre corretores, sem
   relacao com WhatsApp/Meta - ver secao propria mais abaixo.)
Nao confundir ou misturar as duas abordagens no mesmo modulo.

## Decisao tecnica: Organizacao de pastas por modulo
O projeto continua sendo um unico servidor NestJS (Monolito Modular),
rodando com npm run dev. Cada modulo de negocio vive isolado em sua
propria pasta dentro de src/modules/<nome-do-modulo>/, seguindo Clean
Architecture (domain/application/infra). Ao trabalhar em um modulo,
nunca alterar arquivos de outro modulo a menos que seja explicitamente
pedido. Isso permite que cada modulo seja "cortado e colado" para um
projeto/servico independente no futuro, sem reescrever codigo.

## Excecao registrada: reconexao no modulo WhatsApp
A regra geral de "sem reconexao automatica" continua valendo para
qualquer queda de conexao. Excecao unica e especifica: o codigo 515
("restart required") do Baileys e uma etapa normal e obrigatoria do
handshake de pareamento inicial (nao e uma queda de conexao real) -
para esse codigo especifico, o BaileysWhatsAppProvider reconecta
automaticamente uma vez. Nenhum outro DisconnectReason aciona
reconexao automatica.

## Decisao tecnica: filtro de mensagens WhatsApp (atualizado)
O BaileysWhatsAppProvider filtra mensagens em duas camadas:
1. Bloqueia por JID: grupos (@g.us) e status/stories (@broadcast).
2. Bloqueia por tipo de conteudo via getContentType(): so salva
   mensagens do tipo "conversation" ou "extendedTextMessage" (texto
   real). Isso descarta mensagens de protocolo/sistema (ex:
   senderKeyDistributionMessage), que podem chegar com JID nao
   reconhecivel como grupo mas sem conteudo de texto real.

## Nota operacional: WhatsApp pessoal em ambiente de teste
Conectar um numero de WhatsApp pessoal real ao modulo captura trafego
organico real (mensagens de contatos, grupos, etc) enquanto conectado.
Para testes futuros, preferir um numero secundario/descartavel quando
disponivel. Sessoes de teste devem ser desconectadas ao final de cada
rodada para evitar acumulo de dados reais de terceiros no banco de
desenvolvimento.

## Regra operacional: build vs dev simultaneos
Nunca rodar "npm run build" manualmente enquanto "npm run dev" (watch
mode) esta ativo no mesmo projeto - os dois disputam a pasta dist/ e
derrubam o servidor. Se precisar confirmar que o build esta limpo
enquanto o dev esta rodando, parar o dev primeiro, rodar o build, e
reiniciar o dev depois. Ou simplesmente confiar no "Found 0 errors"
que o proprio watch mode ja mostra no terminal.

## Nota operacional: isolamento Frontend/Backend
O tsconfig.json do backend exclui explicitamente as pastas frontend/ e
WACRM/ (para o watch mode do backend nao compilar arquivos .tsx/.ts de
fora do backend por engano, o que corrompe arquivos como
next.config.js). WACRM/ e um projeto open source de referencia
(analisado para avaliar reaproveitamento de ideias - ver memoria do
projeto), nao faz parte do backend. O frontend usa o builder padrao do
Next.js (webpack), nao o Turbopack, pois o fetcher de fontes do
Turbopack neste ambiente nao consegue baixar Google Fonts.

## Modulo RH - fatia minima (contas de Corretor + status + Kanban) - CONCLUIDA

### Envio de e-mail real (RESOLVIDO)
RhModule agora usa `ResendEmailSender` (mesmo provider ja usado no
AuthModule), nao mais `ConsoleEmailSender` - todos os e-mails do
modulo RH (boas-vindas do corretor cadastrado pelo Administrador,
aprovacao/rejeicao do cadastro publico) sao enviados de verdade.
Confirmado com teste real via API do Resend (GET /emails/:id
retornando `last_event: "delivered"`) usando o endereco de teste
`delivered@resend.dev` - cadastro publico de corretor criado, aprovado
pelo Administrador, e-mail de aprovacao chegou de verdade. Dados de
teste (tenant, cadastro) removidos ao final.

Primeira fatia do modulo RH implementada em src/modules/rh/, seguindo
Clean Architecture (domain/application/infra) e isolada dos demais
modulos (repositorios proprios sobre as tabelas User/Role, sem importar
arquivos do modulo auth).

- User ganhou o campo statusDisponibilidade ("online"/"ausente"/
  "offline", default "offline").
- CreateCorretorUseCase: so Administrador pode cadastrar corretores
  (verificado no proprio use case, nao so no controller). Cria o Role
  "Corretor" automaticamente na primeira vez que for necessario para o
  tenant. Senha temporaria gerada aleatoriamente quando o admin nao
  informa uma, enviada por e-mail via IEmailSender (ver PENDENCIA
  CRITICA acima - hoje esse envio nao e real).
- GetBoardUseCase (modulo vendas_kanban) agora recebe requesterRole e
  requesterUserId: se role for "Corretor", filtra os cards de cada
  stage por ownerId (o corretor so ve os proprios negocios no Kanban).
  Administrador continua vendo tudo. GetInboxUseCase recebe os mesmos
  dois campos por simetria mas NUNCA filtra - a Caixa de Entrada
  (cards sem stageId) e sempre visivel por completo a qualquer role,
  Corretor incluido, pois e assim que o corretor "reivindica" um lead
  (ver ClaimCardUseCase e a nota "Caixa de Entrada" mais acima).
- Frontend: Sidebar.tsx busca o proprio /auth/me (mesmo padrao ja usado
  pela Topbar) para decidir se mostra o item "Equipe" - so aparece para
  role Administrador. Tela /dashboard/equipe (lista + modal "+ Novo
  Corretor") segue o padrao Feature-Driven de src/features/imoveis/
  (store Zustand + hook de integracao). Topbar ganhou um seletor de
  status (online/ausente/offline chamando PATCH /rh/me/status),
  espelhado em localStorage (chave
  STATUS_DISPONIBILIDADE_STORAGE_KEY) so para nao "esquecer" a selecao
  entre reloads sem precisar de outra chamada a API - o valor real e
  sempre o que esta no banco. Login define o status como "online"
  automaticamente logo apos autenticar.
- Testado com Playwright (biblioteca playwright, ja presente no
  devDependencies do frontend, sem instalar @playwright/test) de ponta
  a ponta: tenant + Administrador novos, login do admin, item Equipe
  visivel, criacao de corretor, confirmacao do e-mail de boas-vindas no
  log do ConsoleEmailSender (senha temporaria extraida do log para o
  login seguinte), card criado pelo admin, login do corretor em
  contexto separado do Playwright, item Equipe ausente para o corretor,
  card proprio do corretor visivel, card do admin invisivel para o
  corretor, Caixa de Entrada carregando normalmente para o corretor.
  Tenant de teste removido ao final (cascata).

## Modulo RH completo (cadastro publico multi-perfil + aprovacao + hierarquia) - CONCLUIDA
Expande a fatia minima acima (mesma pasta src/modules/rh/) com o
cenario completo de negocio ja descrito na secao "Modulo futuro
planejado: RH / Cadastros e Perfis" mais abaixo (agora implementado,
nao mais planejado).

User ganhou os campos: statusCadastro ("pendente_aprovacao"/
"aprovado"/"rejeitado", default "aprovado" - contas ja existentes e
contas criadas por Administrador ou pelo seed continuam aprovadas
direto; so o cadastro publico usa "pendente_aprovacao" explicitamente),
telefone, cpf, creci (corretores), nomeImobiliaria/cnpj/creciJ/
cargoNaEmpresa (Imobiliaria Parceira), cargoHierarquico/superiorId
(hierarquia, preenchidos so na aprovacao), tipoCliente (comprador/
proprietario/ambos, so Cliente), cep/endereco. superiorId e uma
auto-referencia opcional em User (onDelete: SetNull).

AuthenticateUserUseCase bloqueia login se statusCadastro !==
"aprovado", com mensagem especifica para pendente ("ainda esta em
analise") e rejeitado ("nao foi aprovado").

PublicSignupUseCase (POST /rh/cadastro-publico, rota PUBLICA, sem
JwtAuthGuard) cria o User com statusCadastro="pendente_aprovacao" e
NUNCA retorna token. Le o tenant fixo de PUBLIC_SIGNUP_TENANT_ID (.env)
- hoje so 1 imobiliaria pode receber cadastros publicos. Role por
tipoPerfil: "comprador" -> Role "Cliente" (novo); "corretor_house" ->
Role "Corretor" (REAPROVEITA o mesmo Role da fatia minima, de
proposito - um corretor da House aprovado tem as mesmas regras de
visibilidade no Kanban que qualquer outro Corretor); "corretor_parceiro"
-> Role "Corretor Parceiro" (novo); "imobiliaria_parceira" -> Role
"Imobiliaria Parceira" (novo).

AprovarCadastroUseCase/RejeitarCadastroUseCase (so Administrador):
aprovar aceita cargoHierarquico + superiorId opcionais (so relevantes
para Corretor House e Imobiliaria Parceira - Cliente e Corretor
Parceiro nao usam hierarquia) e dispara e-mail via IEmailSender (ver
"Envio de e-mail real" acima - hoje via ResendEmailSender).
ListPossiveisSuperioresUseCase lista
usuarios do tenant com cargoHierarquico ja preenchido, para popular o
seletor de superior na tela de aprovacao - por isso o primeiro
aprovado de uma hierarquia nunca tem superior disponivel ainda (e o
comportamento esperado, nao um bug).

Duas lacunas do enunciado original (schema nao listava, mas os
formularios do frontend exigiam) foram resolvidas com o usuario antes
de implementar: User.telefone (universal, todos os perfis) e
User.nomeImobiliaria (especifico da Imobiliaria Parceira, separado do
name do responsavel).

Frontend publico (fora de /dashboard, sem guard): /cadastro (3 cards:
Cliente/Corretor de Imoveis/Parceiro) -> /cadastro/cliente,
/cadastro/corretor (corretor_house), /cadastro/parceiro (sub-selecao)
-> /cadastro/parceiro/corretor (corretor_parceiro, mesmo formulario e
componente do corretor_house, so o tipoPerfil muda) e
/cadastro/parceiro/imobiliaria. Todos terminam na mesma tela de
confirmacao (CadastroRecebidoScreen) sem redirecionar para login. Link
"Criar cadastro" adicionado na tela de login.

Frontend admin: item "Aprovacoes" no Sidebar (so Administrador,
mesmo padrao de fetch de /auth/me ja usado por "Equipe") ->
/dashboard/rh/aprovacoes, lista + painel lateral com todos os dados do
cadastro e os botoes Aprovar/Rejeitar; campos de cargoHierarquico e
superior (via GET /rh/possiveis-superiores) so aparecem quando o
roleName do cadastro e "Corretor" ou "Imobiliaria Parceira".

Testado com Playwright de ponta a ponta: cadastro publico de Corretor
via UI, login bloqueado com mensagem "em analise", Administrador
aprova 2 corretores em sequencia (o primeiro como "gerente" sem
superior - e o primeiro da hierarquia -, o segundo como "corretor" com
o primeiro como superior, confirmado direto no banco), login liberado
apos aprovacao, e o mesmo fluxo simplificado para Cliente (sem CRECI,
sem campos de hierarquia no painel - confirmado que o bloco de
hierarquia realmente nao aparece para esse perfil). Dados de teste
removidos ao final (cascata).

## Correcao: controle de acesso por role no dashboard - CONCLUIDA
Fecha a pendencia registrada acima ("roles novas nao tem restricao de
acesso ao dashboard"): agora Cliente e Imobiliaria Parceira NAO
conseguem mais chamar nenhuma rota do dashboard (403 Forbidden), so
continuam logando normalmente.

Confirmado durante esta correcao (o usuario pediu para verificar
explicitamente): corretor_house e corretor_parceiro NAO reaproveitam a
mesma role hoje - corretor_house usa "Corretor" (fatia minima
original), corretor_parceiro usa "Corretor Parceiro" (role separada,
criada na Fatia RH completo). Decisao tomada com o usuario: manter as
duas roles separadas no banco (uteis para relatorios/hierarquia
futuros), mas dar acesso ao dashboard para as duas. Por isso
DASHBOARD_ROLES = ["Administrador", "Corretor", "Corretor Parceiro"].

Implementacao: `RolesGuard` (src/shared/infra/http/guards/roles.guard.ts)
+ decorator `@Roles(...)` (src/shared/infra/http/decorators/
roles.decorator.ts), complementar ao JwtAuthGuard (sempre usado DEPOIS
dele - le req.user.role ja preenchido pelo JWT). Sem @Roles(...), a
guard libera qualquer role autenticado (comportamento identico a antes
dela existir) - por isso NAO foi aplicada em src/modules/auth/
(login/registro/`/auth/me` continuam abertos a qualquer role, inclusive
Cliente, que precisa do proprio role para o frontend decidir para onde
redirecionar).

`DASHBOARD_ROLES` centralizado em
src/shared/domain/constants/dashboard-roles.ts, aplicado com
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...DASHBOARD_ROLES)`
em TODOS os controllers do dashboard: PipelineController/CardController
(vendas_kanban), os 5 controllers de gestao_imobiliaria, WhatsAppController
(whatsappmarketing), ViviSessionController/ViviConversationController
(vivi_sdr), RoletaController (roleta_online). No RhController (guards
por metodo, ja que /rh/cadastro-publico precisa ficar publica), os
endpoints Administrador-only (criar corretor, listar/aprovar/rejeitar
cadastros pendentes, listar possiveis superiores) usam `@Roles('Administrador')`
diretamente (mais estrito que DASHBOARD_ROLES, e reforca - nao
substitui - a checagem que ja existia dentro dos proprios use cases);
`/rh/corretores` (GET) e `/rh/me/status` usam DASHBOARD_ROLES.

Frontend: login agora le o role da resposta do login e, se NAO estiver
em DASHBOARD_ROLES (mesma lista, espelhada em
frontend/src/core/constants/dashboardRoles.ts), redireciona para
/minha-conta em vez de /dashboard/kanban - e nem tenta chamar
PATCH /rh/me/status (que agora tambem retornaria 403 pra essas roles).
/minha-conta e uma pagina publica fora do layout do dashboard (sem
Sidebar/Topbar, sem nenhuma chamada de API que exigiria role de
dashboard), so com a mensagem "Sua conta foi aprovada! Em breve
teremos uma area exclusiva para voce." e um botao de logout. Uma
tentativa de acessar uma rota do dashboard direto pela URL (ex:
/dashboard/kanban) com uma role bloqueada carrega a casca da pagina
normalmente mas os dados reais (pipeline, cards) nunca aparecem,
porque a chamada a API por baixo retorna 403 - nao ha um guard de rota
no frontend (Next.js) dedicado, o bloqueio real e sempre no backend.

Testado de ponta a ponta com Playwright: Cliente aprovado recebe 403
em /pipelines (API) e cai em /minha-conta apos login pela UI, tentativa
de acessar /dashboard/kanban direto pela URL nao mostra as colunas do
Kanban (dados nao carregam), Corretor aprovado continua acessando
/pipelines (200) e o dashboard completo normalmente, tanto via API
quanto pela UI. Dados de teste removidos ao final (cascata).

## Modulo Roleta Online (distribuicao automatica de leads) - CONCLUIDA
Modulo src/modules/roleta_online/ implementado em Clean Architecture,
seguindo o mesmo padrao de desacoplamento via EventEmitter2 ja usado
pela VIVI (whatsappmarketing -> vivi_sdr): CreateQuickCardUseCase
(modulo vendas_kanban) emite o evento generico 'card.sem_dono.criado'
{ tenantId, cardId, pipelineId } apos criar um card sem dono, sem
conhecer quem escuta. CardSemDonoCriadoListener (roleta_online) escuta
esse evento e chama DistributeLeadUseCase, engolindo qualquer erro (so
loga) para nunca derrubar a criacao do card. roleta_online importa
VendasKanbanModule e RhModule diretamente (dependencia de modulo, nao
circular) para reaproveitar ClaimCardUseCase, ICardRepository,
IStageRepository, ICorretorRepository e IRoleRepository ja exportados -
mesmo padrao que o vivi_sdr ja usa para consumir vendas_kanban.

Uma RoletaConfig por tenant (upsert automatico com os defaults do
schema na primeira leitura, ver GetRoletaConfigUseCase), com duas
opcoes configuraveis independentes (so o Administrador altera, via
PATCH /roleta/config):

- **Algoritmo** (como escolher o corretor):
  - `round_robin` (default): ordena os corretores online por id, pega
    o proximo depois de ultimoCorretorId (ou o primeiro, se nao houver
    ou se esse corretor nao estiver mais online), sempre atualiza
    ultimoCorretorId - independente do modo.
  - `menor_fila`: conta os cards ativos de cada corretor online (com
    stage preenchida, fora da stage terminal "Fechamento" - nome fixo,
    mesmo do pipeline padrao) e escolhe quem tem menos.
- **Modo** (o que fazer com o corretor escolhido):
  - `automatico`: atribui de vez, reaproveitando o ClaimCardUseCase
    existente (mesmo efeito de "assumir o lead" - ownerId + primeira
    stage do pipeline).
  - `semi_automatico` (default): so grava Card.suggestedOwnerId, sem
    tocar ownerId/stageId - o card continua na Caixa de Entrada, com
    um badge "Sugerido para: <nome>", ate alguem confirmar via POST
    /cards/:id/confirmar-sugestao (ConfirmSuggestedOwnerUseCase, que
    tambem reaproveita o ClaimCardUseCase por baixo). So o proprio
    corretor sugerido ou um Administrador podem confirmar.

Se a Roleta estiver inativa (ativa=false, default) ou nao houver
nenhum corretor com statusDisponibilidade="online" no momento, o
DistributeLeadUseCase nao faz nada - o lead continua caindo na Caixa
de Entrada exatamente como antes deste modulo existir (nenhuma
mudanca de comportamento para quem nao ativou a Roleta).

Frontend: bloco "Roleta Online" em /dashboard/equipe (toggle
ativa/inativa, select de algoritmo, select de modo, texto explicativo
por opcao), visivel so para Administrador (fetch de /auth/me, mesmo
padrao ja usado no Sidebar). InboxView.tsx (Caixa de Entrada) mostra o
badge "Sugerido para: <nome>" e troca "Iniciar Atendimento" por
"Confirmar Atribuicao" quando o card tem suggestedOwnerId.

Testado com Playwright de ponta a ponta: tenant/admin/2 corretores de
teste (ambos online), Roleta ativada em round_robin + automatico via
UI, 3 leads criados via /cards/quick (simulando um webhook) alternando
corretamente entre os 2 corretores, troca para semi_automatico via UI,
4o lead virando sugestao (ownerId nulo, suggestedOwnerId preenchido),
corretor sugerido confirmando pela UI (badge + botao), card migrando
para "Em Atendimento" com o dono certo, e por fim os 2 corretores
ficando offline e um novo lead permanecendo na Caixa de Entrada sem
dono e sem erro. Tenant de teste removido ao final (cascata).

## Modulo E-doc (assinatura eletronica) - Fatia 1 - CONCLUIDA
Origem: logica PORTADA do projeto antigo de Daniel
(C:\laragon\www\ivillar\crm) - o backend de assinaturas de la foi
apagado por acidente num commit de "correcao de build" nao
relacionado (ver memoria da analise anterior), mas recuperado via
`git show` dos commits anteriores a destruicao. A engenharia de
seguranca do original (validacao de imagem por magic-bytes, hash
SHA-256 duplo, trilha de auditoria com IP/UA, transacao no fechamento
multi-signatario, tokens com expiracao) foi preservada; so o visual
foi refeito do zero com a identidade atual do gestordevendas.
Simplificacao desta fatia: SEM editor de posicionamento de campos - a
assinatura sempre vai no final do documento, em posicao fixa (ver
"Fatia 2" logo abaixo, ja CONCLUIDA, para o editor com react-rnd).

Modulo src/modules/edoc/, Clean Architecture. 3 modelos novos:
SignatureEnvelope (documento + status: rascunho -> aguardando_
assinaturas -> concluido, ou cancelado a qualquer momento antes de
concluido), SignatureRecipient (um signatario, com order sequencial
comecando em 1) e SignatureEvent (trilha de auditoria: criado/
enviado/visualizado/assinado/concluido/cancelado, com IP/User-Agent
quando vem da rota publica). Duas leituras do enunciado original
resolvidas durante a implementacao (nao pausei para perguntar, ja que
o proprio enunciado resolvia a ambiguidade em outro trecho):
SignatureRecipient.accessToken/tokenExpiresAt sao nullable (String?/
DateTime?, apesar do enunciado nao marcar "?") porque
SendEnvelopeUseCase e quem gera os tokens, no envio - eles nao existem
ainda quando o envelope esta em "rascunho".

Fluxo sequencial estrito: SendEnvelopeUseCase gera o token de TODOS os
destinatarios de uma vez, mas so envia e-mail para o primeiro da
ordem. SignDocumentUseCase reforca a ordem em duas camadas: alem do
e-mail so chegar na vez certa, tambem BLOQUEIA a assinatura em si se
existir algum destinatario de ordem menor ainda pendente
(countPendingBeforeOrder) - defesa em profundidade, mesmo que alguem
tente usar um token "futuro" que ja foi gerado mas ainda nao deveria
ser usado. Ao assinar, se for o ultimo da ordem, completeWithEvent
(no repositorio) fecha o envelope e registra o evento "concluido"
numa unica transaction Prisma - mesmo padrao ja usado em
PrismaUserRepository.registerCompanyWithOwner.

signatureImageData aceita duas formas (o proprio schema documenta
isso): data URL PNG (canvas, com validacao de magic-bytes alem da
regex, mesma tecnica do projeto antigo) ou o nome digitado (texto
puro, sem validacao de imagem). Rotas GET/POST /edoc/sign/:token sao
PUBLICAS (sem JwtAuthGuard/RolesGuard) - o token e a propria fronteira
de seguranca, por isso SignatureRecipient nao tem tenantId proprio
(mesmo padrao ja usado em PasswordResetToken/TwoFactorCode - o acesso
autenticado sempre passa pelo SignatureEnvelope, que ja e tenant-
scoped, primeiro). Rotas autenticadas (EnvelopeController) usam
DASHBOARD_ROLES como as demais; CancelEnvelopeUseCase e mais estrito -
so Administrador ou quem criou o envelope.

IFileStorageService reaproveitado literalmente do modulo
gestao_imobiliaria (LocalFileStorageService, sem alteracao) - efeito
colateral conhecido: os PDFs de assinatura ficam fisicamente em
uploads/imoveis/ junto com fotos de imoveis (pasta compartilhada,
so porque hoje os dois modulos usam a mesma implementacao concreta;
trocar para S3 no futuro afeta os dois igualmente). IEmailSender
ligado a ResendEmailSender (mesmo provider ja usado no AuthModule e no
RH, nao mais ConsoleEmailSender) - e-mails de assinatura (convite +
repasse para o proximo signatario) sao enviados de verdade. Confirmado
com teste real via API do Resend (GET /emails/:id retornando
`last_event: "delivered"`) usando `delivered@resend.dev`: envelope
criado e enviado, e-mail de convite para assinatura chegou de verdade.
Dados de teste removidos ao final.

PENDENCIA DE BUILD registrada (fora do escopo original, mas necessaria
para o item pedir explicitamente react-pdf/pdfjs-dist): react-pdf
10.x + pdfjs-dist 5.x quebra em runtime no Next.js 15 com webpack
("TypeError: Object.defineProperty called on non-object" dentro de
pdf.mjs) - o build "moderno" do pdfjs-dist e internamente um bundle
Webpack da propria Mozilla disfarcado de ESM puro, e o webpack do
Next.js nao consegue processa-lo (nem com transpilePackages, nem com
alias para a build "legacy" - so downgrade resolveu). Fixado com
`react-pdf@9.2.1` (trava em `pdfjs-dist@4.8.69`, anterior a essa
mudanca de build). Alem disso, pdfjs-dist so pode rodar no browser -
executa codigo que quebra em SSR - por isso o visualizador de PDF
(PdfViewer.tsx) e isolado num componente proprio, importado via
`next/dynamic({ ssr: false })` em src/app/assinar/[token]/page.tsx.
Se algum dia atualizar react-pdf/pdfjs-dist, testar de novo com
cuidado antes de assumir que os dois problemas acima (SSR e o erro de
build) continuam corrigidos.

Frontend: item "E-doc" no Sidebar (visivel a qualquer role de
dashboard, sem restricao extra). /dashboard/edoc lista envelopes
(status colorido, quantidade de assinantes, data). CreateEnvelopeModal
(upload de PDF + titulo + lista de destinatarios com setas para
reordenar a sequencia) chama criar + enviar em uma acao so ("Criar e
Enviar"). /assinar/[token] e publica, fora do layout do dashboard:
mostra o PDF, nome de quem esta assinando, abas "Desenhar assinatura"
(canvas HTML5 nativo via Pointer Events, sem lib paga) ou "Digitar
nome", tela de confirmacao apos assinar, e mensagem clara de link
vencido/cancelado quando aplicavel.

Testado de ponta a ponta com Playwright: criacao de envelope via UI
com PDF minimo gerado por codigo (xref valido, sem depender de
biblioteca de geracao de PDF) e 2 destinatarios, e-mail do primeiro
confirmado no log com o token certo, assinatura publica via "digitar
nome", e-mail do segundo destinatario disparado automaticamente em
seguida (confirmado no log), segundo assina, envelope confirmado como
"concluido" (via API e na UI), e um envelope separado testando token
expirado (data ajustada direto no banco) mostrando a mensagem clara de
link vencido. Documento fisico e tenant de teste removidos ao final.

## Modulo E-doc (assinatura eletronica) - Fatia 2 (editor de posicionamento) - CONCLUIDA
Escopo desta fatia: cada destinatario recebe UM campo de assinatura
posicionavel (pagina + posicao x/y) - sem suporte a outros tipos de
campo (data, rubrica, texto livre), deixado para uma fatia futura se
for necessario.

Modelo novo `SignatureField` (envelopeId, recipientId, pageNumber,
xPercent/yPercent/widthPercent/heightPercent, todos 0-1 exceto
pageNumber) + `SignatureEnvelope.signedDocumentUrl` (String?,
preenchido so quando o envelope fecha). Posicoes sao percentuais (nao
pixels absolutos) para renderizar corretamente em qualquer resolucao
de tela ou tamanho de pagina do PDF.

`CreateEnvelopeUseCase` recebe os campos referenciando `recipientIndex`
(posicao no array de destinatarios), nao um `recipientId` real -
destinatarios ainda nao existem quando a requisicao chega. O use case
cria os `SignatureRecipient` primeiro, depois mapeia
`recipients[field.recipientIndex].id` para criar os `SignatureField`
via `createMany`. Esse contrato (`recipientIndex`) atravessa
DTO -> controller -> use case -> frontend de forma consistente.

`GenerateSignedPdfUseCase` (pdf-lib, MIT) e chamado pelo
`SignDocumentUseCase` logo apos `completeWithEvent` (transaction que
fecha o envelope), mas FORA dela - geracao de PDF e I/O de arquivo, nao
deve segurar lock de banco. Envolvido em try/catch que so loga o erro
(nao desfaz a assinatura ja registrada se a geracao falhar). Para cada
`SignatureField`, abre o PDF original (via
`IFileStorageService.download()`, metodo novo adicionado a interface
so nesta fatia - `LocalFileStorageService` ja tinha tudo que precisava
via `fs/promises.readFile`, efeito colateral zero no unico outro
consumidor do arquivo compartilhado, gestao_imobiliaria, que nunca
chamava `download()`), decodifica `signatureImageData` do destinatario
(mesma dualidade da Fatia 1: data URL PNG via `pdfDoc.embedPng`, ou
nome digitado via `pdfDoc.drawText` com fonte italica) e desenha na
pagina/posicao certa. Conversao de eixo: xPercent/yPercent do frontend
usam origem no canto superior-esquerdo (convencao CSS/canvas), PDF usa
origem no canto inferior-esquerdo - `y = pageHeight - yPercent*pageHeight - fieldHeight`
inverte isso. PDF final salvo via `IFileStorageService.upload()`, url
gravada em `SignatureEnvelope.signedDocumentUrl`. Nova rota
`GET /edoc/envelopes/:id/signed-pdf` (autenticada) so retorna algo se
`status === 'concluido'`.

`GetEnvelopeByTokenUseCase` passou a devolver tambem o(s)
`SignatureField` do destinatario da sessao (array, ja pensando numa
fatia futura com mais de 1 campo por pessoa - hoje sempre 1).

Frontend: `CreateEnvelopeModal` virou wizard de 2 passos - Passo 1 e
igual a Fatia 1 (PDF + titulo + destinatarios); Passo 2
(`FieldPositionEditor.tsx`, novo) renderiza o PDF via `react-pdf`
(mesma trava de versao `react-pdf@9.2.1`/`pdfjs-dist@4.8.69` e mesmo
`ssr:false` da Fatia 1 - ver pendencia de build documentada acima,
continua valendo aqui) com navegacao entre paginas, e uma caixa
arrastavel/redimensionavel (`react-rnd`, nova dependencia) por
destinatario sobre a pagina atual, mais um seletor de pagina por
destinatario abaixo da lista (mais simples que arrastar entre paginas
para trocar a pagina do campo). Ao entrar no Passo 2, os campos sao
sempre recalculados do zero a partir da lista atual de destinatarios
(posicoes escalonadas verticalmente na pagina 1) - decisao deliberada
para nao arriscar dessincronizar `recipientIndex` se o admin voltar ao
Passo 1 e reordenar/remover destinatarios (perde posicionamento manual
ao voltar, mas evita bug de indice trocado).

`PdfViewer.tsx` foi movido de `src/app/assinar/[token]/` para
`src/features/edoc/components/` (reaproveitado agora tambem pelo
editor de posicionamento) e ganhou a prop `highlightField`: desenha um
retangulo com borda tracejada amber na posicao exata do campo do
destinatario, na pagina certa, com scroll automatico ate ela. A tela
publica `/assinar/[token]` mostra esse destaque logo acima do
canvas/input de assinatura, com a legenda "E aqui que sua assinatura
vai aparecer no documento (destacado na pagina N)".

Nova pagina `src/app/dashboard/edoc/[id]/page.tsx` (detalhe do
envelope: lista de destinatarios com status/data de assinatura, e
botao "Baixar documento assinado" quando `status === 'concluido'` e
`signedDocumentUrl` existe). Lista de envelopes
(`/dashboard/edoc/page.tsx`) ganhou clique na linha para navegar ate o
detalhe.

Testado de ponta a ponta com Playwright: envelope criado via UI com PDF
de teste de 2 paginas (gerado com pdf-lib) e 2 destinatarios, campo do
primeiro arrastado na pagina 1, campo do segundo movido para a pagina 2
(seletor) e tambem arrastado la, confirmado no banco que cada
`SignatureField.pageNumber` ficou correto, assinatura publica dos dois
via "digitar nome" com o destaque conferido na pagina certa em cada
link (screenshot de cada tela), envelope fechou como "concluido",
`signedDocumentUrl` preenchido, PDF final baixado e confirmado com 2
paginas via `pdf-lib` (inspecao de arquivo, sem necessidade de
comparacao visual), botao "Baixar documento assinado" confirmado na
pagina de detalhe. Tenant, envelope e arquivos fisicos (PDF original +
PDF assinado) removidos ao final.

## Modulo E-doc (assinatura eletronica) - Fatia 3 (papeis de participante + rubrica) - CONCLUIDA
Adiciona papeis de participante (Destinatario, Remetente, Testemunha)
com ordem de assinatura em GRUPOS, e campo de RUBRICA (repetida em
todas as paginas) alem da assinatura ja existente (na ultima pagina).

**Regra final do campo (autoritativa, confirmada com o usuario apos
2 correcoes durante a especificacao original)**:
- **Destinatario** e **Remetente**: rubrica em TODAS as paginas do
  documento + assinatura completa na ULTIMA pagina.
- **Testemunha**: SOMENTE assinatura completa na ULTIMA pagina - NUNCA
  rubrica. A opcao de adicionar rubrica nem aparece na UI para
  participantes com `role=testemunha` (nao e so escondida por CSS -
  o botao correspondente simplesmente nao e renderizado nesse caso).

`SignatureRecipient` ganhou `role` (String: "destinatario"/
"remetente"/"testemunha", default "destinatario") e `order` mudou de
significado: agora conta a ordem DENTRO DO PROPRIO GRUPO de role, nao
mais uma ordem global entre todos os participantes do envelope (ex:
com 2 Destinatarios + 1 Remetente + 1 Testemunha, o 2o Destinatario
tem order=2 mas o Remetente e a Testemunha tem order=1 cada, dentro
dos proprios grupos). A sequencia REAL de assinatura (quem recebe o
e-mail e em que ordem, e quem pode assinar quando) combina grupo +
ordem: todos os Destinatarios assinam primeiro (na ordem entre eles),
depois todos os Remetentes, depois todas as Testemunhas. Essa regra
vive em `src/modules/edoc/domain/services/recipient-sequence.ts`
(`sortBySignatureSequence`) - uma funcao pura de DOMINIO (sem Prisma/
infra), usada tanto por `SendEnvelopeUseCase` (so o primeiro da
sequencia recebe o e-mail no envio; os demais so recebem quando
completeWithEvent/o proximo passo chega neles) quanto por
`SignDocumentUseCase` (bloqueia com HTTP 409 qualquer tentativa de
assinar fora da vez, mesmo com um token valido ja gerado - defesa em
profundidade identica ao que ja existia na Fatia 1, so que agora
calculada em memoria a partir da lista completa de destinatarios em
vez de uma consulta SQL por `order+1`).

Como essa mudanca de semantica do `order` tornou os metodos antigos
`findNextInOrder`/`countPendingBeforeOrder` do
`ISignatureRecipientRepository` incorretos (uma consulta SQL simples
por `order` nao sabe combinar com o grupo), eles foram REMOVIDOS (nao
deixados como codigo morto/errado) tanto da interface quanto da
implementacao Prisma - a logica de sequencia agora vive inteira nos
use cases, via `sortBySignatureSequence`.

`SignatureField` ganhou `tipo` (String: "assinatura"/"rubrica",
default "assinatura"). A REPETICAO da rubrica em todas as paginas e
responsabilidade do FRONTEND, nao do backend: o botao "Adicionar
Rubrica" no editor de posicionamento gera 1 `SignatureField` por
pagina do documento de uma vez (mesmo `recipientId`, `tipo="rubrica"`,
todos com a MESMA posicao x/y/largura/altura) - arrastar/redimensionar
qualquer uma dessas caixas (em qualquer pagina que esteja visivel no
momento) propaga a nova posicao para as demais, mantendo todas
identicas entre si; o backend so recebe e salva a lista final de
campos que o frontend montou. `CreateEnvelopeUseCase` valida que
nenhum campo com `tipo=rubrica` esteja associado a um destinatario com
`role=testemunha` (rejeita com 400, nao ignora silenciosamente -
decisao deliberada: um formulario mal formado que tentasse burlar a
regra deve falhar de forma visivel, nao ser corrigido as escondidas).

`GenerateSignedPdfUseCase` NAO precisou de nenhuma mudanca funcional
para suportar a Fatia 3 - ja iterava por CAMPO (nao por destinatario),
buscando `recipient.signatureImageData` de forma independente para
cada `SignatureField`. Isso significa que "rubrica repetida em N
paginas" e, do ponto de vista do carimbo final, apenas "N campos com o
mesmo `recipientId` e a mesma imagem de assinatura, em posicoes
diferentes" - um caso que o loop existente desde a Fatia 1/2 ja
cobria naturalmente, sem alteracao de codigo (so um comentario
explicativo foi adicionado).

Frontend: o wizard de criacao de envelope
(`CreateEnvelopeModal.tsx`, Passo 1) ganhou 3 badges explicativos no
topo ("Destinatario - Assina o documento" azul, "Remetente - Assina
apos destinatarios" verde, "Testemunha - Assina por ultimo" amber/
laranja), cada participante e um card colorido pelo proprio papel
(borda + fundo suave) com campos Nome/E-mail + um dropdown de papel +
botao de remover, e 3 botoes de adicionar dedicados ("+ Destinatario"/
"+ Remetente"/"+ Testemunha", cada um ja pre-preenchendo o papel
correspondente). A cor de Testemunha em amber e uma cor SEMANTICA de
papel (mesma familia dos badges de status do projeto, ex: "Aguardando
Assinaturas" do proprio E-doc), nao um elemento de marca - nao conflita
com a regra de "amber reservado para status" (ver secao de identidade
visual mais abaixo). `ROLE_OPTIONS`/`getRoleOption` centralizados em
`features/edoc/constants.ts`.

O editor de posicionamento (`FieldPositionEditor.tsx`, Passo 2) mostra,
para cada participante Destinatario/Remetente, um controle "+
Adicionar Rubrica (todas as paginas)" (substituido por "Rubrica em
todas as N paginas" + botao remover, uma vez adicionada) alem do
seletor de pagina da Assinatura ja existente desde a Fatia 2; para
Testemunha, so o controle de Assinatura aparece - a opcao de rubrica e
omitida da renderizacao, nao apenas desabilitada. As caixas
arrastaveis sobre o PDF diferenciam visualmente assinatura (retangulo
maior, borda solida) de rubrica (quadrado menor, borda tracejada),
sempre na cor do papel do participante. Cada campo e identificado de
forma unica por `(recipientIndex, tipo)` - nunca existe mais de 1
assinatura nem mais de 1 "grupo" de rubrica por participante, entao
esse par e suficiente como chave, sem precisar de um id proprio por
campo.

A tela publica de assinatura (`/assinar/[token]`) mostra um indicador
"Campo X de Y" com setas de navegacao quando o participante tem mais
de 1 campo (Destinatario/Remetente com rubrica = 4 campos; Testemunha
sem rubrica = so 1, indicador nem aparece). A navegacao so troca qual
posicao esta em destaque no `PdfViewer` (preview de onde cada campo
vai aparecer, com scroll automatico ate a pagina certa) - a assinatura
em si e desenhada ou digitada UMA UNICA VEZ e enviada numa unica
chamada a API, que o backend aplica a TODOS os campos daquele
participante (ver `GenerateSignedPdfUseCase` acima). `PdfViewer.tsx`
foi ajustado para rolar ate a pagina em destaque a cada troca de campo
(antes, na Fatia 2, so rolava uma vez, na primeira renderizacao).

Testado de ponta a ponta com Playwright real (script descartavel,
removido ao final - ver metodologia no topo deste arquivo): envelope
criado via UI com 3 participantes (1 de cada papel) num PDF de teste
de 3 paginas; confirmado que a opcao de rubrica NAO aparece para
Testemunha no editor (screenshot); rubrica adicionada para Destinatario
e Remetente (3 campos cada, 1 por pagina) + assinatura movida para a
ultima pagina nos 3 participantes (4 campos para Destinatario/
Remetente, 1 para Testemunha - confirmado direto no banco). Ordem de
assinatura confirmada por TENTATIVA DIRETA de assinar fora da vez (nao
so inspecao de dado): Remetente e Testemunha bloqueados com HTTP 409
tentando assinar antes do Destinatario; apos o Destinatario assinar
(via UI publica, "Digitar nome", indicador "Campo 1 de 4" confirmado),
a Testemunha continua bloqueada (409) ate o Remetente TAMBEM assinar;
so entao a Testemunha consegue assinar (1 campo, sem indicador de
navegacao). Envelope fechou "concluido", PDF final com 3 paginas
confirmado via `pdf-lib`; como o teste assinou via "Digitar nome" (sem
imagem PNG), a prova de carimbo foi o crescimento do arquivo final
(2447 bytes) sobre o original (1356 bytes) - suficiente para confirmar
que os 9 campos (4+4+1) foram realmente desenhados no PDF, mesmo sem
imagens grandes infladando o tamanho. Tenant de teste, os 3 envelopes
criados durante as tentativas e os arquivos fisicos (PDFs originais +
assinado) foram removidos ao final via script de limpeza dedicado.

## Modulo E-doc (assinatura eletronica) - Fatia 4 (rascunho, Word/Excel, e-mail customizavel, dashboard) - CONCLUIDA
Fecha uma pendencia real (bug do rascunho) e adiciona 4 melhorias
independentes: conversao Word/Excel para PDF via LibreOffice,
validacao inline de participantes, dashboard com estatisticas/filtros/
busca, e mensagem de e-mail customizavel.

### Correcao: bug do rascunho
Antes desta fatia, `CreateEnvelopeUseCase` sempre criava o envelope com
`status="rascunho"` e o frontend imediatamente chamava `send()` em
seguida (acao unica "Criar e Enviar") - SE o envio falhasse por
qualquer motivo (rede, validacao), o envelope ficava PARA SEMPRE em
rascunho, sem nenhuma rota para reabrir/editar/completar/enviar depois.
`GetEnvelopeForEditUseCase` (retorna documento+participantes+campos, so
funciona se `status="rascunho"`, senao lanca erro claro) e
`UpdateEnvelopeDraftUseCase` (atualiza titulo/documento/participantes/
campos/e-mail de um rascunho existente, mesma restricao) fecham essa
lacuna. Novas rotas: `GET /edoc/envelopes/:id/edit`,
`PATCH /edoc/envelopes/:id` (ambas `JwtAuthGuard`, tenant-scoped via
`findByIdAndTenant`, mesma guarda dos demais endpoints do modulo).

`UpdateEnvelopeDraftUseCase` recria participantes e campos DO ZERO a
cada atualizacao (`deleteAllByEnvelope` + `createMany`, novo metodo no
`ISignatureRecipientRepository` - o `onDelete:Cascade` do schema ja
remove os `SignatureField` associados junto) em vez de tentar
"diffar" contra o estado anterior - mesma decisao ja tomada no
frontend ao reentrar no Passo 2 do wizard desde a Fatia 2/3, agora
aplicada tambem no backend por consistencia. Documento antigo NAO e
apagado do disco ao trocar por um novo - mesmo comportamento ja aceito
em outros pontos do projeto (ex: `DeleteInquilinoDocumentoUseCase`).

Validacao de participantes/campos (antes duplicada dentro de
`CreateEnvelopeUseCase`) foi extraida para
`domain/services/envelope-validation.ts`
(`validateRecipientsAndFields`/`buildRecipientsWithGroupOrder`, funcoes
PURAS - sem NestJS/Prisma, retornam uma mensagem de erro em vez de
lancar excecao HTTP diretamente, respeitando a regra de que `domain/`
nao pode importar bibliotecas externas) - reaproveitada por
`CreateEnvelopeUseCase` e `UpdateEnvelopeDraftUseCase` para nao
duplicar a mesma logica em dois lugares.

### Conversao Word/Excel para PDF via LibreOffice
`IDocumentConverterService` (dominio) / `LibreOfficeConverterService`
(infra, `src/modules/edoc/infra/services/`) - roda o LibreOffice em
modo headless via `child_process.spawn` (`soffice --headless
--convert-to pdf --outdir <pasta_temp> <arquivo>`), grava o arquivo
recebido numa pasta temporaria (`fs.mkdtemp`), aguarda a conversao e le
o PDF gerado de volta, sempre limpando a pasta temporaria no `finally`
(mesmo se a conversao falhar). Timeout defensivo de 60s com
`child.kill()` - verificado NA PRATICA durante o desenvolvimento desta
fatia que o `soffice.exe` pode "pendurar" indefinidamente esperando uma
janela/dialogo se `--headless` nao for respeitado por algum motivo
(aconteceu ao testar so `--version` sem `--headless`); sem o timeout, a
requisicao HTTP travaria para sempre nesse cenario.

Caminho do executavel configuravel via `LIBREOFFICE_PATH` (.env), com
fallback por sistema operacional se a variavel nao estiver definida:
Windows usa `C:\Program Files\LibreOffice\program\soffice.exe`
(instalacao padrao nao entra no PATH automaticamente no Windows);
Linux (VPS de producao) usa so `soffice`, esperado no PATH apos
`apt install libreoffice` - **pendencia de infraestrutura**: o
LibreOffice ainda NAO esta instalado na VPS de producao
(187.77.225.184) nesta data - precisa ser instalado (`apt install
libreoffice` ou so os pacotes `libreoffice-writer libreoffice-calc`,
mais leves) antes desta fatia funcionar em producao; localmente foi
confirmado instalado e funcionando (teste manual de conversao real
antes de codar, por pedido explicito do usuario).

`PrepareEnvelopeDocumentService` (aplicacao,
`application/services/prepare-envelope-document.service.ts`) e
compartilhado por `CreateEnvelopeUseCase`/`UpdateEnvelopeDraftUseCase`:
valida tamanho maximo (30MB) e extensao/mimetype (PDF direto, ou
`.doc/.docx/.xls/.xlsx` convertidos via `IDocumentConverterService`),
sempre devolvendo um buffer PDF + hash SHA-256 - os use cases nunca
guardam um documento Word/Excel "cru", so o PDF resultante (o nome do
arquivo salvo tambem troca a extensao para `.pdf`).

**Limitacao conhecida (nao corrigida nesta fatia, fora do escopo
pedido)**: o Passo 2 do wizard (posicionamento de campos) tenta
renderizar o arquivo ORIGINAL escolhido pelo usuario (via
`URL.createObjectURL`) no visualizador de PDF do navegador - para
`.docx`/`.xlsx`, isso mostra "Failed to load PDF file." porque a
conversao real so acontece no BACKEND, no momento de salvar/enviar, nao
ha preview convertido no navegador. Os campos ainda sao salvos
corretamente nas posicoes padrao (confirmado por teste), so falta o
retorno visual - o admin posiciona "as cegas" nesse caso. Corrigir
isso exigiria um endpoint novo de "conversao para preview" chamado
assim que o arquivo e selecionado (antes mesmo do envelope existir),
fora do escopo original desta fatia - avaliar numa fatia futura se
incomodar na pratica.

### Mensagem de e-mail customizavel
`SignatureEnvelope` ganhou `emailSubject`/`emailMessage` (ambos
`String?`, sem default no banco - o template padrao
`DEFAULT_EMAIL_SUBJECT` vive em `domain/services/envelope-validation.ts`
e e aplicado na CAMADA DE APLICACAO, no momento do envio, nao na
criacao) - `SendEnvelopeUseCase` (primeiro e-mail) e `SignDocumentUseCase`
(repasse ao proximo signatario) usam
`envelope.emailSubject?.trim() || DEFAULT_EMAIL_SUBJECT` e injetam
`emailMessage` (se preenchido) no corpo do e-mail - a MESMA
customizacao vale para todo e-mail daquele envelope, nao so o do
primeiro destinatario (decisao deliberada: seria inconsistente o 1o
signatario receber um assunto customizado e o 2o receber o template
generico).

### Dashboard com estatisticas/filtros/busca
`GetEnvelopeStatsUseCase` + `ISignatureEnvelopeRepository
.countByTenantGroupedByStatus` (usa `prisma.groupBy`) - rota
`GET /edoc/stats`, em um controller PROPRIO
(`EdocStatsController`, `@Controller('edoc')`) separado de
`EnvelopeController` (que usa `@Controller('edoc/envelopes')`) ja que
`/edoc/stats` e uma rota IRMA de `/edoc/envelopes/*`, nao aninhada
dentro dela. `ListEnvelopesUseCase` ganhou filtro opcional por
`status` (exato) e `search` (titulo, `contains` case-insensitive via
Prisma) - `GET /edoc/envelopes?status=X&search=Y`, ambos opcionais e
combinaveis.

### Frontend
`CreateEnvelopeModal.tsx` virou um wizard de 3 passos (era 2):
Documento+Participantes -> Posicionar Campos -> Mensagem do E-mail
(novo). O mesmo modal agora serve tanto para CRIAR quanto para EDITAR
um rascunho (`useEdocStore.editingEnvelopeId` - `null` = criar novo;
preenchido = editar, carrega os dados via
`GET /edoc/envelopes/:id/edit` ao abrir). Reconstroi o array local de
participantes ORDENADO pela sequencia real de assinatura (grupo+ordem,
espelhando `recipient-sequence.ts` do backend) e mapeia os campos
recebidos (identificados por `recipientId`, uma FK real) para o
indice LOCAL do array reconstruido - NUNCA confia na ordem bruta em
que o backend devolveu os destinatarios para inferir indice por
posicao (essa mesma armadilha ja foi um bug real corrigido na Fatia 3,
ver `createMany` do repositorio).

Botao "Salvar rascunho" (chama `CreateEnvelopeUseCase` ou
`UpdateEnvelopeDraftUseCase` por baixo, SEM chamar `send()`) disponivel
nos 3 passos do wizard. Depois do primeiro salvamento bem-sucedido
(seja criando ou editando), o modal guarda o `id` retornado
(`savedEnvelopeId`) - cliques seguintes em "Salvar rascunho" na MESMA
sessao do modal viram `PATCH`, nunca criam um segundo envelope
duplicado.

`DocumentDropzone.tsx` (novo componente) substitui o botao simples de
upload - arrastar-e-soltar OU clicar, valida extensao/mimetype e
tamanho (30MB) no proprio frontend antes de aceitar o arquivo (o
backend valida de novo, e a fonte da verdade). Texto informativo fixo:
"Arquivos Word e Excel sao convertidos automaticamente para PDF".

Validacao inline de participantes (Passo 1): mensagens em vermelho
("Nome obrigatorio"/"E-mail invalido") abaixo de cada campo quando o
usuario tenta avancar ("Continuar" ou "Salvar rascunho") com dados
vazios/invalidos - substitui o `alert()` generico usado antes.

Passo 3 "Mensagem do E-mail": campo Assunto pre-preenchido com
`DEFAULT_EMAIL_SUBJECT` (espelhado em `constants.ts` do frontend - projetos
separados, sem compartilhamento de codigo) com contador de caracteres
(200 max, mesmo limite do `@db.VarChar(200)` no schema), e Mensagem
(textarea opcional).

`/dashboard/edoc` (lista) ganhou 4 cards de estatisticas no topo
(Total/Aguardando Assinatura/Concluidos/Rascunhos, via `GET
/edoc/stats`, re-buscado sempre que a lista de envelopes muda - criar/
enviar/cancelar), abas de filtro (Todos/Rascunho/Enviados/Concluidos/
Cancelados) e busca por titulo (debounce de 300ms). Envelopes com
`status="rascunho"` ficam clicaveis e abrem o wizard em modo edicao
(`openEditModal`); os demais continuam navegando para a pagina de
detalhe como antes.

Testado de ponta a ponta com Playwright real (script descartavel,
removido ao final): (a) envelope criado, salvo como rascunho (SEM
e-mail disparado, confirmado no banco), pagina recarregada, rascunho
reaberto via clique na lista com titulo/participante confirmados
pre-preenchidos, completado e enviado com sucesso - bug do rascunho
confirmado corrigido; (b) upload de um `.docx` minimo mas
VALIDO (OOXML/ZIP construido programaticamente, sem depender de
nenhuma biblioteca nova) convertido para PDF de verdade via LibreOffice
real (nao mockado) - documento final baixado e confirmado valido via
`pdf-lib`; (c) tentativa de avancar com nome vazio + e-mail invalido
confirma as duas mensagens inline e bloqueia o avanco; (d) os 4 cards
de estatisticas conferidos contra uma contagem direta no banco
(`groupBy`) apos criar/enviar varios envelopes de teste - todos batendo;
(e) assunto/mensagem customizados confirmados PERSISTIDOS corretamente
no banco e o envio concluindo sem erro (Resend aceitando a chamada) -
**nao foi possivel confirmar o conteudo do e-mail realmente recebido
via API do Resend nesta rodada de teste, por falta de acesso a rede
externa no ambiente de teste usado** (diferente de fatias anteriores,
que conseguiram consultar a API do Resend diretamente); a logica de
uso do assunto/mensagem customizados no corpo do e-mail foi confirmada
por leitura de codigo (`SendEnvelopeUseCase`/`SignDocumentUseCase`).
Tenant de teste e arquivos fisicos removidos ao final.

## Modulo Portal do Cliente - CONCLUIDO
Substitui a tela placeholder `/minha-conta` (que so mostrava "Sua conta
foi aprovada!") por um portal de verdade para quem faz login com Role
"Cliente" (tambem alcancavel por "Imobiliaria Parceira", que cai na
mesma rota - ver DASHBOARD_ROLES). Modulo `src/modules/portal_cliente/`,
Clean Architecture, mas SEM repositorios/modelos proprios - e uma
camada de "agregacao por leitura" que consulta dados ja existentes em
3 outros modulos.

### LIMITACAO CONHECIDA: vinculo por e-mail, nao por FK formal
Os 4 use cases (`GetMeusImoveisUseCase`, `GetMeuAtendimentoUseCase`,
`GetMinhasAssinaturasPendentesUseCase`, `GetMeusDocumentosAssinadosUseCase`)
encontram os dados do cliente logado por CORRESPONDENCIA DE E-MAIL
(`User.email` comparado a `Proprietario.email`, `Card.email` e
`SignatureRecipient.email`), nao por chave estrangeira formal - essas
3 entidades nao tem (e nao ganharam nesta fatia) nenhum campo
`userId`/`clienteId`. Isso e uma limitacao DELIBERADA e conhecida, nao
um bug: se o Administrador cadastrar o Proprietario, criar o Card ou
endereçar o envelope de assinatura com um e-mail DIFERENTE do e-mail
que o cliente usou para se cadastrar/logar, a secao correspondente
aparece vazia (com a mensagem amigavel de estado vazio, sem erro).
Corrigir isso de verdade exigiria adicionar FKs formais em
`Proprietario`/`Card`/`SignatureRecipient` apontando para `User` -
avaliar numa fatia futura se isso incomodar na pratica.

### Backend
`GetMeusImoveisUseCase` busca `Proprietario` pelo e-mail
(`IProprietarioRepository.findByTenantAndEmail`, metodo novo - usa
`findFirst`, ja que `Proprietario.email` nao tem constraint de
unicidade), lista os `Contrato` vinculados (reaproveita
`findAllByTenant(tenantId, { proprietarioId })`, ja existente) e, para
cada um, busca o `Imovel` e a foto de capa (primeira por `order`).
Retorna o status do CONTRATO (ativo/encerrado/cancelado), nao o status
do imovel. `GetMeuAtendimentoUseCase` busca `Card` pelo e-mail
(`ICardRepository.findAllByTenantAndEmail`, metodo novo, com join para
`stageName`/`ownerName` - mesmo padrao ja usado por
`findAllByPipelineInbox`/`suggestedOwnerName`) e devolve so
titulo/etapa/corretor - nunca `customFields` nem notas internas do
card, de proposito.
`GetMinhasAssinaturasPendentesUseCase`/`GetMeusDocumentosAssinadosUseCase`
usam o mesmo metodo novo `ISignatureRecipientRepository.findAllByEmailAndTenant`
(join com o envelope, ja que `SignatureRecipient` nao tem `tenantId`
proprio - ver Fatia 1), filtrando em memoria por
`status`/`envelopeStatus` (pendente+aguardando_assinaturas vs.
concluido) - so 1 metodo de repositorio novo para os 2 use cases.

Nao ha filtro adicional de "e a vez deste destinatario assinar" na
lista de pendentes (so replica o filtro pedido: `status=pendente` +
`envelopeStatus=aguardando_assinaturas`) - um destinatario de ordem
2+ que ainda nao recebeu o e-mail tambem aparece com "Assinar agora"
habilitado. Isso e um comportamento pre-existente desde a Fatia 1 (o
proprio link publico `/assinar/:token` ja nao bloqueava visualizacao
fora de ordem, so a assinatura em si via `countPendingBeforeOrder`) -
o Portal do Cliente so espelha esse comportamento, nao o piora.

`PortalClienteController` usa so `JwtAuthGuard` (SEM `@Roles`) -
qualquer usuario autenticado pode chamar, porque cada use case ja
filtra pelo PROPRIO e-mail do requisitante, entao nao ha vazamento
entre usuarios/tenants. Como o JWT so carrega `id`/`tenantId`/`role`
(nao o e-mail, ver `JwtStrategy`), o controller resolve o e-mail uma
vez por requisicao a partir do proprio id, via `IUserRepository`
(exportado por `AuthModule` so para esse fim).

`GetMeUseCase` (`/auth/me`) ganhou o campo `tipoCliente` no retorno
(`UserWithRole.tipoCliente`, presente no schema desde o modulo RH mas
nunca antes exposto por essa rota) - o frontend usa isso para decidir
quais secoes mostrar. `portal_cliente.module.ts` importa `AuthModule`,
`GestaoImobiliariaModule`, `VendasKanbanModule` e `EdocModule`
diretamente (dependencia de modulo, nao circular, mesmo padrao do
`roleta_online` importando `VendasKanbanModule`+`RhModule`) - nenhum
desses 4 modulos conhece `portal_cliente` de volta.

### Frontend
`src/app/minha-conta/page.tsx` reescrita por completo: cabecalho
proprio simples (wordmark "gestordevendas" + nome do usuario + Sair),
fora do layout do dashboard (sem Sidebar/Topbar). Busca `/auth/me` +
os 4 endpoints do portal em paralelo (`Promise.all`) ao carregar,
independente do `tipoCliente` (a filtragem e so de EXIBICAO, nao de
busca - simplifica o codigo, custo de rede irrelevante nessa escala).
Secao "Meus Imoveis" aparece se `tipoCliente` incluir "proprietario";
"Meu Atendimento" se incluir "comprador" (`tipoCliente` pode ser
"ambos", daí o `.includes()` em vez de igualdade exata); "Assinaturas
Pendentes" e "Meus Documentos" aparecem sempre. Nome tecnico da stage
traduzido para linguagem amigavel via mapa fixo
(`STAGE_FRIENDLY_LABELS`) cobrindo as 5 stages padrao criadas por
`CreateDefaultPipelineUseCase` - stages renomeadas ou criadas
manualmente pelo tenant caem no fallback (nome cru da stage). Botao
"Assinar agora" abre `/assinar/[token]` (pagina publica ja existente,
sem nenhuma duplicacao de fluxo) em nova aba.

Testado de ponta a ponta com Playwright: tenant/admin de teste, 2
cadastros publicos aprovados (Cliente com `tipoCliente=proprietario` e
`tipoCliente=comprador`), Proprietario+Imovel+Contrato criados com o
mesmo e-mail do primeiro cliente, envelope de E-doc enviado para esse
mesmo e-mail, Card criado com o e-mail do segundo cliente. Login do
primeiro cliente confirma "Meus Imoveis" e "Assinaturas Pendentes"
corretos e "Meu Atendimento" ausente; assinatura via link publico
("Digitar nome"); reload confirma migracao para "Meus Documentos" com
botao "Baixar" funcional. Login do segundo cliente confirma "Meu
Atendimento" (etapa amigavel + corretor) e "Meus Imoveis" ausente.
Screenshots de cada estado. Tenant, envelope e arquivos fisicos (PDF
original + PDF assinado) removidos ao final.

## Cenario de negocio original do modulo RH (CONCLUIDO - ver secao propria acima)
Nota historica: esta secao descrevia o planejamento original do RH,
mantida aqui so como referencia do cenario de negocio (Daniel presta
servico para uma construtora). A implementacao real esta na secao
"Modulo RH completo (cadastro publico multi-perfil + aprovacao +
hierarquia) - CONCLUIDA", mais acima.
- Equipe interna ("House"): corretores cadastrados via formulario
  proprio (exige CRECI), ficam pendentes de aprovacao do RH, depois
  sao alocados em equipe sob um Gerente de Vendas.
- Parceiros externos (fora da equipe interna): Corretor Parceiro
  (autonomo, indica clientes) e Imobiliaria Parceira (empresa externa
  com CNPJ/CRECI-J e responsavel com cargo).
- Clientes: tipoCliente distingue comprador/proprietario/ambos dentro
  de um unico Role "Cliente" (o plano original cogitava 2 Roles
  separados para isso - decisao final unificou em 1, ver secao
  "Modulo RH completo" acima).

Hierarquia (corretor -> gerente de vendas) implementada via
User.cargoHierarquico + User.superiorId, preenchidos na aprovacao pelo
Administrador - nao havia mais nada pendente deste cenario original.

## Diretriz de design: identidade visual
O usuario quer um CRM com cores alegres e motivadoras, sem perder
seriedade/profissionalismo. Base neutra (fundo claro, tipografia limpa)
com cor usada estrategicamente em pontos de destaque (status, badges,
graficos, acoes principais) - nao cor por toda a tela.

### Logo oficial (CONCLUIDO)
`frontend/public/logo.png` (imagem real, "Gestor de Vendas / CRM
Imobiliario", cores #0f74c5 azul vibrante e #142f4b azul marinho) -
substitui o wordmark em texto ("gestordevendas") que era usado antes
em `Sidebar.tsx` (topo, ~40px de altura) e `login/page.tsx`
(centralizado, ~200px de largura, acima de "Entre na sua conta").
Copiado tambem para `frontend/src/app/icon.png` - o Next.js 15 usa
esse arquivo automaticamente como favicon via convencao de nome, sem
nenhuma configuracao adicional (o `favicon.ico` antigo continua em
`src/app/` tambem, sem conflito). Sem uso de `next/image` em nenhum
lugar do projeto ate hoje - `<img>` simples com
`// eslint-disable-next-line @next/next/no-img-element`, mesmo padrao
ja usado em fotos de imovel/documentos (mantido por consistencia, nao
por limitacao tecnica).

### Cor de destaque: blue-600 (ATUAL - CONCLUIDO)
Historico: a cor de destaque ja foi indigo, depois amber (ver nota
historica abaixo), e agora e **blue** (`blue-600` padrao, `blue-700`/
hover `blue-800` nos botoes solidos com texto branco - mesma regra de
contraste ja estabelecida na troca anterior, so reaplicada: qualquer
classe que já era `amber-700`/`amber-800` para contraste virou
`blue-700`/`blue-800` automaticamente na troca mecanica, entao nenhum
ajuste extra de contraste foi necessario - confirmado que nao sobrou
nenhum caso `bg-blue-600` + `text-white` no frontend). Troca feita via
busca/substituicao de `amber-` -> `blue-` (mesmo nivel de intensidade)
em todo `frontend/src/`, EXCETO os usos de amber que sao cor de
STATUS/SEMANTICA (continuam amber de proposito, nao sao "destaque"):
badge de temperatura "morno" do Kanban (`InboxView.tsx`/`KanbanCard.tsx`),
badge de status "Reservado" do Catalogo de Imoveis e badge "Em Analise"
da analise de credito de Inquilinos (ambos em
`features/imoveis/constants.ts`), badge de status "Aguardando
Assinaturas" do E-doc (`features/edoc/constants.ts`), e o ponto de
status "Ausente" da Equipe (`features/equipe/constants.ts`) - todos
selos/indicadores de um estado especifico do dominio, nao elementos de
marca. Os toggles/switches (RoletaConfigCard, VIVI on/off no WhatsApp)
- que na troca indigo->amber tinham ficado como excecao deliberada
(mantidos em amber-600) - desta vez foram tratados como destaque
mesmo, e viraram blue-600: representam a acao afirmativa "ligado" do
sistema (mesma familia visual de qualquer botao primario), nao um
significado semantico fixo como os badges acima - decisao confirmada
com o usuario antes de aplicar.

Nota historica (revisao anterior): a cor de destaque foi indigo,
depois amber, substituindo indigo em todo o frontend/src/ (~158
ocorrencias em 33 arquivos). Amber-600 era o padrao (bordas, links,
texto de destaque, badges); nos botoes solidos com texto branco
(bg-*-600 + text-white) o contraste de branco sobre amber-600 ficou
fraco (~3.2:1, abaixo do minimo de 4.5:1 do WCAG AA para texto normal)
- ajustado para amber-700 (hover amber-800) naquela epoca. Essa mesma
logica de shade (600 para bordas/links, 700/800 para botoes solidos)
foi preservada na troca para blue.

## Decisao tecnica: Caixa de Entrada e fluxo de leads
Card.stageId e opcional - um card sem stageId esta na "Caixa de
Entrada" (ainda nao pertence a nenhuma coluna do pipeline, sem dono).
Fluxo: leads brutos (futuros webhooks de redes sociais) chegam via
CreateQuickCardUseCase sem dono/sem stage. Um corretor ou SDR "assume"
o lead via ClaimCardUseCase, que atribui o ownerId e move para a
primeira stage do pipeline ("Em Atendimento"), tudo em uma acao so.
Quando o corretor cria um lead diretamente ("+ Novo Negocio"), ele ja
nasce com dono e direto em "Em Atendimento", sem passar pela Caixa de
Entrada. O modulo Roleta Online (ver secao propria mais abaixo)
automatiza essa distribuicao quando ativado - sem ele (ou com ele
inativo), a atribuicao continua manual, via clique em "Iniciar
Atendimento".

## Decisao tecnica: Gestao Imobiliaria e armazenamento de arquivos
Modulo gestao_imobiliaria criado com Empreendimento (opcional, agrupa
unidades) e Imovel (pode ser avulso ou vinculado a um Empreendimento).
Imovel tem finalidade (venda/aluguel/ambos). Card do Kanban agora pode
referenciar um Imovel real via imovelId (opcional).

Armazenamento de arquivos (fotos de imoveis) segue o mesmo padrao ja
usado para e-mail: interface IFileStorageService, trocavel. Hoje usa
LocalFileStorageService (disco local, servido como arquivos estaticos
em /uploads). Quando for para producao (VPS), avaliar trocar para
armazenamento em nuvem (S3 ou equivalente) - trocar so essa peca, sem
mexer nos use cases.

### Fatia 1 (backend basico) - CONCLUIDA
Empreendimento, Imovel, ImovelPhoto, upload de fotos e integracao com o
Card do Kanban (imovelId).

### Fatia 2 (Catalogo + Espelho de Vendas) - CONCLUIDA
Imovel ganhou campos adicionais: codigoInterno, uso (residencial/
comercial), tags (texto livre separado por virgula), disponivelApartirDe,
localChaves (imobiliaria/proprietario/outro), exclusividade,
proprietarioNome/proprietarioTelefone. Status expandido para 10 valores
(disponivel/reservado/em_negociacao/vendido/bloqueado/em_analise/
distrato/ocupado/vago/inativo), cada um com cor fixa (nao ciclica) usada
em selos, tabela e no Espelho de Vendas.

Frontend em src/features/imoveis/ (Feature-Driven Design, mesmo padrao do
Kanban): store Zustand + hook de integracao + componentes. Tela
/dashboard/imoveis alterna entre Catalogo (Cards ou Lista, com filtros de
busca/finalidade/status/empreendimento) e Espelho de Vendas (grid de
unidades por empreendimento, coloridas por status, com popover rapido
para trocar status). GET /imoveis (lista) e o PATCH /imoveis/:id ambos
incluem a 1a foto do imovel (coverPhotoUrl) para a foto de capa dos
Cards - sem isso, salvar o imovel depois de um upload zerava a capa.

Nota: Proprietario hoje e campo simples (nome+telefone) no proprio
Imovel - sera substituido por vinculo formal quando o modulo RH/
Cadastros criar a entidade Cliente Proprietario.

### Fatia 3 (Proprietarios + Contratos) - CONCLUIDA
Proprietario (dados bancarios para repasse futuro incluidos) e
InquilinoComprador ganharam entidades formais, vinculadas a um Imovel
atraves de Contrato (venda ou locacao). Imovel.proprietarioNome/
proprietarioTelefone continuam como campos simples, sem FK - o vinculo
formal so existe via Contrato.proprietarioId por enquanto.

Ao criar um Contrato, o Imovel.status muda automaticamente: "vendido"
(tipo=venda) ou "ocupado" (tipo=locacao). Ao encerrar (EncerrarContratoUseCase),
volta para "disponivel" (venda) ou "vago" (locacao) - os dois status ja
existentes desde a Fatia 2, cada um pensado para o fluxo correspondente.
CreateContratoUseCase aceita Proprietario e InquilinoComprador tanto por
ID existente quanto por dados inline (cria na hora) - o formulario do
frontend permite "selecionar ou criar" os dois.

InquilinoComprador e uma entidade enxuta por agora - sera expandida
(historico, analise de credito) quando construirmos a Fatia 5 (Moradores/
Inquilinos) formalmente.

Frontend: 2 novas abas (Proprietarios, Contratos) na mesma barra de
navegacao de /dashboard/imoveis. Testado com Playwright de ponta a
ponta (criar Proprietario, criar Contrato de locacao com Inquilino
criado inline, confirmar Imovel.status = ocupado, encerrar, confirmar
Imovel.status = vago) - dados de teste limpos ao final.

### Fatia 4 (Financeiro) - CONCLUIDA
Modelo novo `LancamentoFinanceiro` (tenantId, contratoId opcional -
nulo para lancamento avulso/manual -, tipo "receita"/"repasse",
categoria aluguel/venda/taxa_administracao/manutencao/outro, valor,
vencimento, status pendente/pago/atrasado, pagoEm, descricao). So
Administrador acessa (`FinanceiroController` usa `@Roles('Administrador')`
diretamente, mais estrito que `DASHBOARD_ROLES` usado nos demais
controllers deste modulo - dados financeiros sao sensiveis, corretor
nao ve).

`GerarCobrancasDoMesUseCase` e o coracao da fatia: para cada Contrato
`tipo=locacao` e `status=ativo` com `diaVencimento` preenchido, calcula
o vencimento-alvo (dia `diaVencimento` do mes atual, ou do proximo mes
se esse dia ja passou - com clamp para o ultimo dia do mes em meses
mais curtos, ex: dia 31 em fevereiro vira 28/29) e so cria o
`LancamentoFinanceiro` (`tipo=receita`, `categoria=aluguel`,
`valor=Contrato.valor`) se AINDA NAO existir um para esse contrato
naquele mes-alvo (`existsForContratoAndPeriodo`, checagem por
intervalo de datas) - idempotente, seguro clicar/chamar mais de uma
vez. Retorna quantos foram criados. `AtualizarStatusVencidosUseCase`
(sem scheduler automatico, fora do escopo desta fatia) roda dentro de
`ListLancamentosUseCase` toda vez que a lista e buscada (injecao direta
de um caso de uso dentro do outro, mesmo padrao ja usado em
`GenerateSignedPdfUseCase`/`SignDocumentUseCase` no E-doc), promovendo
`pendente` -> `atrasado` quando o vencimento ja passou - tambem
disponivel isoladamente se precisar no futuro.

Frontend: "Financeiro" vira a 5a opcao no toggle de `/dashboard/imoveis`
(Catalogo/Espelho/Proprietarios/Contratos/Financeiro), visivel so para
Administrador (mesmo padrao de fetch de `/auth/me` ja usado em
`/dashboard/equipe`). `FinanceiroTab.tsx` cruza `lancamento.contratoId`
com as listas `contratos`/`imoveis` ja carregadas na store (mesmo
padrao ja usado por `ContratosTab.tsx` para mostrar o titulo do
imovel) - nenhum enriquecimento no backend, `ListLancamentosUseCase`
devolve so os campos crus do `LancamentoFinanceiro`. Os 3 cards de
resumo ("Total a Receber", "Total a Pagar/Repasse", "Total Recebido no
Mes") sao calculados no frontend a partir da MESMA lista carregada na
tabela (reflete os filtros ativos, se houver) - decisao deliberada
para nao duplicar a busca. "Total a Receber"/"Total a Pagar" somam
`status != "pago"` (pendente + atrasado, nao so pendente - a leitura
mais util de "quanto ainda falta" para o Administrador); "Total
Recebido no Mes" soma `tipo=receita`, `status=pago`, `pagoEm` no mes
corrente.

BUG DE FUSO HORARIO EM CAMPOS "DATE-ONLY" (RESOLVIDO - ver secao
propria "Correcao: bug sistemico de fuso horario..." mais abaixo).
Descoberto durante o teste desta fatia (lancamento manual com
vencimento "2026-07-25" digitado aparecia como "24/07/2026" na
tabela); corrigido logo em seguida, numa tarefa dedicada, em todo o
codebase (nao so Financeiro). Os vencimentos gerados automaticamente
por `GerarCobrancasDoMesUseCase` nunca sofreram desse problema (usam
`new Date(year, month, day)`, construtor que ja interpreta em horario
local, nao uma string).

Testado de ponta a ponta com Playwright: Contrato de locacao de teste
com `diaVencimento=20`, "Gerar cobrancas do mes" cria 1 lancamento com
vencimento correto (confirmado visualmente); clicar de novo confirma
que NAO duplica (idempotencia real, nao so teorica); lancamento manual
avulso criado (tipo repasse/categoria manutencao) aparece como
"Avulso" na tabela; marcado como pago, badge muda para verde e some do
"Total a Pagar/Repasse". Tenant de teste removido ao final (cascata -
sem arquivos fisicos envolvidos nesta fatia, nao ha upload).

## Correcao: bug sistemico de fuso horario em campos "date-only" - CONCLUIDA
Corrige o bug descoberto na Fatia 4 do Financeiro (ver secao acima):
campos de data SEM horario (`<input type="date">` no frontend, string
"YYYY-MM-DD" no DTO, validados com `@IsDateString()`) que iam direto
para `new Date(dto.campo)` no controller. O JavaScript interpreta uma
string date-only como meia-noite **UTC**, nao meia-noite local - ao
formatar de volta na exibicao (`Intl.DateTimeFormat` sem `timeZone`
explicito, que usa o fuso local do processo), o resultado aparecia um
dia a menos em fusos horarios negativos (Brasil = UTC-3, ambiente real
deste projeto). Datas COM horario (ISO completo, ex: `scheduledAt` das
Atividades, que usa `<input type="datetime-local">`) NAO tem esse
problema - strings com horario e sem sufixo de fuso ja sao
interpretadas como horario LOCAL pelo proprio JavaScript, entao NAO
devem passar pela funcao de correcao abaixo (ela rejeita strings que
nao sejam exatamente "YYYY-MM-DD").

`parseDateOnly(dateString)` / `formatDateOnly(date)`
(`src/shared/utils/date-only.util.ts`): a primeira usa
`new Date(year, monthIndex, day)` (construtor que interpreta os
componentes no fuso LOCAL do processo, ao contrario de
`new Date(string)`) para o parse; a segunda usa
`getFullYear()/getMonth()/getDate()` (componentes locais) para
formatar de volta - nunca `toISOString()`, que converteria para UTC
primeiro e reintroduziria o mesmo bug invertido.

**Regra daqui pra frente**: qualquer string "date-only" vinda do
frontend (`@IsDateString()` num DTO, sem componente de horario) deve
SEMPRE passar por `parseDateOnly()` no controller antes de virar um
`Date` - nunca `new Date(dto.campo)` direto. Corrigido nos 7 pontos
onde o padrao antigo existia:
`ImovelController.create`/`update` (`disponivelApartirDe`),
`ContratoController.create` (`dataInicio`, `dataFim`),
`FinanceiroController.create`/`list` (`vencimento`, `vencimentoDe`,
`vencimentoAte`).

Efeito colateral encontrado ao corrigir `vencimentoDe`/`vencimentoAte`:
o filtro de periodo do `FinanceiroTab.tsx` enviava esses 2 parametros
via `.toISOString()` (string ISO completa, com horario) - aplicar
`parseDateOnly()` (que so aceita "YYYY-MM-DD" estrito) teria quebrado
esse filtro em runtime. Ajustado para o frontend enviar "YYYY-MM-DD"
puro tambem nesse filtro, mantendo o contrato consistente ponta a
ponta (o proprio DTO ja era `@IsDateString()`, so o valor enviado
estava "mais rico" do que precisava).

Frontend: `toDateInputValue()` em `ImovelDetailPanel.tsx` (repopula o
campo `disponivelApartirDe` ao abrir a edicao de um Imovel) trocou de
`isoDate.slice(0, 10)` (fatiamento cru da string - funcionava por
coincidencia so em fusos negativos como o Brasil) para
`formatDateOnly(new Date(isoDate))`, uma pequena copia local da funcao
do backend (frontend e backend sao projetos separados, sem
compartilhamento de codigo - mesmo padrao ja usado para as constantes
de opcoes em `features/imoveis/constants.ts`) - agora robusto
independente do fuso do servidor. As demais exibicoes de data do
frontend (`Intl.DateTimeFormat` em tabelas) ja estavam corretas e nao
precisaram de nenhuma mudanca - o bug nunca esteve ali, so na gravacao
via `new Date(string)` no backend.

Testado de ponta a ponta com Playwright: Imovel com
`disponivelApartirDe="2026-07-25"` e Contrato com
`dataInicio="2026-07-25"` criados via API, confirmado programaticamente
que o backend agora grava `2026-07-25T03:00:00.000Z` (meia-noite local
America/Sao_Paulo, nao UTC); reabertura do painel de edicao do Imovel
confirma "2026-07-25" no campo de data (nao "2026-07-24"); lancamento
manual com vencimento "2026-07-25" criado pela UI aparece como
"25/07/2026" na tabela do Financeiro; filtro de periodo confirmado
funcionando com a nova string date-only. Tenant de teste removido ao
final (cascata).

### Fatia 5 (Moradores/Inquilinos - analise de credito) - CONCLUIDA
Fecha as 5 fatias planejadas da Gestao Imobiliaria (Catalogo, Espelho
de Vendas, Proprietarios/Contratos, Financeiro, Moradores/Inquilinos).
Expande `InquilinoComprador` (profissao, rendaDeclarada,
statusAnaliseCredito default "nao_iniciada", observacoesAnalise) e
adiciona o modelo `InquilinoDocumento` (tipo rg_cpf/comprovante_renda/
comprovante_residencia/outro, url, nomeArquivo) - mesmo padrao de
armazenamento ja usado para fotos de imovel e documentos do E-doc
(`IFileStorageService`, trocavel; os metodos de documento vivem dentro
de `IInquilinoCompradorRepository`, nao um repositorio separado -
mesmo padrao ja usado para `ImovelPhoto` dentro de `IImovelRepository`).

Analise de credito e documentos sao dados sensiveis - so Administrador
(`@Roles('Administrador')` sobrescrevendo `DASHBOARD_ROLES` diretamente
nos 4 metodos novos do `InquilinoCompradorController` -
`PATCH/POST/GET/DELETE`, mesmo mecanismo de override por metodo ja
usado no `RhController`; `create`/`list`, ja existentes, continuam
`DASHBOARD_ROLES`). `DeleteInquilinoDocumentoUseCase` so remove o
registro do banco, nao o arquivo fisico do disco - mesmo comportamento
ja existente em `DeleteImovelPhotoUseCase` (nao corrigido aqui, fora
do escopo desta fatia).

Frontend: nova aba "Inquilinos" na barra de navegacao de
`/dashboard/imoveis` (visivel a qualquer `DASHBOARD_ROLES`, como
Proprietarios/Contratos - so a listagem basica + badge de status, sem
dado sensivel exposto), com badge colorido de `statusAnaliseCredito`
(nao_iniciada=slate, em_analise=amber, aprovado=verde,
reprovado=vermelho). Clique na linha abre `InquilinoDetailPanel.tsx`
(mesmo padrao do `ImovelDetailPanel.tsx`): secao "Dados Basicos" sempre
visivel; secoes "Analise de Credito" e "Documentos" só renderizadas se
`/auth/me` retornar role "Administrador" (mesmo padrao de verificacao
de role ja usado na aba "Financeiro") - um Corretor abrindo o painel
de um inquilino ve so os dados basicos, sem tentar chamar rotas que
dariam 403. Não ha tela de "criar Inquilino" dedicada (permanecem
criados via Contrato, como antes desta fatia) - a aba lista os ja
existentes.

Testado de ponta a ponta com Playwright: Inquilino criado via Contrato
de locacao (fluxo ja existente), badge inicial "Nao Iniciada"
confirmado na lista, painel de detalhe aberto, profissao+renda
preenchidos e status mudado para "Em Analise" (salvo via PATCH),
upload de um documento de teste (tipo "Comprovante de Renda")
confirmado na lista de documentos do painel, status mudado para
"Aprovado" e badge confirmado atualizado na lista apos fechar o
painel. Tenant de teste e arquivo fisico do documento removidos ao
final.

### Book do empreendimento: PDF OU imagens JPG (Fatia 1 - so backend)
`POST /empreendimentos/book/analisar` aceita 1 PDF OU de 1 a 80 imagens
JPG/JPEG (uma por pagina, numeradas 1..N na ordem do campo). Multipart:
"file" (1 arquivo, contrato antigo) OU "files" (1-80); os dois juntos,
PDF + imagem, ou 2 PDFs -> 400. Tipo pelo CONTEUDO (`domain/services/
arquivo-book.ts`: "%PDF-" / FF D8 FF), PNG e outros -> 400 "Envie um PDF ou
imagens JPG/JPEG". Limites: 80 MB no total (BookRequestSizeGuard recusa
pelo Content-Length antes do multer), 20 MB e ~50 megapixels por imagem
(lido do cabecalho JPEG ANTES de decodificar). Resposta ganhou
`origem: 'pdf' | 'imagens'`.
- Imagens sao normalizadas na analise (`IImagemBookService` /
  `CanvasImagemBookService`, @napi-rs/canvas): max 1600 px de largura sem
  ampliar, fundo branco, JPEG q80 - descarta TODO o EXIF (GPS do celular).
  A orientacao EXIF e respeitada (o decodificador Skia ja aplica a tag
  Orientation ao carregar; coberto por teste). Mesma fila de 1 processamento
  pesado por vez do render de PDF (`infra/services/fila-render.ts`).
- Storage temporario (`DiskBookTemporarioStorage`): PDF continua
  `<tenant>__<id>.pdf`; imagens viram a pasta `<tenant>__<id>/` com
  001.jpg... + `manifesto.json` (gravado por ultimo; pasta sem manifesto =
  inexistente). Tenant no caminho, UUID validado, 0o700/0o600, validade 2h,
  limpeza de vencidos (arquivos e pastas). `ler()` devolve
  `{ origem: 'pdf', pdf } | { origem: 'imagens', imagens }`.
- Ficha tecnica pela IA OLHANDO as imagens: `extrairFichaTecnicaEmpreendimento
  (texto, imagens?)` - parametro opcional, ADITIVO (sem imagens, prompt e
  mensagem identicos a antes; a VIVI nao usa). Usada quando a origem e
  imagens OU o PDF tem menos de 200 caracteres uteis no total
  (BOOK_MIN_CARACTERES_TEXTO). Paginas: ficha_tecnica, planta, area_comum,
  localizacao, fachada (sem nenhuma, as primeiras), max 10, 1000 px q70.
  PDF com texto bom continua so pelo texto. Falha da IA = aviso + ficha vazia.
- PDF com texto sem lazer OU tipologias (ou terreno/unidades/torres todos null): UMA 2a chamada so
  com imagens (ficha_tecnica, planta, area_comum; max 10, 1000 px q70) e `mesclarFicha` (texto
  prevalece; falha = fica o texto). Ainda vazio: lazer/plantas pelas LEGENDAS das paginas
  (`derivar*DasLegendas`, sem IA) + aviso "...sugeridos...". Descricao ignora texto institucional
  da construtora; institucional e material interno de vendas -> "descartar".
- Confirmar: book de imagens usa os JPEGs guardados (ja 1600 px) - nao
  renderiza nada; o resto (criar/completar, nao apagar dados, desfazer) igual.

### Book do empreendimento guardado COMPLETO (Fatia 2 - so backend)
Migration `20261015120000_empreendimento_book` (deploy: `npx prisma migrate
deploy` + `npm run db:generate` antes do build). Tabelas novas
`EmpreendimentoBook` (origem pdf|imagens, pdfUrl?, pdfNomeOriginal?
sanitizado, totalPaginas; `@@unique empreendimentoId` = UM book por
empreendimento) e `EmpreendimentoBookPagina` (numero, categoria, url,
largura, altura; `@@unique [bookId, numero]`). Cascata a partir de
Empreendimento/Tenant.
- Confirmar renderiza TODAS as paginas do PDF (1600 px q80, lotes de 8 na
  fila de render, prazo de 200s -> 503 sem gravar nada) e reaproveita as
  mesmas imagens para as fotos (EmpreendimentoPhoto continua igual, arquivos
  PROPRIOS - nao dependem do book). Medido ~0,75-1 s/pagina em 2 vCPU: 80
  paginas ~60-85 s (nginx corta em 300s). Imagens: usa os JPGs guardados.
- Ordem: renderiza -> upload (fotos, PDF `book-<id>.pdf`, paginas
  `book-<id>-p001.jpg`; nada do nome do usuario no caminho) -> UMA transacao
  (`IEmpreendimentoBookRepository.substituirBookEGravarFotos`: apaga book
  anterior + cria book/paginas + fotos). Falha: desfaz o empreendimento novo
  (como antes) e tenta apagar os arquivos desta tentativa. Sucesso: tenta
  apagar os arquivos do book anterior (so DEPOIS do commit).
- `IFileStorageService.delete?` (opcional). `LocalFileStorageService.delete`
  SO apaga arquivos do book: nome no disco exatamente
  `<uuid>-book-<uuid>.pdf` ou `<uuid>-book-<uuid>-p001.jpg` (fotos
  `book-pagina-N.jpg` e qualquer outro arquivo sao recusados com aviso),
  url `/uploads/imoveis/<nome>` sem `..`/barra invertida/subpasta, caminho
  resolvido sobre o `realpath` da pasta e conferido DENTRO dela, nunca
  link simbolico; inexistente = ignora. Falha ao apagar = so aviso no log.
- Leitura (mesmas guards da classe, Corretor le): `GET /empreendimentos/
  :id/book` (404 sem book/outro tenant) e `GET .../book/zip?paginas=1,2,5`
  (sem parametro = todas exceto "descartar"; inteiros 1..80 sem repetir,
  senao 400; 20/min; arquivos lidos pela url do banco, so `/uploads/`).
  ZIP por `StoreZipBookService` (copia do ZIP do pdf_tools - modulo nao
  importa modulo). `ListarPaginasBookPorCategoriaUseCase` exportado para a
  VIVI usar no futuro (NAO ligado).
- Revisao de seguranca do book (protecoes que NAO podem ser removidas):
  - PDFParse SEMPRE com `{ maxImageSize: 25_000_000, isEvalSupported: false,
    canvasMaxAreaInBytes: 64 MB }` (PDF de 1 MB com imagem 20.000x20.000
    levava o processo a ~6 GB; com as opcoes: ~110 ms, ~210 MB).
  - Proporcao da pagina pela area VISIVEL (CropBox recortado pela MediaBox,
    com rotacao), nao so MediaBox; e no render, pagina com altura acima de
    largura x 1,6 x 1,05 e descartada ANTES de decodificar.
  - `lerTextoPorPagina(pdf, { maxPaginas: 81 })` (pdf-parse `getText({ first })`)
    devolve `{ totalPaginas, paginas }`: PDF com 100 mil paginas e recusado
    sem extrair o texto de todas.
  - Imagem com proporcao > 8 ou < 1/8 -> 400 "A imagem nº X tem proporção
    extrema..."; normalizacao limita largura (1600) E altura (2560).
  - `LimiteConcorrenciaGuard` (src/shared/infra/http/limite-concorrencia.ts):
    max 2 analisar e 2 ZIP simultaneos POR PROCESSO -> 503 "Servidor ocupado.
    Tente em instantes.". E guard: roda antes do multer. ZIP continua em
    memoria (STORE precisa do CRC antes do cabecalho; streaming exigiria
    reescrever com data descriptor) - o limite de 2 segura a memoria.
  - Confirmar: trava exclusiva por bookId (`<tenant>__<id>.lock`, open 'wx')
    -> 409 "Este book já está sendo salvo. Aguarde.", sempre solta no finally;
    prazo conferido de novo depois do render; conexao fechada (res "close")
    aborta o render entre lotes.
  - Pasta temporaria: lstat (link simbolico ou de outro usuario -> 500
    generico); arquivos lidos com lstat + isFile (link nunca e seguido).
  - Erros do pdfjs/pdf-lib/skia: usuario ve so "Não foi possível ler o
    arquivo PDF."; detalhe so no Logger. Logs de remocao: so o codigo do erro.
  - DTO da ficha: descricao 5000, itensLazer 100 x 120, tipologias[].nome 150,
    inteiros 0..2147483647, areas 0..100.000.000 m2.
- Pendente: frontend (upload de varias imagens/reordenar, ver/baixar book).

## Regra de seguranca: nunca imprimir valores de variaveis sensiveis
Comandos como "cat", "grep" (sem -o especifico), "env", ou similares
NUNCA devem ser usados em arquivos .env ou qualquer arquivo com
segredos de forma que imprima a linha inteira (chave=valor) no
terminal/output. Para verificar se uma variavel esta preenchida, usar
tecnicas que confirmem existencia/tamanho sem revelar o conteudo (ex:
comparar exit code de grep -q, ou usar node/python para checar
comprimento da string). Se acontecer uma exposicao acidental, sinalizar
imediatamente e recomendar trocar o segredo exposto, mesmo que a
exposicao tenha sido so no terminal/sessao, nunca minimizar ou ocultar
o erro.

## Bug corrigido: resposta automatica precisa do JID completo (@lid)
Resposta automatica (VIVI e futuras automacoes) precisa usar o JID
completo (remoteJid) da mensagem recebida, nao reconstruir a partir
dos digitos - numeros @lid nao correspondem a um MSISDN valido sob
@s.whatsapp.net. WhatsAppMessage ganhou o campo remoteJid (nulo em
mensagens antigas) para guardar o JID completo (com sufixo @lid ou
@s.whatsapp.net) no recebimento. SendWhatsAppMessageUseCase e
BaileysWhatsAppProvider.sendMessage aceitam preferencialmente esse JID
completo como destino - se vier so digitos (sem "@", caso do envio
manual via formulario), cai no fallback de montar "<digitos>@s.whatsapp.net",
que so e correto para numeros reais, nao para @lid.

## Bug confirmado (ainda NAO resolvido): VIVI nao entrega mensagens
## para destinatarios reais via @lid
Confirmado com teste real: a pessoa que enviou a mensagem original
("Oi, procuro um apartamento") NAO recebeu nenhuma resposta da VIVI
no proprio celular dela. O que parecia ser confirmacao de entrega
(checkmarks ✓✓, retorno sem erro do sock.sendMessage()) e apenas o
espelho da propria conta da VIVI no WhatsApp Web - nao prova entrega
real a terceiros.

Causa provavel (nao confirmada 100%): sessao de criptografia E2E
(Signal Protocol) para o JID @lid pode nao estar sendo resolvida
corretamente - o assertSessions() do Baileys so busca novas prekeys
se NENHUMA sessao existir, sem validar se uma sessao existente e
utilizavel. Logs de debug ([VIVI-DEBUG]) foram adicionados no codigo
mas ainda nao capturados/analisados.

Proximo passo ao retomar: capturar os logs [VIVI-DEBUG
sendMessage retorno] e [VIVI-DEBUG messages.update] no terminal real
do backend (nao Claude Code) durante um novo teste, para ver se o ack
avanca alem de PENDING/SERVER_ACK ou trava ali - isso vai indicar se
o problema e a sessao E2E ou outra coisa no protocolo. Considerar
tambem testar se o problema e especifico de @lid ou se mensagens
automaticas para @s.whatsapp.net normal tambem falham (isso isolaria
se e um problema geral de resposta automatica ou especifico do
formato @lid).

## Nota operacional: nest start --watch as vezes trava sem reiniciar
Duas vezes durante o desenvolvimento, o nest start --watch compilou
com sucesso mas nao reiniciou o processo automaticamente (ficou com o
codigo antigo rodando). Solucao atual: matar o processo manualmente e
subir de novo. Se isso persistir, avaliar trocar por nodemon ou
investigar se e um problema conhecido do nest-cli no Windows.

## Bug RESOLVIDO: VIVI agora entrega mensagens para destinatarios
## reais via @lid
Confirmado com teste real e screenshots do celular do destinatario
(Graziele): apos a correcao do remoteJid completo (preservando o
sufixo @lid em vez de reconstruir com @s.whatsapp.net), a conversa
completa chegou e foi respondida corretamente pela pessoa real, prova
definitiva de entrega bem-sucedida.

## Modulo Central de Atendimento (Filas + Inbox de conversas) - CONCLUIDO
Novo modulo `src/modules/atendimento/`, Clean Architecture, para
mensagens de WhatsApp que NAO sao sobre qualificacao de compra/aluguel
de imovel (suporte, financeiro, duvidas gerais) - complementa o
Kanban de vendas (que continua so para negociacao) e a VIVI (que
agora decide, por conversa, se o assunto e venda ou atendimento).

### Referencia conceitual (estudada, nao copiada)
Antes de construir, o projeto open source `raphaelbat/wacalls-chat`
(MIT, Go) foi clonado numa pasta temporaria FORA do gestordevendas
(`C:\gestaodevendas\wacalls-chat-referencia\`, depois apagada) so para
estudar arquitetura/modelagem - Go e incompativel com nossa stack, ZERO
codigo foi portado. Principais ideias aproveitadas como CONCEITO:
fila como bucket organizacional com vinculo N:N agente<->fila (o
projeto de origem tem campos de "rotation"/round-robin no schema, mas
confirmamos por leitura de codigo que sao vestigiais - nunca
implementados em nenhuma camada, nem exposto na UI deles - por isso
nossa Fila e deliberadamente so organizacional, sem round-robin
proprio); acoes explicitas de ciclo de vida (assumir/transferir/
devolver/fechar) com trilha de auditoria por evento; e o padrao de
"conversa amarrada a uma conexao especifica" (aqui, `whatsappSessionId`
+ `remoteJid`).

### Modelagem (Prisma)
`Fila` (nome, descricao opcional, escopada por tenant) + `FilaUsuario`
(N:N agente<->fila, `@@unique([filaId, userId])`) + `Atendimento`
(paralelo ao `Card` do Kanban, mas fora do funil de vendas -
`whatsappSessionId` + `remoteJid` identificam a conversa, `filaId` e
`ownerId` opcionais - nulos ate classificar/assumir, `status`
"aguardando" -> "em_atendimento" -> "fechado") + `AtendimentoEvento`
(auditoria: criado/atribuido/transferido/devolvido/fechado/nota, com
`userId` opcional - nulo quando o evento e automatico, ex: criacao via
listener sem usuario logado envolvido).

### Seed automatico de filas padrao
Ao inves de exigir setup manual, `GetOrCreateAtendimentoUseCase` cria
automaticamente 3 filas padrao ("Suporte", "Financeiro", "Duvidas
Gerais") na primeira vez que um tenant precisa de um Atendimento e
ainda nao tem nenhuma Fila (`ensureDefaultFilas`, checagem por
`countByTenant` antes de criar - idempotente, so roda uma vez por
tenant na pratica). Os nomes ficam centralizados em
`domain/services/fila-categorias.ts` (`DEFAULT_FILA_NAMES`), a mesma
constante que mapeia a categoria da tool da VIVI para o nome exato da
fila (`CATEGORIA_TO_FILA_NOME`) - um so lugar de verdade para os 2
consumidores (o seed e o roteamento automatico da VIVI).

### Dois caminhos de entrada no modulo (mesmo listener, dupla responsabilidade)
`WhatsAppMessageReceivedListener` (existia so no modulo `vivi_sdr`,
escutando `whatsapp.message.received`) ganhou uma segunda
responsabilidade deliberada: sessao COM VIVI (`isAiEnabled=true`)
continua indo para `ProcessIncomingMessageUseCase` como antes; sessao
SEM VIVI agora cai automaticamente em `GetOrCreateAtendimentoUseCase`
(Central de Atendimento), SEM fila ainda - fica "nao classificado" ate
um Administrador classificar manualmente pela UI (reaproveitando a
propria acao de "Transferir", que ja aceita mudar so a fila sem mudar
o dono - nao existe uma rota dedicada de "classificar", o Transfer
cobre os dois casos: classificacao inicial e reclassificacao
posterior). `atendimento` nao importa `vivi_sdr` de volta - dependencia
so num sentido (`vivi_sdr` -> `atendimento`), sem ciclo, mesmo padrao
ja usado por `roleta_online` (-> `vendas_kanban`+`rh`).

O evento `whatsapp.message.received` (emitido por
`BaileysWhatsAppProvider`) ganhou o campo `remoteJid` no payload -
antes so tinha `phoneNumber` (digitos), que nao e suficiente pra
responder corretamente numeros `@lid` (ver bug do JID @lid, secoes
acima) - `GetOrCreateAtendimentoUseCase` exige o JID completo.

### VIVI orquestrando: nova tool "transferir_para_fila"
`AnthropicConversationService` ganhou uma segunda tool alem de
"transferir_para_corretor": "transferir_para_fila" (parametros
`categoria`: suporte/financeiro/duvida_geral, e `resumo`: texto curto
do que foi perguntado). O system prompt da VIVI foi ajustado para
distinguir os dois casos: pergunta sobre qualificacao de compra/aluguel
-> "transferir_para_corretor" (cria Card no Kanban, comportamento
inalterado); pergunta sem relacao com comprar/alugar um imovel (boleto,
pagamento, suporte, duvida generica) -> "transferir_para_fila" (cria/
classifica um Atendimento, NUNCA cria Card). `ProcessIncomingMessageUseCase`
(modulo `vivi_sdr`) ganhou o branch para a nova tool, chamando
`GetOrCreateAtendimentoUseCase` + `ClassifyAndRouteAtendimentoUseCase`
em sequencia - `ViviConversation.status` ganhou o valor
"encaminhado_fila" (nao mexe em `cardId`, fica nulo). Testado com uma
chamada REAL a API do Claude (Haiku, sem mock): pergunta "meu boleto do
mes passado nao chegou no email, como faco pra pagar?" foi corretamente
classificada como `categoria=financeiro` com um resumo gerado pelo
proprio modelo, sem nenhum Card criado no Kanban.

### Visibilidade por role (Corretor/Agente ve so o que e dele)
`ListAtendimentosUseCase`/`GetAtendimentoDetailUseCase`: Administrador
ve tudo (inclusive atendimentos "nao classificados", para poder
atribui-los); Corretor/Agente ve so atendimentos cuja fila ele integra
(`FilaUsuario`) OU que ele mesmo ja assumiu (`ownerId`) - um atendimento
"nao classificado" (sem fila, sem dono) fica invisivel para quem nao e
Administrador ate ser classificado (diferente da Caixa de Entrada do
Kanban, que e sempre visivel a qualquer role de proposito - aqui a
regra e deliberadamente mais restrita, ver `ListAtendimentosUseCase`).
Efeito colateral esperado e CORRETO: se um agente transfere um
atendimento para uma fila que ele mesmo nao integra e depois devolve
(perdendo o `ownerId`), ele perde a visibilidade dele - confirmado
durante o teste desta fatia (o roteiro de teste original tentava
continuar operando como esse agente depois disso; foi ajustado para
usar o Administrador a partir dali, ja que o comportamento de perda de
visibilidade e o controle de acesso funcionando como desenhado, nao um
bug).

### Reaproveitamento de infraestrutura existente
`EnviarMensagemAtendimentoUseCase` reaproveita
`SendWhatsAppMessageUseCase` (modulo `whatsappmarketing`) sem
modifica-lo - a persistencia da mensagem OUT (e o proprio envio via
Baileys) ja acontece dentro dele. `GetAtendimentoDetailUseCase`
reaproveita `IWhatsAppMessageRepository.findRecentBySessionAndNumber`
(mesmo metodo ja usado pela VIVI para montar historico) em vez de criar
um metodo novo filtrando por `remoteJid` - `Atendimento.phoneNumber` ja
e suficiente. `AddUsuarioToFilaUseCase` importa `IUserRepository` do
`AuthModule` (mesmo padrao ja usado pelo `portal_cliente`) so para
validar que o usuario vinculado pertence ao tenant certo.

`ListAtendimentosUseCase` busca a ultima mensagem de cada atendimento
visivel (preview na lista da UI) com 1 consulta extra por atendimento
(`WhatsAppMessage` nao tem FK para `Atendimento` de proposito - ver
schema.prisma) - aceitavel na escala atual (dezenas de atendimentos
abertos por tenant); se crescer muito, avaliar desnormalizar um
"ultima mensagem" direto no proprio `Atendimento` numa fatia futura.

### Frontend
Item novo "Atendimento" no Sidebar (icone `Headset`, visivel a
qualquer role do dashboard). `/dashboard/atendimento`
(`features/atendimento/`, Feature-Driven Design, mesmo padrao dos
demais modulos) - layout de 3 colunas (lista + chat + acoes) inspirado
na ESTRUTURA do wacalls-chat estudado, mas com nossa identidade visual
atual (cards brancos, bordas slate, azul como cor de destaque):
`AtendimentoList.tsx` (abas por fila + "Nao Classificados" + "Todos",
busca por numero, preview da ultima mensagem) e
`AtendimentoChatPanel.tsx` (bolhas de mensagem IN/OUT, composer, 5
botoes de acao condicionais por status/dono - Assumir/Transferir/
Devolver/Fechar/Nota - com dialogos inline simples para
Transferir/Fechar/Nota, sem modal separado). Poll simples a cada 5s
(mesmo padrao ja usado em `/dashboard/whatsapp`), sem WebSocket nesta
fatia.

`FilasManagementCard.tsx` (novo) - Administrador cria filas e vincula
agentes por checkbox multi-select, renderizado na pagina `/dashboard/equipe`
junto ao `RoletaConfigCard` ja existente (mesmo padrao de card
condicional a role).

### Teste E2E hibrido (Nest standalone + Playwright + chamada real a IA)
Testado de ponta a ponta com uma combinacao de tecnicas, ja que um
numero de WhatsApp real pareado via QR nao pode ser automatizado neste
ambiente: `NestFactory.createApplicationContext(AppModule)` (contexto
standalone do Nest, sem HTTP listener) para invocar diretamente
`GetOrCreateAtendimentoUseCase`/`ProcessIncomingMessageUseCase` -
exatamente o mesmo caminho que o listener real percorre, so disparado
manualmente em vez de via evento - combinado com sessoes WhatsApp
inseridas direto no banco (bypass do pareamento QR) e Playwright para
toda a validacao de UI real (login, classificar, assumir, transferir,
devolver, fechar, nota, trilha de auditoria completa confirmada:
criado -> transferido -> atribuido -> transferido -> devolvido ->
atribuido -> fechado). A chamada a VIVI (Fase 4) usou a API REAL da
Anthropic (Claude Haiku, sem mock nenhum) com uma pergunta de
suporte financeiro generica, confirmando que o modelo decide sozinho
por "transferir_para_fila" (nao "transferir_para_corretor") e classifica
na fila certa. `POST /atendimentos/:id/enviar-mensagem` foi testado e
retornou erro esperado (sem numero real conectado via QR neste
ambiente - mesma limitacao ja documentada em outras fatias deste
projeto que dependem de WhatsApp real) - a chamada chega corretamente
ate `SendWhatsAppMessageUseCase`, so a entrega de fato nao pode ser
verificada sem um numero pareado de verdade. Tenant de teste, sessoes
WhatsApp e demais dados removidos ao final (cascata a partir do Tenant).

## Modulo Ferramentas PDF (estilo iLovePDF) - Fatia 1 - CONCLUIDA
Backend em src/modules/pdf_tools/ (Clean Architecture, isolado - NAO importa
nada do edoc; tem o proprio adapter de LibreOffice). Frontend em
frontend/src/features/pdf_tools/ + app/dashboard/ferramentas-pdf/ (hub,
[ferramenta], leitor) + core/api/blob.ts (download de arquivo com token).

- Processamento 100% em memoria + pasta temp (mkdtemp, apagada no finally).
  Sem banco, sem migration, NADA gravado em /uploads (que e publico). LGPD:
  logs so com tenant/usuario/ferramenta/tempo/tamanho, nunca nome de arquivo,
  conteudo ou senha.
- Rotas /pdf-tools/*: capabilities, merge, split, organize, rotate, compress,
  office-to-pdf, images-to-pdf, pdf-to-images, page-numbers, watermark,
  protect, unlock, extract-text, create. JwtAuthGuard + RolesGuard
  (DASHBOARD_ROLES), throttle 30/min nos POST.
- Multipart: arquivos em "files" (merge, images-to-pdf) ou "file"; opcoes no
  campo texto "options" (JSON). Ferramentas com lote aceitam "file" (1,
  contrato antigo) OU "files" (1 a N) - os dois juntos -> 400. /create aceita JSON ou multipart (multipart
  porque o body JSON do Express e limitado a 100 KB).
- Resposta: StreamableFile + Content-Disposition + header X-Pdf-Tools-Meta
  (JSON com pages/originalSize/resultSize...). Access-Control-Expose-Headers
  e setado na propria resposta (o CORS global nao expoe headers).
- Erros JSON {statusCode, code, message}: 400 INVALID_INPUT, 411
  LENGTH_REQUIRED (sem Content-Length), 413 TOO_LARGE, 422 ENCRYPTED_PDF /
  WRONG_PASSWORD, 503 TOOL_UNAVAILABLE, 500 PROCESSING_FAILED (sem stderr).
- Limites: 50 MB por arquivo, 80 MB por requisicao (nginx /api/ aceita 85M),
  20 PDFs no merge, 50 imagens, imagem max ~30 megapixels (lido do
  cabecalho antes de decodificar), PDF->imagem ate 20 PDFs por vez (campo
  "files"; "file" continua aceito), max 100 paginas no TOTAL do lote (15 a
  300 DPI); varios PDFs -> imagens_pdf.zip com uma pasta por PDF.
- Lote nas ferramentas 1 arquivo -> 1 arquivo (application/batch-processor.ts,
  BatchProcessor comum): compress, rotate, page-numbers, watermark, protect,
  unlock, extract-text ate 20 arquivos; office-to-pdf ate 10 (LibreOffice e
  lento, nginx corta em 300s). Split/organize continuam 1 arquivo. 1 arquivo
  -> resposta identica a de antes; varios -> ZIP (comprimidos, convertidos,
  girados, numerados, marca_dagua, protegidos, desbloqueados .zip) com o
  nome individual de cada resultado, repetidos viram "x_comprimido (2).pdf".
  Meta do lote: files + somas de pages/originalSize/resultSize (conteudo,
  nao o zip); no compress alreadyOptimized = QUANTOS ja estavam otimizados
  (esses entram no zip com o original). Opcoes valem para todos (mesma
  senha/angulo); "pages" do rotate so com 1 arquivo. Valida TODOS (magic
  bytes, pagecount/criptografia) antes de processar; processa 1 por vez;
  erro em qualquer arquivo aborta o lote nomeando o arquivo ("x.pdf" esta
  protegido..., Senha incorreta para "x.pdf"). extract-text em lote devolve
  { files: [{ name, pages, byPage }] }; 1 arquivo: { pages, byPage }. SEM o
  campo "text" (o frontend junta as paginas) e com name sem caracteres de
  controle/bidi.
- Prazo total do lote: 240s (batchDeadlineMs; nginx corta /api/ em 300s),
  checado antes de cada arquivo; o restante vira o timeout de soffice/gs/
  qpdf (opcional nas interfaces, menor entre ele e o limite do binario).
  Estourou -> 422 BATCH_TIMEOUT "O lote demorou mais que o limite (4 min).
  ... ja tinham sido processados N de M." 1 arquivo nao tem esse prazo.
- Tetos anti-"bomba" (revisao de seguranca), todos TOO_LARGE (413):
  maxPagesPerFile 2000 em TODAS as ferramentas (checado no load do motor
  pdf-lib pelo /Count do catalogo, O(1), antes de percorrer as paginas; o
  parse em si nao da para evitar, mas cede o event loop a cada 100 objetos);
  batchMaxPagesTotal 5000 somado no lote (weight() no BatchProcessor, antes
  de processar o 1o) e no merge (antes de juntar); extract-text 2 milhoes de
  caracteres por arquivo e 5 milhoes no total (extracao pagina a pagina,
  para assim que passa); saida 150 MB somada no lote / 120 MB com 1 arquivo.
- Rotas com lote (incl. pdf-to-images e extract-text): alem do throttle
  global por IP, 6 req/min POR USUARIO e por ferramenta
  (PdfToolsBatchThrottlerGuard, tracker req.user.id, fallback IP). Rotas
  de 1 arquivo seguem 30/min.
- Cancelamento: o controller aborta (AbortController) quando a resposta
  fecha antes de terminar (res "close", nao req "close" - este dispara ao
  fim do upload); BatchProcessor checa antes de cada arquivo e repassa o
  signal aos binarios (process-runner mata o grupo). Erro ABORTED e
  silencioso (sem log 500); pastas temp sempre removidas no finally.
- Binarios via spawn sem shell, timeout + SIGKILL no grupo: soffice (perfil
  descartavel por execucao com macros desabilitadas e links externos nunca
  atualizados, max 2 conversoes simultaneas), gs (sempre -dSAFER), qpdf
  (senha so via @argsfile 0600 com sintaxe nomeada --user-password=, nunca
  em argv/log; owner password aleatoria). PDF->imagem via pdf-parse +
  @napi-rs/canvas, fila de 1 render por vez. ZIP gerado a mao (metodo STORE +
  CRC32), sem dependencia nova.
- Dependencia de infra: qpdf e ghostscript precisam estar instalados na VPS
  ("apt install qpdf ghostscript"); sem eles /capabilities devolve false e o
  frontend mostra o card como "Indisponivel no servidor".
- Testes: npx jest src/modules/pdf_tools (173 testes; os de integracao usam
  qpdf/gs/soffice reais e pulam sozinhos se o binario faltar). Validado E2E
  com Playwright (38 cenarios, 12 de lote) contra o backend real.

## Permissoes da area Imoveis e WhatsApp (16/10/2026)
Fecha a falha "quase toda rota de Imoveis/WhatsApp aceitava Corretor". Regras
decididas pelo dono (nao mudar sem ele). Role/cargo = req.user.role/cargo: para
token normal o JwtStrategy le do BANCO (user.role.name / user.cargoHierarquico,
o usuario ja e carregado para o tokenVersion), entao promocao/rebaixamento vale
na hora, sem relogar, e o servidor concorda com o /auth/me. Token de
impersonacao (payload.impersonadoPor) continua usando o payload, sem banco.
Regra pura em src/modules/gestao_imobiliaria/domain/services/permissao-imovel.ts
(podeAlterarStatusUnidade, verificarEdicaoCadastroImovel), aplicada DENTRO dos
use cases (application/use-cases/permissao-imovel.helper.ts -> 403), nao so no
guard. Frontend espelha em core/constants/permissoesImoveis.ts + core/hooks/useMe.ts
(so para esconder botoes).

"Gestao" = Administrador OU cargo coordenador/gerente/gerente_regional/
superintendente/diretor/diretor_regional. "Dono" = Imovel.criadoPorUserId
(coluna nova, migration 20261016120000_imovel_criado_por; NULL = antigos/lote/
book = do Administrador).

| Acao | Admin | Gestao | Corretor / sem cargo / Parceiro |
|---|---|---|---|
| Ler imoveis, empreendimentos, book, book/zip, contratos | sim | sim | sim |
| POST /imoveis | sim | sim (forca disponivel, nao publicado) | sim (idem) |
| PATCH /imoveis/:id e fotos (POST/DELETE/reorder) | tudo | so dono e nao publicado | so dono e nao publicado |
| status/publicado pelo PATCH /imoveis/:id | sim | nao (403) | nao (403) |
| PATCH /imoveis/:id/status (so {status}) | sim | sim | nao (403 "Somente gerência ou administração altera o status da unidade.") |
| Contrato criar / encerrar (muda status) | sim | sim | nao (403) |
| Empreendimento criar/publicar/despublicar, book analisar/confirmar, gerar-lote, imoveis/lote, planilha, importar-pdf, ficha, fotos, unidades/site | sim | nao | nao |
| WhatsApp sessoes (me, criar, QR, status, send, desconectar) e VIVI enable/disable | sim | nao | nao |
| Proprietarios / Inquilinos / Financeiro | sem mudanca (como antes) | | |

Padrao nos controllers ImovelController, EmpreendimentoController,
ContratoController, WhatsAppController, ViviSessionController: a CLASSE e
@Roles('Administrador') e cada rota liberada declara @Roles(...DASHBOARD_ROLES)
(RolesGuard: regra do metodo tem prioridade). Rota nova esquecida nasce
fechada. META-TESTE em infra/http/permissoes-imoveis.http.spec.ts e
whatsappmarketing/infra/http/permissoes-whatsapp.http.spec.ts percorre o
metadata e falha se uma rota fora da lista liberada nao for so Administrador
(ao liberar rota nova, atualizar LIBERADAS_AO_DASHBOARD e a tabela ROTAS).
DELETE /imoveis/:id/photos/:photoId agora tambem confere que a foto e do
imovel da URL (antes so o photoId).

Frontend: StatusPopover/seletor de status so para gestao; aba Editar do
ImovelDetailPanel so admin ou dono nao publicado (campos status/publicado so
admin); "Novo Empreendimento", publicar em massa, book, cadastro em lote,
ficha/fotos/publicar do empreendimento e Novo/Encerrar contrato escondidos
para quem nao pode; /book e /[id]/lote redirecionam nao-admin
(SomenteAdminGuard, ?aviso=somente-admin). 403 generico do RolesGuard vira
frase amigavel em core/api/client.ts.

Ajustes da revisao de seguranca (16/10/2026):
- Nao-admin cadastra so imovel AVULSO: POST /imoveis forca empreendimentoId
  null, tipoItem "unidade" e codigoInterno null; PATCH de nao-admin mudando
  empreendimentoId/tipoItem/codigoInterno -> 403 "Somente a administração
  vincula imóveis a empreendimentos." (mesmo valor = ignorado). Tela esconde
  o seletor de empreendimento e o codigo interno para nao-admin.
  PATCH /empreendimentos/:id/unidades/site (publicar todas) filtra
  criadoPorUserId: null - nunca publica imovel de corretor.
- Escrita CONDICIONAL de nao-admin (fecha a corrida checou/publicaram/gravou):
  update e as 3 operacoes de foto passam CondicaoDonoImovel ao repositorio;
  update = updateMany where {id, tenantId, publicado:false, criadoPorUserId};
  fotos = transacao que primeiro trava a linha do imovel com o mesmo
  updateMany condicional (toca updatedAt) e so entao mexe nas fotos. count 0
  -> EdicaoImovelBloqueadaError -> mesmo 403 da checagem normal.
- Upload de foto (imovel E empreendimento): multer limits 10 MB / 1 arquivo
  (acima: 413), tipo pelos bytes (JPEG FF D8 FF, PNG 89 50 4E 47, WebP
  RIFF....WEBP - domain/services/foto-upload.ts), resto -> 400 "Envie uma foto
  JPG, PNG ou WebP.", gravado como "<uuid>-foto.<ext real>" com o mimetype
  real (originalname do usuario nunca vai para o disco - /uploads e publico).
- PENDENCIA para o dono reavaliar (BAIXO-3, mantido como esta de proposito):
  PATCH /proprietarios/:id continua aberto a DASHBOARD_ROLES (qualquer
  Corretor edita dados de proprietario, incl. bancarios).

## Modulo BII - Fatia 1 (historico de etapas + Painel de Vendas) - CONCLUIDA
BII = Business Intelligence Imobiliario. Contrato completo (aprovado pelo
Villar em 19/10/2026): docs/bii/fatia1/CONTRATO_PAINEL.md. Desenho geral:
docs/bii/fase1/.

### Historico de etapas (evento `card.stage.changed`)
O vendas_kanban so EMITE o evento (contrato em
src/modules/vendas_kanban/domain/events/card-stage-changed.event.ts; o BII tem
a propria copia em src/modules/bii/domain/events/ - modulo nao importa modulo):
`{ tenantId, cardId, pipelineId, fromStageId (null = entrada no funil),
toStageId, userId (null = job/sistema), origem: move|claim|job_repique|
promocao|criacao, ocorridoEm, motivoRepique? }`. Sempre `emit` (nunca
emitAsync), DEPOIS da escrita bem-sucedida, e SO quando a stage muda de
verdade. Pontos de emissao (conferidos no codigo, nenhum outro modulo grava
Card.stageId):
- MoveCardUseCase (origem move; nao emite ao reordenar na mesma coluna;
  userId = `requesterUserId`, campo novo opcional passado pelo
  CardController - MoverCardViviUseCase do vivi-integration nao passa, fica
  null, sem mexer naquele modulo).
- ClaimCardUseCase (claim; Roleta automatica tambem passa aqui, userId = o
  corretor sorteado; nao emite se o card ja estava na primeira stage).
- MoverLeadsInativosParaRepiqueUseCase (job_repique, motivo
  SEM_RESPOSTA_90_DIAS).
- PromoverLeadMinimoUseCase (promocao; so se o card promovido cai numa
  stage - promovido para a Caixa de Entrada nao emite, o evento sai no claim).
- CreateCardUseCase (criacao, sempre nasce com stage) e CreateQuickCardUseCase
  (criacao, so quando nasce com stage - ex: Repique da VIVI, stage do funil de
  remarketing; Caixa de Entrada nao emite).
EventEmitter2 foi injetado em MoveCard/ClaimCard/CreateCard/
MoverLeadsInativos (PromoverLeadMinimo/CreateQuickCard ja tinham). Nenhum
comportamento do Kanban mudou.

`CardStageChangedListener` (bii/infra/listeners) grava `BiiCardStageEvento`
(tabela bii_card_stage_eventos, migration 20261020120000_bii_card_stage_evento,
so CREATE TABLE): confere que o card e do tenant, busca o NOME das stages por
id + tenantId e guarda uma COPIA (fromStageNome/toStageNome - sobrevive a
renomear/excluir a stage). Stage/pipeline/usuario SEM FK de proposito (excluir
stage ou usuario nao pode apagar nem bloquear historico; userId e so registro).
FK so para Tenant e Card (Cascade). try/catch que so loga ids + mensagem do
erro (sem dado pessoal); nunca derruba o Kanban.

LIMITACOES CONHECIDAS: (1) historico so existe a partir da implantacao (sem
passado; backfill "estimado" ficou para depois, se o Villar quiser); (2) o
evento e em memoria - se o processo cair entre a escrita do card e o
listener, aquele movimento se perde (janela de milissegundos; conferencia
noturna Card.stageId x ultimo evento ficou como melhoria futura).

### Painel de Vendas (GET /bii/painel)
`BiiPainelController` (`@Controller('bii')`, classe com
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('Administrador')`) ->
`GetPainelVendasUseCase` (checa `requesterRole === 'Administrador'` de novo ->
403). Impersonacao do Super Usuario permitida (so leitura). Query opcional:
`de`/`ate` (YYYY-MM-DD, `parseDateOnly` no controller; padrao = 6 meses de
calendario incluindo o atual, do dia 1 de 5 meses atras ate hoje; `ate`
inclusivo ate o fim do dia local - consultas usam `< inicio do dia seguinte`;
`de > ate` -> 400; mais de 24 meses -> 400), `pipelineId` (padrao = pipeline
mais antigo do tenant; de outro tenant -> 404), `corretorId` (Card.ownerId),
`origem` (Card.origem). Resposta exatamente no formato do contrato.

Regras: leadsNovos por Card.createdAt no periodo; ganho = card DISTINTO que
ENTROU em "Fechamento" no periodo, perda = idem "Repique" (vale a primeira
entrada no periodo; nome da etapa no momento do evento, comparado sem acento
e sem caixa); VGV = soma de Card.value dos ganhos; ticketMedio so com value >
0; ciclo = dias entre Card.createdAt e a entrada em Fechamento (negativo e
descartado); funil sem Repique, em ordem de position, conversao = proxima /
esta; comparativo = periodo anterior com a mesma quantidade de dias; ranking
por VGV desc e depois ganhos (card sem dono fica fora); motivos de perda com
os rotulos do Kanban (copiados em bii/domain/services/motivo-repique.ts),
nulo = "Nao informado". Percentuais com 1 casa, null quando nao ha base.

Calculos em funcoes PURAS (bii/domain/services: estatistica, normalizar,
periodo, ciclo-venda, funil, painel-vendas, motivo-repique). Leitura por
repositorio PROPRIO (`PrismaPainelVendasRepository`, le Card/Stage/Pipeline/
User sem importar o vendas_kanban): todo where com tenantId, so Prisma tipado
(findMany/groupBy/aggregate), ZERO SQL bruto no modulo. Decimal -> number.
Agregacao em memoria sobre os eventos do periodo (suficiente para o volume
atual; se crescer, mover para groupBy/SQL parametrizado).

### Testes
`npx jest src/modules/bii src/modules/vendas_kanban` (unitarios + meta-teste
`bii/infra/http/permissoes-bii.http.spec.ts`, que descobre os controllers
pelo proprio BiiModule e falha se alguma rota nao for so Administrador com
JwtAuthGuard+RolesGuard). Integracao (isolamento de tenant + listener + wiring
do evento, banco real; pulado sem DATABASE_URL):
`DATABASE_URL=postgresql://... npx jest src/modules/bii --runInBand`.
Falhas PRE-EXISTENTES na suite inteira (nao relacionadas ao BII):
get-board-remarketing-restricao (mock sem findUltimasByCardIds) e 3 specs do
vivi_sdr (factory vivi-config-record sem diasParaRotting).

### Deploy
`npx prisma migrate deploy` + `npm run db:generate` + `npm run build` +
`pm2 restart gestordevendas --update-env`. NUNCA `pm2 restart all`.
Nenhuma variavel de ambiente nova, nenhuma dependencia nova.

### Revisao de seguranca (independente) - pode ir para PR
Sem achado critico/alto. Aplicado na hora: GET /bii/painel com
@Throttle 20/min e `BiiPainelLimiteGuard` (LimiteConcorrenciaGuard
'bii-painel', 2 simultaneos por processo -> 503), porque o painel carrega os
eventos do periodo (e do periodo anterior) em memoria. O meta-teste aceita so
esse guard de metodo (aditivo). PENDENCIA antes de tenants grandes (dezenas de
milhares de cards): levar a agregacao para o banco (groupBy de 1a entrada por
card/etapa, somas de VGV) e devolver so agregados. Fora do escopo, ja existia:
promover-lead-minimo.use-case.ts loga o telefone do lead - corrigir numa
tarefa separada.

## Modulo BII - Fatia 2 (Analise por Endereco + ITBI) - CONCLUIDA
Contrato (autoritativo, atualizado apos a planilha real):
docs/bii/fatia2/CONTRATO_ANALISE_ENDERECO.md. Estrutura real do arquivo da
Prefeitura e diferencas entre os anos: docs/bii/fatia2/ITBI_COLUNAS.md.

### Tabelas (migration 20261021120000_bii_itbi_geocode_analise, so CREATE)
- GLOBAIS, SEM tenantId e SEM FK para tabela de tenant, de proposito: e dado
  PUBLICO, igual para todo tenant; escrita so pelo Super Usuario/job, o tenant
  so le. `ItbiTransacao` (itbi_transacoes, uma guia por linha, hashLinha
  unique, indices (lat,lng), (dataTransacao), (enderecoChave),
  (cepPrefixo,dataTransacao), (bairroNormalizado)), `GeocodeCache`
  (geocode_cache, chave unique; lat/lng nulos = "nao achou") e
  `ItbiImportacao` (itbi_importacoes, historico; o arquivo NAO e guardado).
- POR TENANT: `BiiAnalise` (bii_analises, FK Tenant Cascade, indice
  (tenantId, createdAt)); resultado = snapshot Json da resposta; transacoes e
  precoM2Mediano duplicados em coluna para a listagem. Sempre lida por
  { id, tenantId }. Coluna impersonadoPor existe mas fica nula: Super Usuario
  impersonando NAO cria analise (BII somente leitura - ver Rotas).
- Cache: chave de texto digitado = `txt:<sha256 do texto normalizado>` e guarda
  SO lat, lng, precisao e CEP (coluna geocode_cache.cep) - nem o texto nem o
  endereco formatado (esse fica so na BiiAnalise do tenant; num acerto de
  cache o formatado vira o texto digitado). ITBI usa `itbi:<enderecoChave>`
  (com endereco formatado).

### Rotas
- Tenant (`BiiAnaliseController`, @Controller('bii'), classe
  JwtAuthGuard+RolesGuard+@Roles('Administrador'), checado de novo no use
  case): POST /bii/analises/endereco (throttle 10/min por IP +
  BiiAnaliseThrottlerGuard 10/min POR USUARIO, tracker req.user.id, molde do
  PdfToolsBatchThrottlerGuard + BiiAnaliseLimiteGuard = 2 simultaneas + cota
  diaria por tenant no use case: BII_ANALISES_POR_DIA, padrao 200, contando
  BiiAnalise desde a meia-noite local pelo indice (tenantId, createdAt) ->
  429 { statusCode, code: 'BII_COTA_DIARIA', message }), GET /bii/analises,
  GET /bii/analises/:id (ParseUUID), GET /bii/itbi/cobertura (cache em memoria
  de 10 min, CoberturaItbiCache, invalidado quando importacao/geocodificacao
  termina).
- Impersonacao do Super Usuario (decisao do Villar na Fase 1): BII SOMENTE
  LEITURA. POST /bii/analises/endereco com req.user.impersonadoPor -> 403
  { statusCode, code: 'BII_SOMENTE_LEITURA', message } (checado no use case,
  antes de geocodificar). Painel, listar/abrir analises e cobertura liberados.
  Erros com `code` estavel: o frontend decide pelo code, nao pelo texto.
- Plataforma (`BiiPlataformaController`, @Controller('bii-plataforma'), classe
  @Roles(SUPER_USUARIO_ROLE_NAME), checado de novo no use case): POST
  itbi/importar (202), GET itbi/importacoes, POST itbi/geocodificar (202), GET
  itbi/geocodificacao.
- Meta-teste permissoes-bii.http.spec.ts cobre TODOS os controllers do
  BiiModule: prefixo 'bii-plataforma' -> so Super Usuario, resto -> so
  Administrador; guards de metodo aceitos so BiiPainelLimiteGuard,
  BiiAnaliseLimiteGuard, BiiAnaliseThrottlerGuard, BiiItbiImportarLimiteGuard
  e ItbiUploadTamanhoGuard (exportados). Rota nova com outro guard falha o
  teste. Teste de integracao que sobe o BiiModule sozinho precisa importar
  ThrottlerModule.forRoot (no app ele e global).

### Como importar o ITBI (Super Usuario)
Tela /super-usuario (frontend) ou POST /bii-plataforma/itbi/importar,
multipart "file" (.xlsx da Prefeitura, ate 120 MB) + campo "ano". Responde 202
com { importacaoId }; acompanhar em GET /bii-plataforma/itbi/importacoes
(linhas lidas/inseridas/duplicadas/descartadas e status de cada aba). Uma por
vez (409; "processando" sem atualizar ha 30 min = processo caiu -> marcada
erro e liberada; e no onModuleInit do ImportadorItbiService TODAS as
"processando" viram erro "Interrompida por reinício do servidor" - uma
instancia so no PM2; com cluster, trocar por trava no banco). Reimportar o mesmo arquivo e seguro: hashLinha (sha256 dos
campos normalizados) + ON CONFLICT DO NOTHING -> 0 inseridas.
- Upload: throttle 10/hora (era 2; subido em 24/10/2026 para importar os 5 anos de uma vez); ItbiUploadTamanhoGuard (Content-Length obrigatorio
  -> 411, > 120 MB -> 413, ANTES do multer); BiiItbiImportarLimiteGuard (1 upload
  por processo, 503); storage proprio do multer (itbi-upload.ts, sem
  @types/multer) gravando o UPLOAD em os.tmpdir()/gestordevendas-bii-itbi
  (0o700, arquivo 0o600, nome UUID - NUNCA em /uploads, que e publico);
  assinatura ZIP PK\x03\x04 + extensao .xlsx; ZIP inspecionado antes de abrir
  (xlsx-arquivo.ts): diretorio central (<= 1000 entradas, <= 2 GiB declarados,
  razao <= 200 em entradas > 10 MB, sem vbaProject.bin/macro, sem
  criptografia, sem ZIP64, so STORE/DEFLATE), entradas CONTIGUAS (nada
  escondido fora do diretorio central - o exceljs le os cabecalhos locais) e
  DESCOMPACTACAO REAL em streaming (createInflateRaw, sem guardar) contando os
  bytes de verdade: > 1,5 GiB no total ou > 300 MB no xl/sharedStrings.xml ->
  400 (o tamanho declarado pode mentir; ~1 s por arquivo real);
  arquivo temporario SEMPRE apagado (use case em erro de validacao, importador
  no finally; esquecidos > 6 h sao varridos no proximo upload). Nome original
  so sanitizado para o registro.
- Leitura (itbi-planilha.reader.ts, unico lugar com exceljs):
  stream.xlsx.WorkbookReader, todas as abas; formula NUNCA avaliada (so o
  result guardado); limites anti-bomba 1,5 milhao de linhas e 300 MB de dados
  lidos (aborta com erro claro).
- Temporarios do exceljs: quando a aba vem antes do sharedStrings no ZIP (caso
  do arquivo da Prefeitura), o exceljs descompacta cada aba num arquivo do
  pacote tmp em os.tmpdir() (/tmp, modo 0o600) - NAO na pasta 0o700 do upload.
  Tentado e descartado: passar a opcao tmpdir ao tmp.file (ou mudar TMPDIR)
  faz o WorkbookReader perder a ultima entrada do ZIP (xl/workbook.xml) e
  quebrar - reproduzido de forma deterministica (o realpath extra atrasa o
  callback). O que foi feito (exceljs-tmp.ts): os caminhos criados durante a
  leitura sao REGISTRADOS (AsyncLocalStorage, sem mudar opcoes nem tempo) e
  apagados pelo leitor: leitura completa -> na hora; erro/abort/consumidor
  parou -> TRUNCA na hora (libera o disco) e apaga 30 s depois (apagar na hora
  gerava ENOENT sem ouvinte num ReadStream ainda nao aberto do exceljs =
  excecao nao tratada; coberto por teste). Na saida do processo o
  tmp.setGracefulCleanup do exceljs apaga o que restar. Disco maximo = 1,5 GiB
  (limite real da inspecao).
- Regras do importador (importador-itbi.service.ts + domain/services
  itbi-colunas.ts / itbi-linha.ts / itbi-valores.ts): abas de apoio (LEGENDA,
  EXPLICACOES, Tabela de USOS/PADROES) ignoradas pelo nome; cabecalho
  reconhecido por NOME normalizado (sem acento/caixa/pontuacao) via
  ITBI_COLUNAS; nome repetido -> vale a POSICAO da ordem padrao (2022: "ACC
  (IPTU)" duplicado); aba MMM-AAAA sem cabecalho com 1a linha "cara de dado"
  (coluna 2 texto, coluna 9 numero) -> ordem padrao por posicao (2024:
  JAN/OUT); "Descricao do pardao" (FEV-2026) aceito; linhas vazias nao contam;
  linha de 27 colunas ok. Bairro que parece complemento vira NULO (valor cru
  nao guardado; endereco.ts bairroPareceComplemento): 1a palavra TORRE, TR,
  BLOCO, BL, APTO, AP, VAGA, VGS; "E " + digito; so digitos; CASA/CJ so
  sozinhos ou seguidos de numero ("CASA 02", "CJ 221") - "CASA VERDE",
  "CASA VERDE ALTA", "CJ HAB ...", "CJ RES ..." sao bairros reais (3.726 guias
  no ITBI 2022-2026) e ficam; "EDIFICIO ARTE BL 2" fica (nao comeca com BL).
  No bii_dev 60.762 linhas foram corrigidas pontualmente (UPDATE + hash_linha
  recalculado com textoParaHash; reimportacao de 2024 depois: 0 inseridas).
  Obrigatorios: logradouro, valor (> 0) e data; sem
  eles a linha e descartada (contada; o log mostra so a quantidade por
  motivo). CEP e SQL vem como numero: padStart 8 e 11. Numero 99999/0 -> null.
  Natureza e financiamento "1.Compra e venda" -> codigo + descricao. Data:
  Date do exceljs, serial do Excel ou dd/mm/aaaa, sempre meia-noite UTC
  (coluna @db.Date - domain/services/data-utc.ts).
- LGPD/minimizacao: SO colunas do mapa entram. NAO importar (nao acrescentar
  sem o Villar): Matricula do Imovel, Cartorio de Registro, Testada, Base de
  Calculo adotada, Valor Venal de Referencia (proporcional) - e qualquer coluna
  desconhecida (ex. nome de comprador).
- Insercao: UM $executeRaw com template tag (parametrizado) por lote de 1000:
  INSERT ... SELECT FROM unnest(arrays por coluna) ON CONFLICT (hash_linha) DO
  NOTHING (prisma-itbi.repository.ts). Excecao DELIBERADA a "so Prisma
  tipado": com createMany o arquivo de 2026 levava 125 s e 1,6 GB de pico;
  com unnest, 23-47 s por arquivo. $queryRawUnsafe/Prisma.raw continuam
  proibidos.
- Medido no bii_dev (2 vCPU de dev) com os 5 arquivos reais (20/10/2026):
  2022 163.903 lidas / 162.671 inseridas / 1.231 duplicadas / 1 descartada /
  30 s; 2023 175.459 / 174.168 / 1.289 / 2 / 33 s; 2024 217.746 / 216.361 /
  1.348 / 37 / 47 s; 2025 230.525 / 228.970 / 1.548 / 7 / 47 s; 2026 155.906 /
  155.296 / 607 / 3 / 31 s. Reimportar um arquivo ja carregado: 0 inseridas,
  ~23-37 s. Total 937.466 linhas; tabela 405 MB + indices 233 MB = 638 MB
  (pg_total_relation_size, carga limpa). Pico de RSS ~760 MB com o heap padrao, mas
  e GC preguicoso: com --max-old-space-size=384 o mesmo arquivo (2025) roda
  com heap de 186 MB e RSS de 419 MB. Rodar `ANALYZE itbi_transacoes;` depois
  de uma carga grande.

### Geocodificacao (Nominatim/OpenStreetMap)
- IGeocodingProvider (dominio) -> NominatimGeocodingProvider (infra): host
  fixo (NOMINATIM_URL opcional, so https; http so localhost), endereco so como
  parametro codificado, format=jsonv2&limit=1&countrycodes=br&addressdetails=0
  &viewbox=cidade de SP&bounded=0, User-Agent "gestordevendas-bii/1.0
  (contato: BII_CONTATO_EMAIL)", redirect nao seguido, timeout 10 s,
  resposta <= 2 MB, FILA GLOBAL de 1 req/s por processo (fila-taxa.ts,
  compartilhada pela analise e pelo job). Precisao pelo tipo devolvido
  (rooftop/rua/cep/bairro); resultado de cidade/estado = nao achou. Falha de
  rede/429/5xx = GeocodingIndisponivelError (analise -> 503; nao vai para o
  cache).
- GeocodingComCacheProvider decora: GeocodeCache primeiro, grava inclusive
  "nao achou" (vale 30 dias). Resultado fora do retangulo da Grande SP = nao
  encontrado (analise -> 422).
- Geocodificar por regiao (Super Usuario): POST
  /bii-plataforma/itbi/geocodificar { ceps: ["03277","03278"], bairros?:
  ["Vila Ema"], max?: 2000 (<= 5000) }. Pega enderecoChave UNICOS sem ponto
  daquele prefixo de CEP (5 digitos) e/ou bairro normalizado, geocodifica em
  segundo plano a 1 req/s (2000 enderecos ~ 35 min; cache nao conta) e grava
  lat/lng em TODAS as guias da chave. Sem numero (99999/0) -> precisao no
  maximo "rua". 5 falhas seguidas do provedor encerram o job com erro. Teto
  DIARIO de consultas reais ao Nominatim do job: BII_GEOCODIFICACAO_POR_DIA
  (padrao 10.000; contador em memoria por dia local, por processo; acerto de
  cache nao conta; a analise de endereco nao entra) -> status "pausado" com a
  mensagem "Pausado: limite diário de N consultas...". Um job
  por vez (409); progresso em memoria (GET .../geocodificacao, some ao
  reiniciar). Desligamento do Nest (onModuleDestroy) cancela o job e a
  importacao sem travar (timers unref, espera maxima 3-5 s).

### Analise (AnalisarEnderecoUseCase)
Geocodifica -> periodo de N meses terminando no ULTIMO DIA COM DADO do ITBI (ou
hoje) -> bounding box (dominio puro, geo.ts) -> ITBI do bbox no SQL (limite
defensivo 20 mil linhas, natureza 1 por padrao) -> haversine corta o raio ->
estatistica pura (analise-endereco.ts): planta (uso 0 + area 0) separada, R$/m2
so usos residenciais do tipo com area > 0 e faixa 500..60.000, mediana/p25/p75
(percentil com interpolacao linear em estatistica.ts), porMes com todos os
meses, amostra 200 mais proximas, financiamento (2 MCMV, 1 SFH, outro codigo =
outros, vazio = sem). semLocalizacao = ITBI do periodo com o mesmo prefixo de
CEP sem ponto (so se o Nominatim devolveu CEP no display_name; senao 0). Log
de auditoria com tenantId/usuario/impersonadoPor/raio/meses, NUNCA o endereco.
Area construida do IPTU inclui areas comuns: o R$/m2 fica abaixo do de area
privativa (fonte.observacao fixa na resposta).

### Variaveis novas (opcionais, ver .env.example)
NOMINATIM_URL, BII_CONTATO_EMAIL (recomendado preencher - politica do
Nominatim), BII_ANALISES_POR_DIA (padrao 200), BII_GEOCODIFICACAO_POR_DIA
(padrao 10.000). Nenhuma dependencia nova. DTOs do BII com mensagens de
validacao em portugues (o "property X should not exist" do whitelist continua
o padrao global do ValidationPipe).

### Testes
`DATABASE_URL=postgresql://... npx jest src/modules/bii --runInBand` (365
testes; os de integracao - importador com planilhas SINTETICAS geradas com
exceljs, repositorios, job de geocodificacao com geocodificador fake e
isolamento de tenant - pulam sem DATABASE_URL). Nominatim sempre com fetch
mockado (nunca rede). Helper de teste (zip minimo, planilha sintetica,
cabecalho real) em test/bii/xlsx-teste.helper.ts (fora do build).
Para mudar o layout da planilha: ajustar SO ITBI_COLUNAS / ORDEM_PADRAO em
src/modules/bii/domain/services/itbi-colunas.ts (+ o teste itbi-colunas.spec).

### Deploy
Backend: `npx prisma migrate deploy` + `npm run db:generate` + `npm run build`
+ `pm2 restart gestordevendas --update-env`. Frontend: `rm -rf .next` antes do
`npm run build` (deps leaflet/react-leaflet ja aprovadas). NUNCA
`pm2 restart all`. Depois do deploy: importar os 5 arquivos (um por vez) pela
tela do Super Usuario, `ANALYZE itbi_transacoes;`, e geocodificar a regiao
de interesse por prefixo de CEP (ex.: Vila Ema/Vila Prudente/Sao Lucas).

## Modulo BII - Fatia 3 (Concorrentes) - CONCLUIDA (sem deploy)
Contrato: docs/bii/fatia3/CONTRATO_CONCORRENTES.md. Cadastro MANUAL de
empreendimentos concorrentes (coleta automatica via Apify/portais so depois de
revisao juridica - SEGURANCA_TESTES A10).

### Tabelas (migration 20261022120000_bii_concorrentes, so CREATE)
- `BiiConcorrente` (bii_concorrentes, POR TENANT, FK Tenant Cascade): nome,
  construtora?, endereco (digitado), enderecoFormatado?, lat/lng, precisao
  (rooftop|rua|cep|bairro|manual), fase (lancamento|obras|pronto),
  dataLancamento? (@db.Date, meia-noite UTC como o resto do BII - data-utc.ts),
  totalUnidades?, unidadesVendidas?, fonte?, fonteUrl? (so https, SO exibida -
  o servidor nunca busca), observacoes?, origem 'manual', createdById/
  updatedById SEM FK. Indices (tenantId, lat, lng) e (tenantId, updatedAt).
- `BiiConcorrenteTipologia` (bii_concorrente_tipologias, FK concorrente
  Cascade, SEM tenantId proprio - sempre acessada ATRAVES do concorrente, como
  SignatureRecipient do E-doc): ordem, descricao, dormitorios?, areaPrivativa,
  precoDe, precoAte?. R$/m2 nunca guardado (calculado).

### Regras (dominio puro: domain/services/concorrente.ts)
1 a 10 tipologias; area 10-1.000 m2; preco R$ 10 mil-100 mi; precoAte >=
precoDe; vendidas <= total. R$/m2 da tipologia = preco / area privativa, so
entre R$ 500 e 60.000 (mesma faixa do ITBI). R$/m2 do concorrente = mediana dos
"a partir de". % vendido; vendas/mes = vendidas / meses desde o lancamento
(minimo 1; lancamento futuro = null). `desatualizado` = updatedAt > 90 dias
(selo amber "mais de 3 meses"). Limite 300 por tenant (409).

### Rotas (BiiConcorrenteController, @Controller('bii'), classe Administrador)
GET /bii/concorrentes, GET /bii/concorrentes/:id, POST, PATCH (tipologias
SUBSTITUIDAS numa transacao, updateMany condicional where {tenantId, id}),
DELETE (204). Escrita: throttle 30/min por IP + BiiConcorrenteThrottlerGuard
30/min por USUARIO SOMANDO POST/PATCH/DELETE (generateKey sem o handler) +
BiiConcorrenteLimiteGuard (2 simultaneas no POST/PATCH, 503) + cota DIARIA de
geocodificacoes por tenant (BII_CONCORRENTE_GEOCODIFICACOES_POR_DIA, padrao
100, contador em memoria no ConcorrenteGeocodificador -> 429
{ code: 'BII_COTA_DIARIA' }; pino manual nao gasta cota). Impersonacao do Super Usuario: GET liberado; POST/PATCH/
DELETE -> 403 { code: 'BII_SOMENTE_LEITURA' } (bloquearImpersonacao em
permissoes-bii.ts, agora compartilhado com a analise). Geocodifica na criacao
e so quando o endereco muda (mesmo provedor/cache da Fatia 2; 422 nao achou,
503 provedor fora); latitude+longitude no corpo = pino ajustado a mao
(precisao "manual", sem geocodificar, conferido na Grande SP).

### Integracao com a Analise por Endereco
AnalisarEnderecoUseCase busca concorrentes do PROPRIO tenant no bbox (limite
500), corta pelo raio (haversine) e devolve `concorrentes: { itens (ate 50,
mais proximos primeiro, com distanciaMetros, SEM observacoes/fonte/fonteUrl -
paraSnapshot, LGPD), resumo { quantidade, precoM2Mediano, unidadesTotais } }`
- tambem no snapshot salvo (foto do dia: editar o concorrente depois nao muda
a analise salva). Popup do mapa tem "Ver concorrente"
(/dashboard/bii/concorrentes?id=...). Analise salva antes da
Fatia 3 nao tem o campo (tela trata). Comparacao com o ITBI SO lado a lado,
sem "diferenca %" (bases diferentes: valor pago x area do IPTU vs preco de
tabela x area privativa).

### Frontend
Aba "Concorrentes" (/dashboard/bii/concorrentes) deixou de ser "em breve":
tabela + painel lateral (ConcorrenteForm) com tipologias (R$/m2 na hora),
vendas, fonte e - depois de salvo - mapa com "Ajustar posicao no mapa"
(clique ou arraste). Aviso fixo para nao registrar dado pessoal de corretor.
Analise por Endereco: marcador violeta de concorrente (icones-mapa.ts, acima do
pino do endereco para continuar clicavel) e card "Concorrentes no raio". Selo
de fonte novo "Manual" (violeta) no SourceBadge.

### Testes
`DATABASE_URL=postgresql://... npx jest src/modules/bii --runInBand` (repo
fake de concorrentes em test/bii/concorrente-repo.fake.ts; integracao em
prisma-concorrente.repository.integration.spec.ts). E2E Playwright (local,
geocodificacao pelo GeocodeCache semeado, sem rede): cadastro pela tela,
erro inline, pino ajustado (PATCH manual), analise com o concorrente no mapa e
na tabela, isolamento entre 2 tenants via API, exclusao, 360 px sem rolagem.

### Deploy
NAO fazer enquanto a VPS nao for reconstruida (incidente de 21/10/2026).
Depois: `npx prisma migrate deploy` + `npm run db:generate` + build +
`pm2 restart gestordevendas --update-env`; frontend `rm -rf .next` + build +
`pm2 restart gestordevendas-frontend --update-env`. Nenhuma dependencia nova;
variavel nova opcional BII_CONCORRENTE_GEOCODIFICACOES_POR_DIA.

### Revisao de seguranca (independente) - pode ir para PR
Sem achado critico/alto. Corrigido na hora: (M1) fila do Nominatim podia ser
lotada por PATCH com enderecos novos -> throttle somado por usuario, limite de
2 simultaneas e cota diaria; (B2) pino manual + endereco novo guardava o
formatado antigo -> null; (B4) snapshot da analise sem textos livres; (B5) link
"Ver concorrente" no popup; (B6) limpeza de texto remove tambem U+061C,
U+2060-2064 e U+FEFF. Aceito: limite de 300 pode passar por rajada (no maximo
~2 com o limite de simultaneidade).

## Modulo BII - Fatia 4 (Viabilidade HIS/HMP/MCMV) - CONCLUIDA (sem deploy)
Contrato: docs/bii/fatia4/CONTRATO_VIABILIDADE.md. Para cada tipologia
(preco + area privativa): categoria municipal (HIS-1/HIS-2/HMP/mercado) com teto
e folga, faixa do MCMV, renda necessaria estimada (Tabela Price), parcela,
situacao (ok/atencao/fora) e avisos. So CALCULO: sem banco, sem migration, sem
servico externo, sem dependencia/variavel nova.

### Parametros oficiais VERSIONADOS NO CODIGO
`domain/services/parametros-habitacionais.ts` (VERSOES_MUNICIPAIS / VERSOES_MCMV,
cada uma com vigenteDesde + fonte; versaoVigente escolhe pela data). Mudou a
regra oficial -> ACRESCENTAR uma versao nova (historico no git), nunca editar a
antiga. Hoje: Decreto 64.895/2026 da Prefeitura de SP (HIS-1 renda 4.863 /
teto 276.102,20; HIS-2 9.726 / 383.636,74; HMP 16.210 / 537.672,71; SM
1.621) e MCMV desde 22/04/2026 (F1 ate 3.200, F2 ate 5.000 teto 275 mil na
capital, F3 ate 9.600 teto 400 mil, F4 ate 13.000 teto 600 mil; juros de
referencia = maior taxa da faixa, nao cotista: 5,25 / 7 / 8,16 / 10,5; SBPE 12).
Correcao pelo INCC e subsidio do MCMV: fora do escopo (avisado na tela).

### Regras (domain/services/viabilidade.ts, puras)
Teto e renda com fronteira INCLUSIVA. Renda necessaria = renda MINIMA do
comprador: percorre em ordem crescente as faixas MCMV cujo TETO cobre o preco;
em cada uma, renda pela parcela Price (juros anual efetivo -> mensal
equivalente; juros da faixa ou taxa fixa) / comprometimento, elevada ao PISO da
faixa (rendaPeloPiso); a primeira em que cabe (<= rendaMax) e a faixa. Nenhuma
-> fora do MCMV (SBPE 12% ou taxa fixa). NAO voltar ao criterio antigo "faixa
em que a renda cai" (revisao: R$ 400-417 mil saiam "nao enquadra" na F3 quando
enquadram na F4). Situacao: ok = enquadra no MCMV E e HIS/HMP com renda <=
renda max da categoria; fora = acima de HMP e fora do MCMV; resto = atencao
(inclusive acima de HMP na Faixa 4 - decisao: perde incentivo municipal).

### Rotas (BiiViabilidadeController, @Controller('bii'), classe Administrador)
GET /bii/viabilidade/parametros; POST /bii/viabilidade (200, 30/min por IP;
1-20 tipologias; premissas entrada 0-90%, prazo 60-420 meses, comprometimento
10-50%, jurosAnual 0-30 opcional). Impersonacao do Super Usuario LIBERADA (so
calculo, sem gravar e sem custo).

### Frontend
Aba "Viabilidade" (/dashboard/bii/viabilidade): tipologias (ate 20; botao
"Trazer de um concorrente" copia as tipologias de um concorrente cadastrado),
premissas, tabela de enquadramento, avisos (amber) e quadro "Parametros
vigentes" com as fontes. Selo novo "Tabela oficial" no SourceBadge.

### Testes
Fronteiras exatas, piso de faixa, Price conferida com calculo independente,
Faixa 4 acima do teto HMP, meta-teste do controller, E2E da tela (incluindo
trazer de concorrente e 360 px).

### Revisao independente
Achado ALTO corrigido (criterio de faixa do MCMV, acima). Corrigido tambem:
tela mostra "preco cabe a partir da Faixa X" e "piso da faixa"; premissas so
como objeto (@IsObject); renda arredondada antes de comparar com fronteiras.

## Modulo BII - Fatia 5 (Estudo de terreno) - CONCLUIDA (sem deploy)
Contrato: docs/bii/fatia5/CONTRATO_ESTUDO.md. Relatorio unico, salvo e
imprimivel, que junta Analise por Endereco (ITBI + concorrentes no raio) +
Viabilidade HIS/HMP/MCMV das tipologias + posicionamento de preco + conclusao
do Administrador.

- Tabela `BiiEstudo` (bii_estudos, migration 20261023120000_bii_estudos, so
  CREATE): POR TENANT (FK Tenant Cascade); `analiseId` FK BiiAnalise SetNull -
  o estudo guarda a PROPRIA copia (snapshot Json em `resultado`, versao 1),
  ~50-150 KB cada; limite 500 por tenant (409). Sempre lido/escrito por
  { id, tenantId } (updateMany/deleteMany condicionais).
- O estudo NUNCA geocodifica nem le ITBI: parte de uma BiiAnalise do proprio
  tenant (de outro tenant = 404 "Analise nao encontrada.", igual a inexistente).
  `calcularViabilidade` (viabilidade.use-cases.ts) e a mesma conta da Fatia 4.
- Dominio puro em domain/services/estudo.ts: posicionamento contra a mediana de
  R$/m2 dos concorrentes (mesma base) - diferenca arredondada a 1 casa e entao
  abaixo (< -5) / alinhado / acima (> +5); ITBI SO lado a lado (nunca %);
  resumo executivo, alertas (AMOSTRA_PEQUENA < 30, SEM_CONCORRENTES,
  ANALISE_SEM_CONCORRENTES, ANALISE_ANTIGA > 90 dias) e destaques (so fatos).
- Rotas (BiiEstudoController, classe Administrador): GET /bii/estudos (100),
  GET /bii/estudos/:id, POST, PATCH (so nome/conclusao; snapshot nao e
  recalculado; nome null -> 400), DELETE (204). Escrita: 30/min por IP +
  BiiEstudoThrottlerGuard 30/min POR USUARIO somando POST/PATCH/DELETE.
  Impersonacao: GET liberado, escrita -> 403 BII_SOMENTE_LEITURA. Log sem
  endereco, nome ou conclusao.
- Frontend: aba "Estudos" (/dashboard/bii/estudos, assistente de 3 passos;
  ?novo=1&analise=<id> abre ja com a analise - botao "Criar estudo de terreno
  com esta analise" na Analise por Endereco), relatorio em
  /dashboard/bii/estudos/[id] (editar nome/conclusao, excluir com confirmacao
  na tela) e versao para impressao FORA do dashboard em
  /impressao/bii/estudos/[id] (A4, window.print -> "Salvar como PDF"; sem
  menu, que cortaria a pagina). Conclusao sempre texto puro. SourceBadge/
  ChartCard/KpiCard aceitam fonte={null} (sem selo); ausente continua "CRM".
- Testes: estudo.spec, estudos.use-cases.spec, integracao
  prisma-estudo.repository (isolamento, SetNull, cascata), meta-teste de
  permissoes com o controller novo; E2E Playwright (24 verificacoes, PDF A4
  gerado, isolamento A/B, 360 px).
- Revisao independente: sem critico/alto/medio; corrigidos B1 (nome null dava
  500), B2 (throttle por usuario), B3 (colunas prevalecem sobre o Json) e
  snapshot com campos numericos ausentes -> null.
- Deploy: junto com as Fatias 1-4 (migrate deploy + db:generate + build).
  Nenhuma dependencia nova, nenhuma variavel nova.
