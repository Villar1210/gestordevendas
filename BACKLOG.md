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

## Modulo RH
- [x] Geracao automatica de contrato de prestacao de servico - Fatia 1
      (bloqueio de aprovacao sem CPF/CRECI/CNPJ, geracao do PDF via
      pdf-lib, envelope E-doc criado e enviado automaticamente) e
      Fatia 2 (rastreamento visivel na aba "Aprovados" da tela de
      Aprovacoes, com badge de status + link para o envelope) ja foram
      CONCLUIDAS - ver CLAUDE.md.
- [ ] RH Fatia 3: template de contrato editavel pelo Administrador -
      hoje o texto (ContratoTemplate) e criado automaticamente com um
      modelo generico de teste na primeira aprovacao que precisar dele
      (nao e assessoria juridica), mas nao ha tela para o Administrador
      editar esse texto nem criar templates adicionais - so existe a
      base de dados (model ja preparado para isso, ver
      GetOrCreateContratoTemplateUseCase). Precisa de: tela de edicao
      no painel (texto com os mesmos placeholders {{NOME}}, {{CPF}},
      {{CRECI}}, {{CNPJ_TENANT}}, etc.), por tenant.

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
