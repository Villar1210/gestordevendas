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

### PENDENCIA CRITICA antes de usar o modulo RH de verdade em producao
RhModule esta ligado ao ConsoleEmailSender, NAO ao ResendEmailSender -
ou seja, TODOS os e-mails do modulo RH (boas-vindas do corretor
cadastrado pelo Administrador, e tambem aprovacao/rejeicao do cadastro
publico) hoje so imprimem no log do servidor (console.log), ninguem
recebe e-mail de verdade. Isso foi deliberado enquanto o modulo estava
em teste (evitar disparar e-mails reais a cada conta de teste criada),
mas e uma PENDENCIA BLOQUEANTE para uso real: um cadastro publico
aprovado de verdade nunca fica sabendo que foi aprovado (ou rejeitado),
e um corretor criado pelo Administrador fica sem saber a senha e sem
conseguir logar - ninguem mais tem acesso a ela (nao ha tela de
"reenviar senha" para corretor, so "esqueci minha senha" via auth, que
exige o usuario ja estar logado uma vez ou ter acesso ao proprio
e-mail cadastrado funcionando). ANTES de usar o modulo RH de verdade:
trocar o provider em src/modules/rh/rh.module.ts de
`ConsoleEmailSender` para `ResendEmailSender` (mesmo padrao ja usado
no AuthModule - so trocar a classe no
`{ provide: 'IEmailSender', useClass: ... }`).

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
PENDENCIA CRITICA acima). ListPossiveisSuperioresUseCase lista
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
graficos, acoes principais) - nao cor por toda a tela. Revisar a paleta
atual (indigo/slate) numa passada dedicada de identidade visual quando
houver mais telas prontas para avaliar em conjunto.

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
