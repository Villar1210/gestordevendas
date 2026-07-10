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
