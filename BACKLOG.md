# Backlog de Funcionalidades - gestordevendas

Lista de funcionalidades identificadas como referencia (projeto antigo
do proprio Daniel, C:\laragon\www\ivillar\crm) e ainda nao implementadas
no gestordevendas. Nenhum codigo daquele projeto foi copiado - tudo aqui
sera implementado do zero quando priorizado.

## Modulo Kanban/Vendas
- [ ] Score do lead (barra de progresso 0-100)
- [ ] SLA por etapa com alerta visual (dias sem contato)
- [ ] Multiplos pipelines com seletor no cabecalho
- [ ] Reordenar colunas por arraste (ja suportado no backend via
      MoveStageUseCase, falta habilitar no frontend)
- [ ] Editar/excluir etapa direto no cabecalho da coluna (hover)
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
- [ ] Referencia de conceito: modulo LeadRoulette.tsx do projeto
      antigo (round-robin, por peso, por fila, status do corretor
      disponivel/pausado/offline, respeita horario de trabalho) -
      olhar com calma quando iniciarmos este modulo, sem copiar codigo
