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

PENDENCIA CRITICA (vale para o modulo RH inteiro, nao so esta fatia):
TODOS os e-mails do modulo RH (boas-vindas de corretor, aprovacao/
rejeicao de cadastro publico) estao ligados ao ConsoleEmailSender (so
loga no console), nao ao ResendEmailSender - ninguem recebe e-mail de
verdade ainda. Ver detalhes e o que trocar em CLAUDE.md, secao
"PENDENCIA CRITICA antes de usar o modulo RH de verdade em producao".

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
- RH/Cadastros e Perfis: CONCLUIDO (fatia minima + cadastro publico
  multi-perfil + aprovacao + hierarquia - ver CLAUDE.md). Pendencia
  critica: e-mails do modulo ainda nao sao reais (ConsoleEmailSender)
- Roleta Online (distribuicao automatica de leads entre corretores): CONCLUIDA
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
