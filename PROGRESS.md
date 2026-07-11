# Progresso do Ecossistema gestordevendas

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

### Modulo VIVI (Assistente SDR de IA) - CONFIRMADA
Conversa/qualificacao CONFIRMADA funcionando de ponta a ponta com
teste real e prova visual de entrega. Pronta para uso, dentro do
escopo desta primeira fatia (follow-up automatico continua no
backlog). Ver CLAUDE.md "Bug RESOLVIDO: VIVI agora entrega mensagens
para destinatarios reais via @lid".

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
  completo (badges de temperatura, WhatsApp, busca)
- Gestao Imobiliaria: Fatias 1-5 CONCLUIDAS - COMPLETO (Catalogo/
  Espelho de Vendas, Proprietarios/Contratos, Financeiro com geracao
  automatica de cobranca de aluguel, Moradores/Inquilinos com analise
  de credito e documentos - Financeiro e a analise de credito/
  documentos dos inquilinos so Administrador acessa)
- RH/Cadastros e Perfis: CONCLUIDO (fatia minima + cadastro publico
  multi-perfil + aprovacao + hierarquia - ver CLAUDE.md). E-mails reais
  via ResendEmailSender.
- Roleta Online (distribuicao automatica de leads entre corretores): CONCLUIDA
- E-doc (assinatura eletronica): Fatias 1, 2 e 3 CONCLUIDAS (envelope
  + assinatura sequencial + editor de posicionamento de campos + PDF
  final carimbado para download + papeis de participante
  Destinatario/Remetente/Testemunha com rubrica multi-pagina)
- Portal do Cliente (/minha-conta): CONCLUIDO (Meus Imoveis, Meu
  Atendimento, Assinaturas Pendentes, Meus Documentos - vinculo por
  e-mail, ver limitacao conhecida em CLAUDE.md)
- Atendimento, Marketing, Agente de Atendimento Online (Meta), Pagamentos: nao iniciados

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
