# BII — Fase 1: modelo de dados (DBA, 19/10/2026)

Status: **desenho**. Nada foi alterado em `schema.prisma` nem em `prisma/migrations/`. Convenções do projeto mantidas: `@db.Uuid`, `@map` snake_case, `tenantId` + `onDelete: Cascade` a partir de `Tenant`, Prisma v7 sem PostGIS.

## 1. Modelos propostos

### 1.1 Histórico de etapa e ganho/perda (toca `vendas_kanban` — decisão pendente do Villar)

```prisma
// Uma linha por movimento de etapa (inclui entrada da Caixa de Entrada: fromStageId null).
// Gravada na MESMA transação do update de Card.stageId (ClaimCard, mover card, Repique, Roleta).
model CardStageHistory {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  cardId        String   @map("card_id") @db.Uuid
  fromStageId   String?  @map("from_stage_id") @db.Uuid
  toStageId     String?  @map("to_stage_id") @db.Uuid
  fromStageNome String?  @map("from_stage_nome") @db.VarChar(100) // snapshot: etapa pode ser renomeada/apagada
  toStageNome   String?  @map("to_stage_nome") @db.VarChar(100)
  userId        String?  @map("user_id") @db.Uuid   // null = automático (job/Roleta/VIVI)
  ownerIdNoMomento String? @map("owner_id_no_momento") @db.Uuid // desempenho por corretor na data
  origem        String   @default("manual") @db.VarChar(20) // manual | roleta | job_repique | vivi | backfill
  movedAt       DateTime @default(now()) @map("moved_at")

  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  card      Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  fromStage Stage? @relation("HistFrom", fields: [fromStageId], references: [id], onDelete: SetNull)
  toStage   Stage? @relation("HistTo",   fields: [toStageId],   references: [id], onDelete: SetNull)
  user      User?  @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, movedAt])
  @@index([tenantId, toStageId, movedAt])
  @@index([cardId, movedAt])
  @@map("card_stage_history")
}

// Campos novos em Card (todos opcionais, sem default destrutivo):
//   ganhoEm         DateTime? @map("ganho_em")
//   perdidoEm       DateTime? @map("perdido_em")
//   motivoPerda     String?   @map("motivo_perda") @db.VarChar(30)
//   motivoPerdaObs  String?   @map("motivo_perda_obs") @db.VarChar(300)
//   datasEstimadas  Boolean   @default(false) @map("datas_estimadas") // true = vindas de backfill
//   @@index([tenantId, ganhoEm])  @@index([tenantId, perdidoEm])  @@index([tenantId, createdAt])
```

Justificativa: snapshot de nome evita perder o histórico quando a etapa muda (e `Card.stage` hoje é `onDelete: Cascade`). `motivoPerda` como **String + lista no domínio** (`domain/services/motivo-perda.ts`: `preco`, `credito_reprovado`, `localizacao`, `comprou_concorrente`, `desistiu`, `sem_contato`, `outro`), mesmo padrão já usado em `motivoRepique` — adicionar motivo não exige migration de enum.

### 1.2 Análise por endereço e concorrentes (por tenant)

