# Backlog de Funcionalidades - gestordevendas

Lista de funcionalidades identificadas como referencia (projeto antigo
do proprio Daniel, C:\laragon\www\ivillar\crm) e ainda nao implementadas
no gestordevendas.

NOTA (atualizada): a maioria dos itens abaixo sera implementada do
zero quando priorizada, sem copiar codigo do projeto antigo - EXCECAO
registrada: o modulo E-doc (assinatura eletronica, ver CLAUDE.md e
PROGRESS.md) portou logica de fato recuperada via git history daquele
projeto (o backend de assinaturas de la foi apagado por acidente num
commit nao relacionado). E o unico caso ate agora de reaproveitamento
de codigo, nao so de conceito - registrar aqui se isso se repetir.

## Modulo Kanban/Vendas
- [ ] Score do lead (barra de progresso 0-100)
- [ ] SLA por etapa com alerta visual (dias sem contato)
- [x] Multiplos pipelines com seletor no cabecalho - CONCLUIDO: seletor
      no header de /dashboard/kanban (so aparece com mais de 1 pipeline)
      + "+ Novo Funil" - ver CLAUDE.md.
- [x] Reordenar colunas por arraste - CONCLUIDO (ja estava implementado
      ponta a ponta, backend e frontend, quando investigado - so
      confirmado durante a fatia de melhorias do Kanban).
- [x] Editar/excluir etapa direto no cabecalho da coluna (hover) -
      CONCLUIDO: lapis/lixeira no hover, ocultos nas colunas protegidas
      "Fechamento"/"Repique" - ver CLAUDE.md.
- [ ] Modal obrigatorio de "motivo da perda" ao mover card para
      estagio de perda/desqualificacao
- [ ] "Modo de agrupamento" de colunas
- [ ] Templates de mensagem WhatsApp pre-escritos por fase do funil
- [ ] Upload de documentos no card (aba "Documentos" do
      CardDetailPanel hoje e so um placeholder visual)
- [ ] Aba "Anotacoes" evoluir de texto livre para campos estruturados
      de perfil de interesse (motivo da compra, tipo de imovel,
      caracteristicas desejadas, localizacao preferida)
- [ ] Aba "Documentos" (upload real): documentos pessoais do cliente
      (RG, CPF, comprovante de renda) para envio ao correspondente
      bancario na analise de credito
- [ ] Aba "Atividades" incluir mensagens agendadas (e-mail, WhatsApp),
      nao so compromissos presenciais/ligacao

