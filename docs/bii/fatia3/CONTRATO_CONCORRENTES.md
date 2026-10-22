# BII — Fatia 3: Concorrentes (contrato)

Objetivo: o Administrador cadastra os empreendimentos concorrentes que ele conhece (visita ao stand, site da construtora, material de vendas) e os vê **no mapa e na tabela da Análise por Endereço**, comparando o preço/m² anunciado com o ITBI da região. Pergunta que a fatia responde: *"perto do meu lançamento, quem está vendendo, o quê, por quanto e com que velocidade?"*

Fora do escopo (fatias futuras): coleta automática (Apify/portais — só depois de revisão jurídica dos termos de uso, ver SEGURANCA_TESTES A10), parecer por IA, vínculo com `Empreendimento` próprio.

## 1. Modelo (por tenant)

Migration `20261022120000_bii_concorrentes` (só `CREATE TABLE`).

```prisma
model BiiConcorrente {
  id                String    @id @default(uuid()) @db.Uuid
  tenantId          String    @map("tenant_id") @db.Uuid          // FK Tenant, Cascade
  nome              String    @db.VarChar(150)
  construtora       String?   @db.VarChar(150)
  endereco          String    @db.VarChar(200)                     // texto digitado (limpo)
  enderecoFormatado String?   @map("endereco_formatado") @db.VarChar(500)
  latitude          Float
  longitude         Float
  precisao          String    @db.VarChar(10)  // rooftop|rua|cep|bairro|manual
  fase              String    @db.VarChar(20)  // lancamento|obras|pronto
  dataLancamento    DateTime? @map("data_lancamento") @db.Date
  totalUnidades     Int?      @map("total_unidades")
  unidadesVendidas  Int?      @map("unidades_vendidas")
  fonte             String?   @db.VarChar(120) // "visita ao stand", "site da construtora"
  fonteUrl          String?   @map("fonte_url") @db.VarChar(500) // só https, só exibida
  observacoes       String?   @db.VarChar(1000)
  origem            String    @default("manual") @db.VarChar(20)
  createdById       String    @map("created_by_id") @db.Uuid    // sem FK (excluir usuário não apaga)
  updatedById       String    @map("updated_by_id") @db.Uuid
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  tipologias        BiiConcorrenteTipologia[]
  @@index([tenantId, latitude, longitude])
  @@map("bii_concorrentes")
}

model BiiConcorrenteTipologia {
  id            String   @id @default(uuid()) @db.Uuid
  concorrenteId String   @map("concorrente_id") @db.Uuid  // FK Cascade
  ordem         Int
  descricao     String   @db.VarChar(100)                 // "2 dorm. c/ varanda"
  dormitorios   Int?
  areaPrivativa Decimal  @map("area_privativa") @db.Decimal(8, 2)
  precoDe       Decimal  @map("preco_de") @db.Decimal(12, 2)
  precoAte      Decimal? @map("preco_ate") @db.Decimal(12, 2)
  @@index([concorrenteId])
  @@map("bii_concorrente_tipologias")
}
```

A tipologia não tem `tenantId` próprio (como `SignatureRecipient` do E-doc): sempre lida e gravada **através** do concorrente, que é tenant-scoped. R$/m² não é guardado (calculado: `preco ÷ área privativa`).

## 2. Regras de negócio (domínio puro: `domain/services/concorrente.ts`)

- **Fase**: `lancamento` (Lançamento), `obras` (Em obras), `pronto` (Pronto).
- **Tipologias**: 1 a 10 por concorrente. Área privativa 10–1.000 m²; preço de R$ 10.000 a R$ 100.000.000; `precoAte` opcional e ≥ `precoDe`; dormitórios 0–10.
- **R$/m² da tipologia**: `precoDe ÷ área` (e `precoAte ÷ área` quando houver). Só entra na estatística se ficar entre R$ 500 e R$ 60.000/m² (mesma faixa do ITBI).
- **R$/m² do concorrente**: mediana dos R$/m² "a partir de" das tipologias válidas. "Faixa": menor e maior R$/m² (de/até).
- **Vendas** (só quando os dados existem): `unidadesVendidas ≤ totalUnidades` (senão 400). `% vendido = vendidas ÷ total`. **Vendas por mês** = vendidas ÷ meses desde `dataLancamento` (mínimo 1 mês), só com data de lançamento no passado.
- **Desatualizado**: `updatedAt` com mais de 90 dias → selo "dado de mais de 3 meses" (preço de lançamento muda rápido).
- **Limite**: 300 concorrentes por tenant (409 acima disso).

## 3. Geocodificação

- Na criação, e na edição **quando o endereço muda**, o backend geocodifica com o mesmo provedor da Fatia 2 (cache → Nominatim, fila global de 1 req/s). Fora da Grande SP ou não encontrado → **422** com a mesma mensagem da análise. Provedor fora → **503**.
- **Ajuste manual do pino** (a geocodificação erra): o corpo aceita `latitude` + `longitude` opcionais (os dois juntos). Quando vêm, o backend **não** geocodifica, só confere que o ponto está na Grande SP e grava `precisao = "manual"`.

## 4. Rotas (`BiiConcorrenteController`, `@Controller('bii')`)

Classe `JwtAuthGuard + RolesGuard + @Roles('Administrador')`; use cases repetem `exigirAdministrador`. `tenantId`, usuário e `impersonadoPor` sempre de `req.user`.

