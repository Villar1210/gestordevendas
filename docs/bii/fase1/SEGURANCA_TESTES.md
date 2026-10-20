# BII — Fase 1: Segurança e Testes (19/10/2026)

Segurança + QA. Desenho apenas; nenhum código alterado.

## 1. Modelo de ameaças (STRIDE resumido)

| # | Ameaça | STRIDE | Risco |
|---|---|---|---|
| A1 | Vazamento entre tenants: um `where` sem `tenantId` (sem RLS) ou agregação `$queryRaw` sem filtro | I | Alto |
| A2 | Escalada de role: rota do BII sem `@Roles('Administrador')` ou Corretor promovido/rebaixado | E | Alto |
| A3 | Super Usuário impersonando (token com `impersonadoPor`, role vem do payload, sem `tokenVersion`) lê VGV/ranking do cliente | I/R | Médio |
| A4 | SSRF: endereço/URL do usuário virando URL de requisição (geocoding, Apify, "link do anúncio") | S/I | Alto |
| A5 | SQL injection em agregações (`$queryRawUnsafe`, interpolação de coluna/ordem/período) | T/I | Alto |
| A6 | XLSX malicioso: zip bomb, XML gigante, milhões de linhas, fórmulas (`=HYPERLINK`, CSV injection ao reexportar) | D/T | Alto |
| A7 | Abuso de custo: loop de geocoding pago, parecer de IA repetido, coleta Apify | D | Médio |
| A8 | Prompt injection: texto livre de concorrente (nome, observação, descrição de anúncio) entra no prompt do parecer | T | Médio |
| A9 | Exposição de chaves (Google, Anthropic, Apify) em log, resposta, frontend ou `.env` impresso | I | Alto |
| A10 | Scraping de portais: violação de termos de uso e coleta de dado pessoal de corretor (nome, telefone, CRECI) | Legal/LGPD | Alto |
| A11 | Repúdio de consulta/importação (mitigado pelo `BiiConsultaLog`) | R | Baixo |
| A12 | Envenenamento do dado ITBI compartilhado: importação de um tenant altera dado que todos leem | T | Alto |

## 2. Controles obrigatórios

**A1 — Isolamento de tenant**
- Toda leitura com `where: { tenantId }`; toda escrita/remoção com `updateMany/deleteMany where { id, tenantId }` e `count === 0 → 404` (padrão `CondicaoDonoImovel` de Imóveis).
- `tenantId` sempre de `req.user.tenantId`, nunca de body/query/param (DTO com `whitelist`/`forbidNonWhitelisted` já rejeita campo extra).
- Tabelas públicas (ITBI, IBGE, parâmetros HIS/MCMV) SEM `tenantId` e somente leitura para o tenant; resultados por tenant (consultas, concorrentes, viabilidade, pareceres) COM `tenantId` + `onDelete: Cascade`.
- Teste de isolamento por repositório (seção 4.2).

**A2 — RBAC**
- Classe de cada controller do BII: `@UseGuards(JwtAuthGuard, RolesGuard, AppThrottlerGuard) @Roles('Administrador')`. Nenhuma rota com `DASHBOARD_ROLES`.
- Use case repete a checagem (`requesterRole !== 'Administrador' → 403`), como no RH/E-doc.
- Meta-teste de rotas obrigatório (4.3). Role/cargo já vêm do banco no `JwtStrategy` (rebaixamento vale na hora).
- Frontend: `requiredRole` no `NAV_ITEMS` + `SomenteAdminGuard` (só UX).

**A3 — Impersonação de Super Usuário**
- Aceitável **somente leitura** (suporte). Proposta (decisão do Villar): com `req.user.impersonadoPor` preenchido, rotas que custam dinheiro ou gravam (gerar parecer IA, geocodificar endereço novo, importar ITBI, coletar Apify, criar/editar concorrente) → 403 "Ação indisponível em modo de suporte."
- Auditoria: `BiiConsultaLog` grava `impersonadoPor` (id do Super Usuário) em toda requisição feita com esse token; cruza com `AcessoPlataformaLog` já existente. Token de impersonação tem TTL curto (2h) — manter.

