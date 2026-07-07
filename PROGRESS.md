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

## Decisoes tecnicas importantes (ver CLAUDE.md para detalhes completos)
- NestJS v11 + Prisma v7 (nao suporta MongoDB - usar driver nativo no futuro)
- WhatsApp: dois caminhos propositalmente separados - QR/Baileys (corretor,
  agora) vs API Oficial Meta (futuro "Roleta Online" - agente de
  atendimento multiatendimento/multicanal, ainda nao iniciado)
- Codigo 515 do Baileys e excecao normal (restart pos-pareamento), nao
  e queda de conexao real

## Proximos passos (em ordem sugerida)
1. Modulo de Vendas/Kanban (Stages, Cards, posicao flutuante, webhook de leads)
2. Frontend em Next.js 15 (login, depois Kanban)
3. Modulos de Atendimento, Marketing, Qualificacao, Pagamentos
4. "Roleta Online" - API oficial Meta, multiatendimento/multicanal
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
- RH/Cadastros e Perfis: planejado (ver CLAUDE.md)
- Atendimento, Marketing, Roleta Online, Pagamentos: nao iniciados

### Fase B - Frontend completo
Login e Kanban (com formulario/filtros) prontos. Demais modulos
seguem conforme forem construidos no backend.

### Fase C - Hardening (blindagem antes de producao)
- Rate limiting no login (bloquear tentativas em excesso)
- Suite de testes automatizados
- Logs estruturados + monitoramento
- Revisao geral de seguranca

### Fase D - Preparacao para VPS + dominio proprio
- Configuracao do servidor VPS
- Docker Compose de producao
- HTTPS + dominio proprio (Nginx ou Caddy)
- CI/CD (GitHub Actions)
- Backup automatico do banco de dados

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
  modulo Roleta Online.

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
