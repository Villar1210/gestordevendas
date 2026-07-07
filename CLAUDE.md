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
   Atendimento Online" (Roleta Online), sistema multiatendimento/
   multicanal com distribuicao de leads entre SDRs, tudo registrado no
   CRM. Ainda nao implementado.
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
O tsconfig.json do backend exclui explicitamente a pasta frontend/ (para
o watch mode do backend nao compilar arquivos .tsx/.ts do frontend por
engano, o que corrompe arquivos como next.config.js). O frontend usa o
builder padrao do Next.js (webpack), nao o Turbopack, pois o fetcher de
fontes do Turbopack neste ambiente nao consegue baixar Google Fonts.

## Modulo futuro planejado: RH / Cadastros e Perfis
Cenario de negocio (Daniel presta servico para uma construtora):
- Equipe interna ("House"): corretores cadastrados via formulario
  proprio (exige CRECI), ficam pendentes de aprovacao do RH, depois
  sao alocados em equipe sob um Gerente de Vendas.
- Parceiros externos (fora da equipe interna): Corretor Parceiro
  (autonomo, indica clientes) e Imobiliaria Parceira (empresa externa
  com CNPJ/CRECI-J e responsavel com cargo).
- Clientes, dois tipos: Cliente Comprador (busca imovel) e Cliente
  Proprietario (autoriza a venda/aluguel do proprio imovel).

Este cenario nao cabe no modelo atual de Tenant/Role simples - vai
exigir um modulo dedicado (proposto: "modulo RH") com fluxo de cadastro
publico multi-perfil, aprovacao (RH validando corretor da House),
hierarquia (corretor -> gerente de vendas), e relacionamentos distintos
por tipo de parceiro/cliente. Telas de referencia (login, criar
cadastro com 5 perfis) foram compartilhadas em imagem no chat, ainda
nao implementadas. Retomar quando o modulo de Vendas/Kanban estiver
fechado.

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
Entrada. O futuro modulo Roleta Online vai automatizar a distribuicao
(hoje e manual, via clique em "Iniciar Atendimento").

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