**A4 — SSRF**
- O usuário nunca fornece URL. Endereço é só texto (`MaxLength(300)`, sem quebra de linha) enviado como **parâmetro codificado** (`URLSearchParams`) a hosts fixos em constante: `maps.googleapis.com`, `nominatim.openstreetmap.org`, `servicodados.ibge.gov.br`, `api.apify.com`, `api.bcb.gov.br`.
- Cliente HTTP com allowlist de host, sem seguir redirect para outro host, timeout 10s, resposta ≤ 2 MB.
- URL de anúncio é só exibida (`https:`, `rel="noopener noreferrer"`), nunca buscada pelo servidor.

**A5 — SQL**
- Preferir `groupBy`/`aggregate` do Prisma (padrão `countByTenantGroupedByStatus` do E-doc).
- `$queryRaw` só com template tag (parametrizado, como em `prisma-corretor.repository.ts`); **`$queryRawUnsafe` e `Prisma.raw` proibidos** no módulo (grep no checklist).
- Ordenação/agrupamento/período por enum fechado mapeado para fragmento fixo (`Prisma.sql`), nunca string do cliente.
- `tenantId` como primeiro filtro de toda query bruta, coberto por teste.

**A6 — Upload XLSX do ITBI**
- Guard `LimiteConcorrenciaGuard('bii-itbi', 1)` + Content-Length obrigatório e máximo (ex.: 40 MB) recusado antes do multer (padrão `BookRequestSizeGuard`/pdf_tools 411/413).
- Magic bytes ZIP (`PK\x03\x04`) + extensão `.xlsx`; recusar `.xlsm`/macro.
- Anti zip bomb: inspecionar o diretório central antes de abrir — soma descompactada ≤ 300 MB, razão ≤ 100:1, ≤ 50 entradas.
- Ler com `exceljs` em **streaming** (`WorkbookReader`), teto de 600 mil linhas e de colunas; prazo total (padrão `batchDeadlineMs`) e abort na conexão fechada.
- Fórmula: usar só `result` (como `celulaParaTexto` do `exceljs-csv-spreadsheet-reader`), nunca avaliar; ao exportar CSV, prefixar `'` em células começando com `= + - @`.
- Arquivo processado em pasta temp (`mkdtemp`, 0o700, apagada no `finally`), **nunca** em `/uploads` (público).
- A12: import vai para staging (hash SHA-256 do arquivo) e só substitui o dado público após validar esquema e valores. Recomendado: dado público importado só pelo Super Usuário; admin do tenant importa apenas na própria camada (`tenantId`), se o Villar permitir.

**A7 — Custo**
- Cache de geocodificação por endereço normalizado (compartilhado, sem `tenantId`, só lat/lng — sem dado pessoal), TTL 180 dias.
- Contador diário por tenant (`BiiUsoDiario`, imitando `ViviUsoDiario`): limites de geocoding, pareceres IA e coletas; passou → 429 com mensagem clara.
- Throttle por usuário nas rotas caras (padrão `PdfToolsBatchThrottlerGuard`, ex. 6/min) além do global 100/min por IP; parecer IA com `max_tokens` fixo e cache por hash dos números de entrada.

**A8 — Prompt injection**
- Parecer recebe **apenas números calculados e rótulos de enum** (preços, m², medianas, faixas). Texto livre de concorrente nunca entra no prompt; se for indispensável, truncar (200 caracteres), envolver em delimitador com instrução "dado, não instrução" e remover caracteres de controle/bidi (padrão do extract-text).
- IA sem tools nesse fluxo (sem web_search, sem ação); saída tratada como texto puro (React escapa; nada de `dangerouslySetInnerHTML`), com aviso "texto gerado por IA, confira os números".

**A9 — Chaves**
- Chaves só no `.env` do backend, validadas por existência/tamanho, nunca impressas (regra do CLAUDE.md). Nenhuma `NEXT_PUBLIC_*` com chave.
- Logs só com tenant/usuário/rota/tempo/custo, nunca chave, URL com `key=` ou corpo de resposta; erro do provedor vira mensagem genérica (padrão pdf_tools).
- Chave Google restrita ao IP da VPS e à Geocoding API, com teto de cobrança.