```prisma
model BiiAnalise {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String   @map("tenant_id") @db.Uuid
  enderecoInformado  String   @map("endereco_informado") @db.VarChar(300)
  enderecoNormalizado String? @map("endereco_normalizado") @db.VarChar(300)
  latitude           Float?
  longitude          Float?
  raioMetros         Int      @default(1000) @map("raio_metros") // validar 100..5000 no DTO
  empreendimentoId   String?  @map("empreendimento_id") @db.Uuid
  status             String   @default("rascunho") @db.VarChar(20) // rascunho|geocodificando|processando|concluida|erro
  resultado          Json?    // snapshot dos números (ITBI/IBGE/viabilidade) para o relatório não mudar depois
  erroMensagem       String?  @map("erro_mensagem") @db.VarChar(300)
  createdById        String   @map("created_by_id") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  // relações: tenant (Cascade), empreendimento (SetNull), createdBy User (Restrict), concorrentes
  @@index([tenantId, createdAt])
  @@map("bii_analises")
}

model BiiConcorrente {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  analiseId     String?  @map("analise_id") @db.Uuid   // opcional: concorrente reaproveitável entre análises
  nome          String   @db.VarChar(150)
  construtora   String?  @db.VarChar(150)
  endereco      String?  @db.VarChar(300)
  latitude      Float?
  longitude     Float?
  fase          String?  @db.VarChar(20) // lancamento|obras|pronto
  totalUnidades Int?     @map("total_unidades")
  origem        String   @default("manual") @db.VarChar(20) // manual | coleta_auto (futuro)
  fonteUrl      String?  @map("fonte_url") @db.VarChar(500)
  coletadoEm    DateTime @default(now()) @map("coletado_em")
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([tenantId, latitude, longitude])
  @@index([tenantId, analiseId])
  @@map("bii_concorrentes")
}

// Faz sentido: um lançamento tem 2-4 tipologias com preços diferentes;
// preço/m² precisa ser por tipologia, não por empreendimento.
model BiiConcorrenteTipologia {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  concorrenteId String   @map("concorrente_id") @db.Uuid // Cascade
  descricao     String   @db.VarChar(100) // "2 dorm. c/ varanda"
  dormitorios   Int?
  areaPrivativa Decimal? @map("area_privativa") @db.Decimal(8, 2)
  precoDe       Decimal? @map("preco_de") @db.Decimal(12, 2)
  precoAte      Decimal? @map("preco_ate") @db.Decimal(12, 2)
  // preço/m² calculado na consulta (preco/area), não armazenado
  @@index([concorrenteId])
  @@map("bii_concorrente_tipologias")
}
```

### 1.3 Dados públicos GLOBAIS (exceção à regra de tenantId)

```prisma
// Guias de ITBI da Prefeitura de SP. Colunas "a confirmar ao baixar o arquivo".
model ItbiTransacao {
  id                 String   @id @default(uuid()) @db.Uuid
  chaveDedup         String   @unique @map("chave_dedup") @db.Char(64) // sha256(sql|data|valor|matricula|cartorio)
  sqlCadastro        String?  @map("sql_cadastro") @db.VarChar(20)      // a confirmar
  logradouro         String?  @db.VarChar(200)                          // a confirmar
  numero             String?  @db.VarChar(20)
  complemento        String?  @db.VarChar(100)
  bairro             String?  @db.VarChar(100)
  cep                String?  @db.VarChar(10)
  naturezaTransacao  String?  @map("natureza_transacao") @db.VarChar(80) // a confirmar
  valorTransacao     Decimal  @map("valor_transacao") @db.Decimal(14, 2)
  dataTransacao      DateTime @map("data_transacao") @db.Date
  valorVenalReferencia Decimal? @map("valor_venal_referencia") @db.Decimal(14, 2) // a confirmar
  tipoFinanciamento  String?  @map("tipo_financiamento") @db.VarChar(80)       // a confirmar (MCMV/SFH aparece aqui?)
  valorFinanciado    Decimal? @map("valor_financiado") @db.Decimal(14, 2)
  areaConstruida     Decimal? @map("area_construida") @db.Decimal(10, 2)       // a confirmar (área do IPTU, não privativa)
  areaTerreno        Decimal? @map("area_terreno") @db.Decimal(10, 2)
  fracaoIdeal        Decimal? @map("fracao_ideal") @db.Decimal(10, 6)
  usoIptu            String?  @map("uso_iptu") @db.VarChar(80)                 // a confirmar
  padraoIptu         String?  @map("padrao_iptu") @db.VarChar(80)
  anoConstrucao      Int?     @map("ano_construcao")
  latitude           Float?
  longitude          Float?
  geoPrecisao        String?  @map("geo_precisao") @db.VarChar(20) // rooftop|rua|cep|falhou
  arquivoOrigem      String   @map("arquivo_origem") @db.VarChar(100) // ex: GUIAS_ITBI_2025.xlsx/aba
  importadoEm        DateTime @default(now()) @map("importado_em")
  @@index([latitude, longitude, dataTransacao])
  @@index([dataTransacao])
  @@index([sqlCadastro])
  @@map("itbi_transacoes")
}

model GeocodeCache {
  id                  String   @id @default(uuid()) @db.Uuid
  enderecoNormalizado String   @map("endereco_normalizado") @db.VarChar(300)
  provedor            String   @db.VarChar(20) // google | nominatim
  latitude            Float?
  longitude           Float?
  precisao            String?  @db.VarChar(20)
  respostaResumo      Json?    @map("resposta_resumo") // só o necessário, sem payload bruto inteiro
  sucesso             Boolean
  criadoEm            DateTime @default(now()) @map("criado_em")
  expiraEm            DateTime? @map("expira_em") // falhas expiram (ex: 30 dias); sucessos não
  @@unique([enderecoNormalizado, provedor])
  @@map("geocode_cache")
}

// IBGE Censo 2022 por setor — decisão: IMPORTAR tabela global (só município de SP no MVP).
model IbgeSetorCensitario {
  codigo          String  @id @db.VarChar(16) // CD_SETOR
  municipioCodigo String  @map("municipio_codigo") @db.VarChar(7)
  latitude        Float   // centroide calculado na importação (script, fora do Prisma)
  longitude       Float
  populacao       Int?
  domicilios      Int?
  mediaMoradores  Decimal? @map("media_moradores") @db.Decimal(4, 2)
  faixasEtarias   Json?   @map("faixas_etarias") // {"0-14":n,"15-29":n,...}
  rendaMedia      Decimal? @map("renda_media") @db.Decimal(12, 2) // a confirmar se o IBGE publicou por setor
  versaoDados     String  @map("versao_dados") @db.VarChar(30)
  @@index([latitude, longitude])
  @@map("ibge_setores_censitarios")
}

model ParametroHabitacional {
  id          String    @id @default(uuid()) @db.Uuid
  esfera      String    @db.VarChar(10) // municipal | federal  (duas "tabelas lógicas" — ver nota)
  tipo        String    @db.VarChar(10) // HIS1 | HIS2 | HMP | MCMV_F1..MCMV_F4
  rendaMin    Decimal   @map("renda_min") @db.Decimal(12, 2)
  rendaMax    Decimal   @map("renda_max") @db.Decimal(12, 2)
  tetoVenda   Decimal?  @map("teto_venda") @db.Decimal(12, 2)
  jurosAnual  Decimal?  @map("juros_anual") @db.Decimal(5, 2) // só MCMV
  salarioMinimoRef Decimal? @map("salario_minimo_ref") @db.Decimal(10, 2) // só municipal
  vigenteDe   DateTime  @map("vigente_de") @db.Date
  vigenteAte  DateTime? @map("vigente_ate") @db.Date // null = vigente
  fonte       String    @db.VarChar(300) // ex: "Decreto 64.895/2026, DOM 06/01/2026"
  createdById String?   @map("created_by_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  @@unique([tipo, vigenteDe])
  @@index([esfera, tipo, vigenteDe])
  @@map("parametros_habitacionais")
}

model IndiceIncc {
  mes        DateTime @id @db.Date // 1º dia do mês
  variacao   Decimal  @db.Decimal(7, 4) // % no mês
  fonte      String   @default("BCB-SGS") @db.VarChar(30) // série 192 (INCC-M) a confirmar
  importadoEm DateTime @default(now()) @map("importado_em")
  @@map("indices_incc")
}
```

