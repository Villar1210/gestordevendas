# Contrato: Cadastro de Construtoras (aprovado pelo Villar em 30/10/2026)

## Problema

Hoje o sistema mistura dois conceitos:

- **Empresa (tenant):** quem assina a plataforma (a operação de vendas do Villar e, no futuro, cada cliente do SaaS). Fica em Configurações → Dados da Empresa. Isso está certo.
- **Construtora/incorporadora:** a parceira cujos produtos a empresa vende (Direcional, Novolar, Riva...). Ela pertence ao **empreendimento**, não à empresa.

Como está o código:

1. `Empreendimento.construtora` é **texto livre** (VARCHAR 150). Não há cadastro, logo nem padronização: "Novolar", "NOVOLAR" e "Novo Lar" viram três construtoras.
2. `ViviConfig.sobreConstrutora` / `diferenciaisConstrutora` são **por empresa**. Com Direcional e Novolar na mesma conta, a VIVI fala da Direcional para um lead do Novolar Freguesia.

## Fatia A: cadastro + vínculo no empreendimento

### Banco (migration nova, `CREATE` + `ALTER ADD COLUMN`, sem apagar nada)

`Construtora` (tabela `construtoras`, por tenant, FK Tenant Cascade):

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | |
| tenantId | uuid | isolamento multitenant |
| nome | varchar(150) | obrigatório |
| nomeNormalizado | varchar(150) | sem acento/caixa/espaço duplo; `@@unique([tenantId, nomeNormalizado])` |
| site | varchar(255)? | só https |
| sobre | varchar(2000)? | texto institucional para a VIVI e o site |
| diferenciais | varchar(1500)? | |
| logoUrl | varchar? | upload igual às fotos (JPG/PNG/WebP pelos bytes, 2 MB) |
| createdAt / updatedAt | | |

`Empreendimento.construtoraId` (uuid?, FK `onDelete: SetNull`).

O campo texto `Empreendimento.construtora` **continua existindo** nesta fatia (site público, BII e book ainda leem). Ao salvar um empreendimento com `construtoraId`, o texto passa a ser o `nome` da construtora (fica sempre igual). Remover a coluna texto fica para depois, numa fatia própria.

**Migração dos dados que já existem** (dentro da própria migration, SQL parametrizado por tenant):
- para cada `(tenant_id, construtora)` distinto e não vazio em `empreendimentos`, cria uma `Construtora` (nome = o valor mais usado daquele grupo normalizado);
- preenche `construtora_id` nos empreendimentos correspondentes.

### Rotas (`gestao_imobiliaria`, `ConstrutoraController`)

| Rota | Quem |
|---|---|
| GET /construtoras, GET /construtoras/:id | DASHBOARD_ROLES (corretor lê) |
| POST, PATCH, DELETE /construtoras/:id | só Administrador (classe Admin + meta-teste, padrão de Imóveis) |
| POST/DELETE /construtoras/:id/logo | só Administrador |

- Nome repetido no mesmo tenant (normalizado) → 409 "Já existe uma construtora com esse nome."
- DELETE com empreendimentos vinculados → 409 "Esta construtora tem N empreendimentos. Troque a construtora deles antes de excluir." (a decidir: ver pergunta 1)
- Toda leitura/escrita por `{ id, tenantId }`.

### Empreendimento

- `POST/PATCH /empreendimentos` aceitam `construtoraId` (do próprio tenant, senão 404). `construtora` (texto) continua aceito por compatibilidade; se vier só o texto, procura pelo nome normalizado e, se não achar, **cria** a construtora (mesmo comportamento do book).
- Book (analisar/confirmar): a IA continua lendo o nome da construtora do PDF; ao confirmar, liga à construtora existente pelo nome normalizado ou cria uma nova.

### Frontend

- Imóveis ganha a aba **Construtoras** (lista + painel lateral: nome, site, logo, sobre, diferenciais). Só Administrador edita; corretor vê.
- Formulário do empreendimento: o campo texto vira um **seletor de construtora** com "+ Nova construtora" no próprio seletor (abre um mini-formulário só com o nome).
- Site público: mostra nome (e logo, se houver) da construtora no empreendimento.

## Fatia B: VIVI fala da construtora certa

- `ViviConversation.empreendimentoId` já existe. Ao montar o prompt, se a conversa tem empreendimento e ele tem construtora com `sobre`/`diferenciais`, o bloco "Sobre a construtora/incorporadora" usa **o texto da construtora do empreendimento**.
- Sem empreendimento ou construtora sem texto → usa o texto da Configuração da VIVI (que vira "texto institucional padrão"). Ver pergunta 3.
- O `vivi_sdr` lê a construtora por um repositório **próprio** (não importa o `gestao_imobiliaria`), como já é feito em outros módulos.
- Lista de empreendimentos que a VIVI recebe (`/vivi/empreendimentos`) passa a trazer o nome da construtora.

## Fora do escopo

- Tela "Nova empresa assinante" no Super Usuário (SaaS: plano, cobrança, aprovação). Fica para uma fatia futura.
- Remover a coluna texto `Empreendimento.construtora`.
- BII Concorrentes continua com construtora em texto livre (é dado de terceiros, não parceira).

## Testes

- Domínio: normalização de nome, regra de vínculo.
- Use cases: isolamento de tenant (construtora de outro tenant → 404), nome duplicado, DELETE com vínculo, empreendimento com texto cria/acha construtora.
- Meta-teste de permissões do controller novo.
- Migration testada num banco com dados de exemplo (3 grafias da mesma construtora viram 1).
- Fatia B: prompt com construtora do empreendimento × fallback.
- E2E Playwright: criar construtora, vincular no empreendimento, corretor só lê.

## Deploy

`npx prisma migrate deploy` + `npm run db:generate` + build backend e frontend (`rm -rf .next`). Sem dependência nova, sem variável nova. Reinício só dos processos do gestordevendas (nunca restart geral).

## Decisões do Villar (30/10/2026)

1. **Excluir construtora com empreendimentos:** BLOQUEAR (409 com a quantidade de empreendimentos).
2. **Logo:** entra JÁ na Fatia A.
3. **Texto atual da VIVI** (Configuração da VIVI): vira o **texto institucional padrão** (fallback quando o empreendimento da conversa não tem construtora com texto). Rótulo na tela da VIVI muda para deixar isso claro.