| Método e rota | O que faz | Limite |
|---|---|---|
| `GET /bii/concorrentes` | lista do tenant (com tipologias e números calculados), mais recentes primeiro | — |
| `GET /bii/concorrentes/:id` | um concorrente (404 se for de outro tenant) | — |
| `POST /bii/concorrentes` | cria (geocodifica) | 30/min por IP + 30/min por usuário somando POST/PATCH/DELETE; 2 simultâneas |
| `PATCH /bii/concorrentes/:id` | edita; tipologias enviadas **substituem** as anteriores (recria, numa transação) | 30/min |
| `DELETE /bii/concorrentes/:id` | exclui (cascata nas tipologias) | 30/min |

- **Cota diária de buscas de endereço** por empresa (`BII_CONCORRENTE_GEOCODIFICACOES_POR_DIA`, padrão 100) → **429** `{ code: "BII_COTA_DIARIA" }`. Protege a fila global do Nominatim, que a análise de todos os tenants usa. Pino manual não gasta cota.
- **Impersonação do Super Usuário**: POST/PATCH/DELETE → **403** `{ code: "BII_SOMENTE_LEITURA" }` (mesma regra da Fatia 2). GET liberado.
- Escrita/remoção sempre `updateMany`/`deleteMany where { id, tenantId }`; `count === 0` → 404.
- DTO com `whitelist` + `forbidNonWhitelisted` (global). Campos de texto: sem caracteres de controle, `trim`. `fonteUrl`: `https://` apenas, ≤ 500; o servidor **nunca** busca a URL (só exibida com `rel="noopener noreferrer"`).

Formato de cada concorrente na resposta:
```ts
{
  id, nome, construtora, endereco, enderecoFormatado, lat, lng, precisao,
  fase, dataLancamento /* YYYY-MM-DD | null */, totalUnidades, unidadesVendidas,
  fonte, fonteUrl, observacoes, origem: 'manual',
  tipologias: [{ descricao, dormitorios, areaPrivativa, precoDe, precoAte, precoM2De, precoM2Ate }],
  calculado: {
    precoM2Mediano: number | null, precoM2Min: number | null, precoM2Max: number | null,
    precoMin: number | null, precoMax: number | null,
    percentualVendido: number | null /* 0-100, 1 casa */, vendasPorMes: number | null /* 1 casa */,
    desatualizado: boolean,
  },
  criadoEm, atualizadoEm,
}
```

## 5. Integração com a Análise por Endereço

`AnalisarEnderecoUseCase` passa a buscar os concorrentes **do próprio tenant** dentro do bounding box e corta pelo raio (haversine, domínio puro). A resposta (e o snapshot salvo em `BiiAnalise.resultado`) ganha:

```ts
concorrentes: {
  itens: Array<ConcorrenteResposta sem observacoes/fonte/fonteUrl & { distanciaMetros: number }>, // mais próximos primeiro, até 50 (sem textos livres no snapshot: LGPD)
  resumo: { quantidade: number, precoM2Mediano: number | null /* mediana dos concorrentes */, unidadesTotais: number | null },
}
```

- Análise salva antes desta fatia não tem o campo → a tela trata como ausente ("não havia concorrentes nesta análise").
- **Comparação com o ITBI**: mostrar lado a lado, **sem** calcular "diferença %" como se fossem a mesma coisa. ITBI usa área construída do IPTU (inclui áreas comuns) e valor efetivamente pago; concorrente usa área privativa e preço anunciado. A tela explica isso em uma linha.

## 6. Tela (frontend)

- Aba **Concorrentes** (`/dashboard/bii/concorrentes`) deixa de ser "em breve": tabela (nome, construtora, fase, endereço, tipologias, faixa de preço, R$/m², % vendido, atualizado em) + botão **Cadastrar concorrente** + estado vazio que ensina.
- **Formulário** (painel lateral, criar e editar): dados gerais, tipologias (adicionar/remover linhas, R$/m² calculado na hora), vendas, fonte. Aviso fixo: *"Não registre dados pessoais (nome ou telefone de corretor)."* Depois de salvar, mostra o pino no mapa com **"Ajustar posição no mapa"** (clique no mapa move o pino e grava `precisao = manual`).
- **Análise por Endereço**: concorrentes no mapa (marcador próprio, cor diferente das transações, popup com nome, fase, R$/m² e link "ver concorrente") e card **"Concorrentes no raio"** com a tabela e o R$/m² mediano dos concorrentes ao lado do mediano do ITBI.
- Selo de fonte **"Manual"** em todo número vindo de concorrente.

## 7. Testes e aceite

- Domínio: cálculos de R$/m², mediana, % vendido, vendas/mês, desatualizado, validações (100% dos ramos).
- Use cases: isolamento de tenant (ler/editar/excluir de outro tenant → 404), impersonação 403 com code, limite de 300, geocodificação só quando o endereço muda, ponto manual fora da Grande SP → 400.
- Meta-teste de permissões cobre o controller novo (só Administrador; guard de método aceito só o throttler por usuário).
- Integração com banco real: isolamento + análise devolvendo só concorrentes do tenant e dentro do raio.
- E2E Playwright: cadastrar concorrente com 2 tipologias → aparecer na lista → análise do endereço vizinho mostra o pino e a tabela → editar (ajustar pino) → excluir. Limpeza por cascata do tenant.
- `npm run build` (backend e frontend) limpo.

## 8. Deploy

**Não fazer deploy enquanto a VPS não for reconstruída** (incidente de 21/10/2026). Quando for: `npx prisma migrate deploy` + `npm run db:generate` + build + `pm2 restart gestordevendas --update-env`; frontend `rm -rf .next` + build + restart. Nenhuma dependência nova, nenhuma variável nova.