Nota sobre "duas tabelas": o pedido era tabelas separadas para municipal e federal. Proponho **uma tabela física com `esfera`** e o domínio tratando como dois conjuntos independentes (não há FK entre eles, a classificação roda nas duas). Se o Villar preferir duas físicas (`ParametroHis` e `ParametroMcmv`), é trivial — a diferença real é só `juros` vs `salarioMinimoRef`. Ponto a confirmar.

**Por que o global é seguro:** ITBI, IBGE, INCC, parâmetros legais e cache de geocodificação são dados públicos, idênticos para todo tenant e sem nada do tenant dentro. Regras: (a) nenhuma tabela global tem FK para tabela de tenant nem vice-versa (exceto via `BiiAnalise.resultado` em JSON); (b) escrita só por job/admin de plataforma, nunca por rota de tenant (parâmetros: decidir se Administrador de tenant edita — recomendo que **não**); (c) o que é do tenant (qual endereço pesquisou) fica em `BiiAnalise`/`BiiConsultaLog`, com tenantId. O `GeocodeCache` revela que *algum* tenant consultou um endereço, mas não qual — aceitável; se incomodar, guardar `sha256(enderecoNormalizado)` em vez do texto.

**IBGE importado vs sob demanda:** importar. ~27 mil setores no município de SP (a confirmar), alguns MB; a API do IBGE não faz busca por raio, exigiria baixar a malha a cada consulta. Centroide calculado uma vez no script (sem PostGIS no banco).

### 1.4 Auditoria e custo