**A10 — Scraping**
- Apify só após parecer jurídico sobre termos de ZAP/VivaReal (fase posterior); feature flag desligada por padrão.
- Mapeador de saída com **lista branca de campos** (empreendimento, endereço, bairro, tipologia, área, preço, data, fonte); qualquer outro campo descartado antes de gravar.

## 3. LGPD

| Dado | Pessoal? | Tratamento no BII |
|---|---|---|
| Nome do corretor no ranking/VGV | Sim (titular: colaborador) | Base: legítimo interesse/execução do contrato de trabalho/parceria (art. 7º, V e IX). Só Administrador do próprio tenant. Exibir nome + métricas; sem telefone/e-mail/CPF. |
| Renda, região, perfil da VIVI | Sim (lead) | **Nunca exibir renda individual.** Só agregados com k ≥ 5 por recorte (abaixo disso, "dados insuficientes"); distribuição por faixa HIS/MCMV, não valor. |
| Endereço consultado | Normalmente não (imóvel/terreno) | Guardar só o necessário para refazer a consulta. |
| ITBI público | Pode conter SQL/número de contribuinte | Na importação, descartar nome/documento de comprador/vendedor se existirem; manter SQL do lote, valor, data, área, endereço. |
| Anúncios (Apify) | Nome/telefone/CRECI/foto de corretor | **Nunca guardar**, nem em log ou JSON bruto. |
| `BiiConsultaLog` | Sim (usuário que consultou) | Campos: tenantId, userId, impersonadoPor, ação, parâmetros resumidos, custo, data. **Retenção: 12 meses**, depois exclusão automática (job) — suficiente para auditoria e custo. |

Minimização: agregação no banco, respostas sem IDs de lead, exportação só de agregados. Parecer de IA sem nomes de pessoas; a Anthropic recebe só números (registrar no aviso de privacidade).

## 4. Plano de testes (QA)

Jest (`src/**/*.spec.ts`, `test/factories/`) + Playwright (script descartável, padrão do projeto).

### 4.1 Unitários (funções puras em `domain/services/`)
- **Haversine:** mesma coordenada = 0; Praça da Sé → Av. Paulista ≈ 2,3 km (±1%); antípodas; lat/lng inválidas lançam erro; raio de busca inclusivo no limite.
- **Mediana/percentis:** lista vazia (null), 1 elemento, par/ímpar, valores repetidos, não ordenados, P25/P75 com interpolação documentada, outliers não alteram a mediana.
- **Classificação HIS/HMP (renda, limite inclusivo):** 4.863,00 → HIS-1; 4.863,01 → HIS-2; 9.726,00 → HIS-2; 9.726,01 → HMP; 16.210,00 → HMP; 16.210,01 → fora; 0 e negativo → erro.
- **Teto de venda:** 276.102,20 → cabe HIS-1; 276.102,21 → não cabe HIS-1 (cabe HIS-2); 383.636,74/383.636,75; 537.672,71/537.672,72 → fora de HMP.
- **MCMV:** F3 até 9.600,00; 9.600,01 → F4; 13.000,00 → F4; 13.000,01 → fora; F4 com unidade de 600.000,00 → cabe, 600.000,01 → não; caso "cabe F4 e passa do teto HMP" (ex. 550 mil) → MCMV F4 sim, HMP não.
- **Vigência:** parâmetro escolhido pela data de referência (antes/depois de 06/01/2026 e 22/04/2026); centavos em inteiro/Decimal (sem float).
- **Viabilidade:** VGV, margem, TIR/VPL contra casos de planilha; divisão por zero.
- **Sanitização do prompt** e **mapeador branco de anúncios** (campos proibidos somem).
- **Inspeção de ZIP do XLSX:** bomba, razão alta, macro, arquivo não-ZIP.