## Dashboard do Corretor
- [ ] Tela inicial dedicada ao Corretor, diferente da visao do
      Administrador - hoje NAO existe nenhuma tela de "home"/overview no
      dashboard: `/` redireciona direto para `/dashboard/kanban` pra
      qualquer role autenticado (ver commit "feat: redireciona / para
      /dashboard/kanban ou /login conforme sessao"), entao o Corretor cai
      direto no Kanban ja filtrado por RBAC (escopo 'proprio', ver
      cargo-escopo.ts), sem nenhuma visao agregada separada. Escopo
      pedido: visao dos proprios leads/pipeline (resumo, nao so o board
      cru), atividades do dia (reaproveitar Activity ja existente no
      Kanban, ver `create-activity.use-case.ts`), e leads atribuidos pela
      VIVI/Roleta (destaque visual pros que chegaram por automacao,
      distinto dos criados manualmente - ja existe `Card.origem` pra
      diferenciar). Definir com o usuario se vira uma rota nova
      (`/dashboard/inicio` ou similar) ou uma visao dentro do proprio
      Kanban antes de planejar fatias.

## Futuro modulo de Atendimento
- [x] Timeline de atividades por lead - CONCLUIDO (versao simplificada):
      implementado dentro do proprio card do Kanban (CardDetailPanel),
      com aba de Atividades (agendar ligacao/reuniao/visita/tarefa/
      proposta, marcar como concluida) e aba de Anotacoes (notas de
      texto livre). Nao inclui "roteiro" de perguntas guiado nem
      lembretes/notificacoes automaticas - ficam para uma iteracao
      futura se fizerem falta na pratica.
- [ ] Painel de estatisticas/KPIs (conversao %, fechados, distribuicao
      por etapa)

## Modulo Gestao Imobiliaria
- [ ] Separacao automatica de PDF em imagens individuais para fotos
      de imoveis (upload de PDF -> gera 1 imagem por pagina,
      formatada para vitrine do site e busca)
- [ ] Webhook publico para anuncios do site/redes sociais gerarem
      Card automaticamente vinculado ao Imovel de interesse

## Futuro modulo Roleta Online
NOTA: o modulo Roleta Online (distribuicao automatica de leads entre
corretores, round_robin/menor_fila, automatico/semi_automatico) ja foi
CONCLUIDO - ver CLAUDE.md e PROGRESS.md. Os itens abaixo sao ideias que
ainda nao entraram na versao atual, nao um modulo inteiro em aberto.
- [ ] Referencia de conceito: modulo LeadRoulette.tsx do projeto
      antigo (por peso, status pausado - hoje so existe online/ausente/
      offline -, respeita horario de trabalho) - olhar com calma se
      fizer falta na pratica, sem copiar codigo
- [ ] Notificacao de lead atribuido pela Roleta - o sino de notificacoes
      in-app ja existe (modulo `notificacoes`, Fatia 5 do Painel
      Administrativo, ver PROGRESS.md), mas hoje so tem 1 gatilho
      (`cadastro.pendente.criado`, ver
      `CadastroPendenteCriadoListener`). Confirmado por leitura de
      codigo: nem `DistributeLeadUseCase` nem
      `ConfirmSuggestedOwnerUseCase` emitem evento nenhum hoje - o
      corretor so descobre que ganhou um lead abrindo o Kanban/Caixa de
      Entrada manualmente. Escopo: emitir um evento generico (mesmo
      padrao ja usado por `card.sem_dono.criado`, desacoplado - roleta_online
      nao precisa conhecer o modulo notificacoes) quando o modo for
      `automatico` (atribuicao direta, ver ClaimCardUseCase) e quando o
      modo for `semi_automatico` E o corretor sugerido confirmar
      (`ConfirmSuggestedOwnerUseCase`) - decidir se o modo
      `semi_automatico` tambem notifica no momento da SUGESTAO (antes da
      confirmacao) ou so depois, com o usuario antes de implementar.

## Modulo RH
- [x] Geracao automatica de contrato de prestacao de servico - Fatia 1
      (bloqueio de aprovacao sem CPF/CRECI/CNPJ, geracao do PDF via
      pdf-lib, envelope E-doc criado e enviado automaticamente) e
      Fatia 2 (rastreamento visivel na aba "Aprovados" da tela de
      Aprovacoes, com badge de status + link para o envelope) ja foram
      CONCLUIDAS - ver CLAUDE.md.
- [x] RH Fatia 3: template de contrato editavel pelo Administrador -
      CONCLUIDO. NOTA: a aba "Template de Contrato" foi migrada de
      /dashboard/rh/aprovacoes para dentro do Painel Administrativo
      (ver secao propria abaixo, ja concluida) - so o backend continua
      no modulo rh, a UI mudou de lugar.
- [ ] Fluxo de onboarding do Corretor - troca de senha obrigatoria no
      primeiro login. Hoje `CreateCorretorUseCase` ja gera senha
      temporaria aleatoria e ja envia por e-mail (via ResendEmailSender,
      ver CLAUDE.md "Envio de e-mail real") com o texto "Recomendamos
      troca-la apos o primeiro login" (`email-template-padrao.ts`) - mas
      isso e so uma RECOMENDACAO no texto do e-mail, nada FORCA a troca:
      confirmado por busca no codigo que nao existe nenhum campo tipo
      `mustChangePassword` no schema nem verificacao equivalente em
      `AuthenticateUserUseCase`. Escopo: novo campo booleano em `User`
      (default `true` quando a conta e criada com senha temporaria pelo
      Administrador, `false` em cadastro publico onde o proprio usuario
      escolhe a senha), checagem em `AuthenticateUserUseCase` retornando
      um sinalizador pro frontend forcar a tela de troca de senha antes
      de liberar o dashboard, e `UpdateMyProfileUseCase` (modulo auth, ja
      atualiza senha via `updatePassword` no fluxo de "Meu Perfil")
      zerando o campo ao trocar com sucesso.

## Painel Administrativo (expansao do modulo Configuracoes) - CONCLUIDO
- [x] Expandir "Configuracoes" para um Painel Administrativo completo -
      CONCLUIDO, 5 fatias: Dados da Empresa (realocada) + Meu Perfil +
      Template de Contrato (migrada de RH) na Fatia 1; Permissoes/Cargos
      na Fatia 2; Configuracoes da VIVI na Fatia 3; Templates de E-mail
      na Fatia 4; Notificacoes in-app (sino na Topbar) na Fatia 5 - ver
      PROGRESS.md.
- [x] Cargos hierarquicos (Diretor/Gerente/Coordenador/Corretor) -
      CONCLUIDO: aba "Permissoes/Cargos" permite reatribuir cargo/
      superior de qualquer usuario aprovado a qualquer momento (antes so
      era definido uma vez, na aprovacao).
- [x] Sistema de permissoes por cargo (RBAC real) - CONCLUIDO, 3 fatias:
      infraestrutura (JWT com cargo, getSubordinadosRecursivos,
      BlockDeleteForCargoGuard) na Fatia 1; filtro de dados por cargo
      (Kanban + Atendimento, escopo todos/equipe/proprio) na Fatia 2;
      frontend (ocultar excluir Stage, cargo em /auth/me) na Fatia 3 -
      ver PROGRESS.md. NOTA: "Plantao/Stand" (Coordenador ver so quem
      esta escalado no dia) ficou FORA desta leva de proposito - ver
      item abaixo, ja CONCLUIDO numa leva separada.
- [x] Plantao/Stand - CONCLUIDO, 3 fatias: modelagem Stand +
      EscalaPlantao + User.standId + CRUD/grade semanal no Painel
      Administrativo na Fatia 1; integracao RBAC (CARGO_ESCOPO.
      coordenador migrou de 'equipe' para o novo 'plantao',
      GetCorretoresEscaladosHojeUseCase, Coordenador sem standId ->
      lista vazia sem fallback) na Fatia 2; badge "Stand: X - N
      corretores hoje" no Kanban/Atendimento na Fatia 3 - ver
      PROGRESS.md.
- [ ] Super Usuario - hoje nenhuma conta acessa mais de 1 tenant (cada
      Administrador so ve o proprio, isolamento multitenant correto e
      desejado para clientes). Precisa de um papel novo, fora da
      hierarquia normal de Role/cargo de um tenant, para o DONO da
      plataforma SaaS (nao um cliente) acessar todos os tenants -
      avaliar com cuidado pra nao abrir brecha de vazamento entre
      tenants. Sessao dedicada. PRIORIDADE 1 dos proximos passos (ver
      PROGRESS.md).
- [ ] Modulo Agente de Atendimento Online (Cloud API oficial da Meta) -
      multiatendimento/multicanal, distribuicao de leads entre SDRs,
      tudo registrado no CRM (ver CLAUDE.md "Decisao tecnica:
      Integracao WhatsApp"). Maior escopo do roteiro, decisao
      estrategica de priorizacao, sessao dedicada. PRIORIDADE 2 dos
      proximos passos.
- [ ] Logs estruturados + monitoramento (restante da Fase C - rate
      limiting/helmet/auditoria de login ja CONCLUIDOS, ver PROGRESS.md)
      - barato de implementar. PRIORIDADE 3 dos proximos passos.
- [ ] Treinar a VIVI - item novo, escopo ainda nao detalhado (ajuste de
      prompt? novos casos de teste? feedback loop sobre conversas
      reais?) - avaliar com o usuario antes de planejar fatias.
      PRIORIDADE 4 (por ultimo) dos proximos passos.

## Modulo WhatsApp Marketing / VIVI
- [ ] Investigar erros "Bad MAC" recorrentes no log do backend em
      producao - falhas de descriptografia do Signal Protocol do
      WhatsApp/Baileys, pre-existentes a este deploy. Nao impede o
      funcionamento atual, mas vale entender a causa.

## Modulo E-doc (assinatura eletronica)
NOTA: a Fatia 1 (envelope + assinatura em posicao fixa no final do
documento, canvas ou nome digitado, ordem sequencial, trilha de
auditoria) e a Fatia 2 (editor de posicionamento de campos arrastando
sobre o PDF, geracao do PDF final assinado) ja foram CONCLUIDAS - ver
CLAUDE.md e PROGRESS.md.

## Modulo Central de Atendimento
NOTA: o port visual (4 fatias - layout/abas/filtro de fila, ChatRow,
ChatView header/corpo/historico, composer) ja foi CONCLUIDO - ver
CLAUDE.md e PROGRESS.md. Os itens abaixo ficaram fora de escopo na
Fatia 4 (composer) por falta de endpoint de midia no backend hoje -
confirmado por busca no codigo antes de implementar, nao pendencia
esquecida.
- [ ] Upload de midia (imagem/video/documento) no composer - estender
      SendWhatsAppMessageUseCase para aceitar midia (Baileys ja
      suporta)
- [ ] Envio de contato via WhatsApp no composer - mesmo pre-requisito
      acima
- [ ] Gravacao e envio de audio - endpoint de audio + UI
      MediaRecorder/waveform