```prisma
model BiiConsultaLog {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  acao      String   @db.VarChar(40) // painel_vendas|analise_criar|itbi_raio|geocode|ia_resumo|exportar
  analiseId String?  @map("analise_id") @db.Uuid
  parametros Json?   // filtros/raio; sem dado pessoal de cliente
  ip        String?  @db.VarChar(45)
  createdAt DateTime @default(now()) @map("created_at")
  @@index([tenantId, createdAt])
  @@map("bii_consulta_log")
}

model BiiUsoDiario { // mesmo padrão de ViviUsoDiario
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @map("tenant_id") @db.Uuid
  data              DateTime @db.Date
  geocodificacoes   Int      @default(0)
  chamadasIa        Int      @default(0)
  tokensIa          Int      @default(0) @map("tokens_ia")
  analises          Int      @default(0)
  @@unique([tenantId, data])
  @@map("bii_uso_diario")
}
```
Incremento com `upsert` + `increment` atômico; a checagem de limite antes da chamada externa usa `updateMany ... where contador < limite` (vence a corrida, como no `ViviUsoDiario`).

## 2. Índices (resumo)
- Painéis: `cards(tenant_id, created_at)`, `(tenant_id, ganho_em)`, `(tenant_id, perdido_em)`; `card_stage_history(tenant_id, moved_at)` e `(tenant_id, to_stage_id, moved_at)`.
- Bounding box: B-tree composto `(latitude, longitude[, data_transacao])`. Com faixa em latitude o Postgres usa a 1ª coluna e filtra a 2ª no índice; para raio ≤ 3 km isso cai em poucos milhares de linhas — suficiente. Alternativa sem PostGIS se ficar lento: extensão `cube`+`earthdistance` (contrib padrão) ou coluna `geohash` prefixada — avaliar só com medição.
- Cache: unique `(endereco_normalizado, provedor)`; ITBI: unique `chave_dedup`.

## 3. Estratégia de migrations (nada destrutivo)
Ordem (pastas `prisma/migrations/AAAAMMDDHHMMSS_nome/`), uma por fatia:
1. `..._card_stage_history_ganho_perda` — `CREATE TABLE` + `ALTER TABLE cards ADD COLUMN` (nullable / default false; sem rewrite de tabela no PG ≥ 11). Junto, alterar os use cases que mudam `stageId` para gravar histórico (regra 5 do CLAUDE.md: avisar antes).
2. `..._bii_parametros_incc` — globais + seed das faixas HIS/HMP do Decreto 64.895 e MCMV (via script, não na migration).
3. `..._bii_geocode_itbi_ibge` — tabelas vazias; carga por script/job.
4. `..._bii_analise_concorrentes_log_uso`.
Deploy como de costume: `npx prisma migrate deploy` + `npm run db:generate` + build.

**Cards antigos (honestidade):** não existe histórico de etapas; não dá para reconstruí-lo. O que dá:
- Uma linha de backfill por card com `toStageId = stageId atual`, `movedAt = updatedAt`, `origem='backfill'` — mas `updatedAt` muda com qualquer edição, então é só "estava nessa etapa em/antes de X", **não** a data de entrada.
- Cards hoje na etapa terminal ("Fechamento"): `ganhoEm = updatedAt`, `datasEstimadas = true`. Pode estar errado em meses.
- Perdas antigas: inexistentes (não há conceito). `motivoRepique`/`movidoParaRepiqueEm` dão um sinal parcial de desistência, não de perda.
- Painel: funil/conversão/ciclo calculados **só a partir da data de corte** (deploy da migration 1), com aviso "dados anteriores a DD/MM são estimados"; VGV antigo pode usar `Contrato` tipo venda (`dataInicio`, `valor`), que é fonte mais confiável que o Card.

## 4. Consultas-chave (parametrizadas)