### 4.2 Isolamento de tenant (cada repositório do BII)
Para cada repositório Prisma: com 2 tenants semeados, `list/find/aggregate/raw` do tenant A nunca devolve linha de B; `update/delete` com id de B a partir de A → `count 0`/404 sem alterar B. Repositórios de dado público: confirmar que não há método de escrita exposto ao use case do tenant. Teste estático: grep falha se `$queryRawUnsafe` aparecer em `src/modules/bii/`.

### 4.3 Meta-teste de rotas
`src/modules/bii/infra/http/permissoes-bii.http.spec.ts`, no molde de `permissoes-imoveis.http.spec.ts`: percorre o metadata de TODOS os controllers do módulo e falha se alguma rota não tiver `@Roles` = exatamente `['Administrador']`. Teste HTTP por tabela com `RolesGuard` real e `FakeAuthGuard` (perfis admin, corretor, gerente, parceiro, cliente): só admin → 2xx, demais → 403. Perfil "admin impersonado": GET 200, rotas de custo/escrita 403.

### 4.4 Throttle e concorrência
- 7ª chamada/min do mesmo usuário em parecer/geocoding → 429 (mensagem PT do `AppThrottlerGuard`); outro usuário não é afetado.
- Limite diário do `BiiUsoDiario` → 429; virada de dia zera.
- 2 uploads ITBI simultâneos → o 2º recebe 503 "Servidor ocupado" (`LimiteConcorrenciaGuard`).

### 4.5 E2E Playwright (fluxo principal)
Tenant + admin + corretor → corretor sem item "BII" e com 403 nos dados → admin: painel de vendas (conferido no banco) → endereço (geocoding mockado) → transações ITBI no raio → concorrente → viabilidade → parecer IA (stub) → `BiiConsultaLog` conferido. Limpeza por cascata do tenant.

### 4.6 Critérios de aceite por fatia
- **Painéis de vendas:** números iguais a contagem direta no banco; corretor 403; sem renda individual.
- **Endereço/geo:** cache funcionando (2ª consulta não chama provedor); hosts fora da allowlist bloqueados.
- **ITBI:** import idempotente por hash; bomba/macro/tamanho recusados; arquivo temp removido.
- **Concorrentes:** isolamento por tenant; campos de corretor nunca persistidos.
- **Viabilidade + HIS/MCMV:** todos os casos de borda da 4.1 verdes.
- **Parecer IA:** prompt só com números (snapshot do prompt no teste); limite de custo aplicado.
- Todas: meta-teste verde, `npm run build` limpo, `npx jest src/modules/bii` verde.

**Meta de cobertura:** `domain/` ≥ 95% de linhas e 100% dos ramos de classificação HIS/MCMV; `application/` ≥ 85%; módulo BII ≥ 80% (`--coverage --collectCoverageFrom='src/modules/bii/**'`).

## 5. Checklist de segurança antes de cada merge
- [ ] Toda rota nova em controller com `@Roles('Administrador')`; meta-teste atualizado e verde.
- [ ] Toda query/escrita com `tenantId` vindo de `req.user`; escrita com `{ id, tenantId }`.
- [ ] Zero `$queryRawUnsafe`/`Prisma.raw`; ordenação/período por enum.
- [ ] Nenhuma URL vinda do usuário é buscada pelo servidor; hosts na allowlist.
- [ ] Upload: tamanho, magic bytes, anti zip bomb, streaming, temp fora de `/uploads`.
- [ ] Rotas caras com throttle por usuário + contador diário; bloqueadas em impersonação.
- [ ] Prompt da IA sem texto livre de terceiros; saída renderizada como texto.
- [ ] Logs sem chave, endereço completo, nome de lead ou renda; nenhum `.env` impresso.
- [ ] Nenhum campo de corretor de anúncio persistido; renda só agregada (k ≥ 5).
- [ ] `BiiConsultaLog` gravado com `impersonadoPor`.
- [ ] Dependência nova aprovada pelo Villar (regra 4 do CLAUDE.md), sem upgrade major.
- [ ] `npx jest src/modules/bii` e `npm run build` verdes (dev parado antes do build).