```sql
-- Conversão por etapa no período: cards que ENTRARAM em cada etapa
SELECT h.to_stage_id, MAX(h.to_stage_nome) AS etapa, s.position,
       COUNT(DISTINCT h.card_id) AS cards
FROM card_stage_history h
LEFT JOIN stages s ON s.id = h.to_stage_id AND s.tenant_id = $1
WHERE h.tenant_id = $1 AND h.moved_at >= $2 AND h.moved_at < $3
  AND h.origem <> 'backfill'
GROUP BY h.to_stage_id, s.position
ORDER BY s.position NULLS LAST;
-- taxa etapa N→N+1 = cards(N+1)/cards(N), calculada na aplicação.

-- VGV ganho por mês
SELECT date_trunc('month', c.ganho_em AT TIME ZONE 'America/Sao_Paulo') AS mes,
       COUNT(*) AS vendas, SUM(c.value) AS vgv
FROM cards c
WHERE c.tenant_id = $1 AND c.ganho_em >= $2 AND c.ganho_em < $3
GROUP BY 1 ORDER BY 1;

-- ITBI num raio R (global: sem tenant_id), preço/m² mediano
WITH p AS (SELECT $1::float8 AS lat, $2::float8 AS lng, $3::float8 AS r),
bb AS (SELECT lat, lng, r,
         r/111320.0 AS dlat, r/(111320.0*cos(radians(lat))) AS dlng FROM p)
SELECT COUNT(*) AS transacoes,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY t.valor_transacao / t.area_construida) AS m2_mediano
FROM itbi_transacoes t, bb
WHERE t.latitude  BETWEEN bb.lat - bb.dlat AND bb.lat + bb.dlat
  AND t.longitude BETWEEN bb.lng - bb.dlng AND bb.lng + bb.dlng
  AND t.data_transacao >= $4
  AND t.area_construida > 10 AND t.valor_transacao > 10000
  AND 2*6371000*asin(sqrt(
        power(sin(radians(t.latitude - bb.lat)/2),2) +
        cos(radians(bb.lat))*cos(radians(t.latitude))*
        power(sin(radians(t.longitude - bb.lng)/2),2))) <= bb.r;
```
(Via `prisma.$queryRaw` com template tag — nunca `$queryRawUnsafe` com concatenação. Painéis: teste obrigando `tenant_id = $1`.)

## 5. Volumetria e impacto no VPS
- ITBI SP: estimativa ~150–250 mil guias/ano (a confirmar no arquivo). 5 anos ≈ 1 milhão de linhas × ~400 B + índices ≈ **0,6–1 GB**. Importação anual + mensal em lotes de 5 mil (`createMany skipDuplicates` pela `chave_dedup`), fora do horário comercial.
- Geocodificação é o gargalo real, não o banco: 200 mil endereços/ano ≫ 10 mil grátis/mês do Google. Estratégia: geocodificar por **logradouro+número único** (muitas guias repetem endereço de condomínio — reduz bastante), cache, Nominatim com limite de 1 req/s para o volume (≈ 2–3 dias por ano de dados, job em background), Google só para falhas e para o endereço da análise.
- IBGE: ~27 mil linhas, irrelevante. Card history: ~5–10 linhas/card, irrelevante.
- Postgres (porta 5434, 2 vCPU): consulta de raio com bounding box em ~1 M linhas: dezenas de ms. Risco é o `percentile_cont` e painéis sem cache em horário de pico — cachear resultado em `BiiAnalise.resultado` e no Redis (TTL curto) para painéis. Fazer `ANALYZE` após cada carga; `VACUUM` normal.

## 6. Riscos e pontos a confirmar
1. Villar aprovar mudança no `vendas_kanban` (todos os pontos que alteram `stageId` precisam gravar histórico — inclusive jobs; esquecer um gera funil furado). Sugestão: centralizar num método do repositório de Card.
2. Definição de "ganho": etapa "Fechamento" (nome fixo hoje) ou ação explícita "Marcar ganho/perdido"? Recomendo ação explícita + histórico.
3. "Desempenho por stand": `Card` não tem `standId`; `User.standId` só existe para Coordenador. Opções: `Card.standId` novo (preenchido pela Roleta/escala) ou derivar de `EscalaPlantao` na data. A decidir.
4. Colunas reais do arquivo ITBI (nomes, abas por mês, se `área construída` é do lote/unidade). Área do IPTU ≠ área privativa: preço/m² ITBI é indicativo.
5. Renda por setor no Censo 2022: publicação não confirmada.
6. `GeocodeCache` global e termos do Google (cache de resultados tem restrição contratual — conferir; Nominatim/OSM permite com atribuição).
7. Parâmetros habitacionais: quem edita (plataforma vs tenant) e se fica uma tabela com `esfera` ou duas físicas.
8. `Card.stageId` com `onDelete: Cascade`: apagar uma etapa apaga cards e, por cascata, o histórico deles. Não muda agora, mas registrar.
9. LGPD: ITBI traz SQL/matrícula (identificam o imóvel, não o comprador); não guardar nome de contribuinte se aparecer. Logs sem dado de cliente.
