# BII — Fatia 2: Análise por Endereço (mapa + ITBI no raio)

> Atualizado em 20/10/2026 depois da planilha real (`docs/bii/fatia2/ITBI_COLUNAS.md`): requisição ganhou `tipo` e `somenteCompraVenda`; resposta ganhou `parametros.tipo/somenteCompraVenda`, `planta`, `financiamento` e `fonte.observacao`. Formatos de `GET /bii/analises`, importações e progresso da geocodificação fixados (eram só descritos).

Aprovado pelo Villar em 20/10/2026 ("sim quero"). Decisões já tomadas na Fase 1: geocodificação pelo OpenStreetMap/Nominatim (sem chave Google), importação do ITBI só pelo Super Usuário, mapa com leaflet + react-leaflet (dependências aprovadas).

Escopo desta fatia (2a): endereço → ponto no mapa → transações reais do ITBI no raio, com estatística de preço/m². O perfil demográfico do IBGE fica para a Fatia 2b (precisa importar a malha de setores censitários; volume e formato próprios).

## Dados globais (não são de tenant — dado público)

- `ItbiTransacao`: uma linha por guia de ITBI paga (planilha anual da Prefeitura de SP, aba(s) mensais). Colunas: confirmadas lendo o arquivo real (ver `docs/bii/fatia2/ITBI_COLUNAS.md`, preenchido quando o arquivo chegar). Chave de deduplicação `hashLinha` (sha256 dos campos normalizados) `@unique`. Campo `enderecoChave` (logradouro normalizado + número + CEP) para ligar ao cache de geocodificação. `lat`/`lng` nulos até geocodificar.
- `GeocodeCache`: `chave` (endereço normalizado) `@unique`, `provedor`, `lat`, `lng` (nulos = não achou — evita repetir), `precisao`, `enderecoFormatado`, `criadoEm`.
- `ItbiImportacao`: registro de cada importação (arquivo original não é guardado; nome sanitizado, ano, status `processando|concluida|erro`, linhas lidas/inseridas/duplicadas/descartadas, mensagem de erro sem dado sensível, `importadoPorUserId`, datas).
- Sem `tenantId` nessas três de propósito (dado público, leitura por todos os tenants, escrita só por job/Super Usuário). Nenhuma FK para tabela de tenant.

## Dados por tenant
- `BiiAnalise`: `tenantId`, `createdById`, endereço digitado, endereço normalizado/formatado, `lat`/`lng`, `raioMetros`, `meses`, filtros (`areaMin`, `areaMax`), `resultado` (Json — snapshot do resumo calculado), `createdAt`. Lista/abre sempre por `{ id, tenantId }`.

## Endpoints

### Administrador do tenant (`@Controller('bii')`, mesma classe de guards da Fatia 1 ou controller novo com os mesmos guards)
- `POST /bii/analises/endereco` — body `{ endereco: string (5–200), raioMetros: 500|1000|2000 (padrão 1000), meses: 6|12|24|36 (padrão 12), areaMin?: number, areaMax?: number, tipo?: 'residencial' | 'apartamento' | 'casa' | 'todos' (padrão 'residencial'), somenteCompraVenda?: boolean (padrão true) }`. Geocodifica (cache → Nominatim), busca ITBI no raio (bounding box no SQL + haversine no domínio), calcula estatísticas, grava `BiiAnalise`, devolve `AnaliseEnderecoResponse` (HTTP 201). Endereço não encontrado (ou fora da Grande SP) → 422 "Não encontramos esse endereço. Inclua número, bairro e cidade.". Geocodificador fora do ar → 503 "O serviço de mapas está indisponível agora. Tente em instantes.". Campos inválidos → 400. Throttle 10/min + LimiteConcorrencia 2 (503 "Servidor ocupado. Tente em instantes.").
  - `tipo` (usos do IPTU): `residencial` = 10, 12, 14, 20, 21, 22, 25; `apartamento` = 20, 21, 22, 25; `casa` = 10, 12, 14; `todos` = qualquer uso na contagem (o R$/m² continua só com os usos residenciais).
  - `somenteCompraVenda: true` = só natureza 1 ("Compra e venda"); `false` = todas as naturezas.
  - Período: os últimos `meses` meses de calendário terminando no **último dia com dado do ITBI** (ou hoje, se o ITBI já passa de hoje ou não há dado). A Prefeitura publica com atraso; sem isso "últimos 12 meses" ficaria vazio no fim. `parametros.de/ate` trazem o período usado.
- `GET /bii/analises` — últimas 50 do tenant: `{ id, endereco (digitado), enderecoFormatado, raioMetros, meses, transacoes, precoM2Mediano: number | null, criadoEm }[]`.
- `GET /bii/analises/:id` — a análise salva, no mesmo formato `AnaliseEnderecoResponse` (snapshot do momento; 404 se de outro tenant; 400 se o id não for UUID).
- `GET /bii/itbi/cobertura` — `{ anos: number[], totalTransacoes, geocodificadas, ultimaImportacao: string|null }` (para a tela avisar quando não há dado).

### Super Usuário (`@Controller('bii-plataforma')`, `@Roles(SUPER_USUARIO_ROLE_NAME)`)
- `POST /bii-plataforma/itbi/importar` — multipart `file` (.xlsx, máx. 120 MB, assinatura ZIP `PK\x03\x04`), campo `ano`. Processa em segundo plano (responde 202 com `{ importacaoId }`), leitura em streaming (exceljs `WorkbookReader`), fórmulas nunca avaliadas, deduplica por `hashLinha`, insere em lotes. Throttle 2/hora. Uma importação por vez (409 se houver outra `processando`; 503 se outro upload estiver chegando). Sem Content-Length → 411; acima de 120 MB → 413; não é .xlsx/ZIP, macro, ZIP suspeito ou `ano` inválido → 400.
- `GET /bii-plataforma/itbi/importacoes` — histórico (50 mais recentes): `{ id, nomeArquivo, ano, status, linhasLidas, linhasInseridas, linhasDuplicadas, linhasDescartadas, abas: { nome, status: 'importada'|'ignorada', motivo?, linhas }[], mensagemErro, iniciadoEm, concluidoEm }[]`.
- `POST /bii-plataforma/itbi/geocodificar` — body `{ ceps?: string[] (prefixos de 5 dígitos, ex. "03277"), bairros?: string[], max?: number (≤ 5000, padrão 2000) }`. Job em segundo plano que geocodifica endereços únicos ainda sem ponto, respeitando 1 req/s no Nominatim. 202 com o progresso inicial (`enfileirados` = endereços únicos na fila). Uma por vez (409).
- `GET /bii-plataforma/itbi/geocodificacao` — `{ atual: Progresso | null }` (job atual ou o último deste processo; some ao reiniciar o servidor). `Progresso = { id, status: 'processando'|'concluida'|'erro'|'cancelada', filtros: { ceps, bairros, max }, enfileirados, processados, encontrados, naoEncontrados, doCache, consultasProvedor, falhas, transacoesAtualizadas, iniciadoEm, concluidoEm, mensagemErro }`.

## Resposta da análise

```ts
interface AnaliseEnderecoResponse {
  id: string;
  endereco: { digitado: string; formatado: string; lat: number; lng: number; precisao: 'rooftop' | 'rua' | 'cep' | 'bairro' };
  parametros: { raioMetros: number; meses: number; areaMin: number | null; areaMax: number | null; tipo: 'residencial' | 'apartamento' | 'casa' | 'todos'; somenteCompraVenda: boolean; de: string; ate: string };
  cobertura: { transacoesNoPeriodoNaRegiao: number; semLocalizacao: number }; // semLocalizacao = ITBI da região ainda não geocodificado (aviso)
  resumo: {
    transacoes: number;
    precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null;
    valorMediano: number | null; areaMediana: number | null;
  };
  porMes: { mes: string /* YYYY-MM */; transacoes: number; precoM2Mediano: number | null }[];
  amostra: { data: string; logradouro: string; numero: string | null; bairro: string | null; areaConstruida: number | null; valor: number; precoM2: number | null; distanciaMetros: number; lat: number; lng: number }[]; // até 200, mais próximas primeiro (só a contagem principal; sem as da planta)
  planta: { transacoes: number; valorMediano: number | null; comMcmv: number }; // linhas do raio com Uso 0 e área 0 (unidades na planta, SQL ainda do terreno), sem R$/m²
  financiamento: { mcmv: number; sfh: number; outros: number; semFinanciamento: number }; // sobre as transações do raio (principal + planta)
  fonte: { nome: 'ITBI — Prefeitura de São Paulo'; atualizadoAte: string | null; observacao: 'Área construída do IPTU inclui a parte das áreas comuns; o R$/m² fica abaixo do de área privativa.' };
  criadoEm: string;
}
```
- `resumo.transacoes` = linhas do raio/período/natureza, fora as da planta, com uso do `tipo` e dentro de `areaMin/areaMax` (quando informados). `valorMediano`/`areaMediana` sobre esse grupo.
- preço/m² = valor da transação ÷ área construída, **só** para usos residenciais do `tipo` com área > 0; descarta outliers absurdos (< R$ 500/m² ou > R$ 60.000/m²) do cálculo de mediana/percentis (continua contando em `transacoes`). Percentis com interpolação linear (igual ao `percentile_cont`).
- `planta` = linhas do raio com Uso 0 e área construída 0/nula (no ITBI de 2022–2026 são ~17% das linhas, muitas MCMV). Nunca entram no R$/m².
- `financiamento`: código 2 = MCMV, 1 = SFH, qualquer outro código (3 consórcio, 99 SFI etc.) = outros, vazio = sem financiamento.
- `cobertura.transacoesNoPeriodoNaRegiao` = linhas do raio (antes de tipo/área) + `semLocalizacao`; `semLocalizacao` = ITBI do período (mesma natureza) com o mesmo prefixo de CEP (5 dígitos) do endereço e ainda sem lat/lng. Só é contado quando o geocodificador devolve CEP; sem CEP fica 0 (nunca inventado).
- Só transações com `lat/lng` entram no raio. Sem nenhuma → resumo com nulls e aviso de cobertura.
- Nada de dado pessoal: a planilha pública não traz nome de comprador/vendedor; se trouxer qualquer coluna pessoal, ela NÃO é importada.

## Geocodificação (Nominatim)
- `IGeocodingProvider` no domínio; `NominatimGeocodingProvider` (infra) com User-Agent próprio `gestordevendas-bii/1.0 (contato: env BII_CONTATO_EMAIL)`, `countrycodes=br`, viewbox da cidade de SP, 1 requisição/s global por processo, timeout 10 s; host fixo (sem URL vinda do usuário — anti-SSRF). URL base em env opcional `NOMINATIM_URL` (padrão `https://nominatim.openstreetmap.org`).
- `GeocodingComCache` decora o provedor: sempre consulta/grava `GeocodeCache` (inclusive "não achou").
- Variáveis novas (opcionais): `NOMINATIM_URL`, `BII_CONTATO_EMAIL`.

## Frontend
- Aba "Análise por Endereço" ativada (sem "em breve"). Formulário (endereço, raio, período, área mín./máx.), botão "Analisar".
- Mapa: `leaflet` + `react-leaflet` via `next/dynamic` `ssr:false`, tiles OSM `https://tile.openstreetmap.org/{z}/{x}/{y}.png` com atribuição "© OpenStreetMap contributors" visível; URL dos tiles em `NEXT_PUBLIC_MAP_TILE_URL` (padrão OSM). Pino do endereço, círculo do raio, pontos das transações (cor por faixa de preço/m²), sem ícones de imagem padrão do leaflet (usar `divIcon`/`CircleMarker`).
- Cards: transações, preço/m² mediano, faixa p25–p75, valor mediano, área mediana; gráfico por mês (recharts); tabela da amostra (ordenável); selos de fonte "ITBI/Prefeitura" e data de atualização; aviso de cobertura quando `semLocalizacao > 0` ou `transacoes = 0`.
- Aba "Histórico" ativada: lista `GET /bii/analises`, abre uma análise salva.
- Na tela `/super-usuario`: card "Dados públicos do BII — ITBI" com upload da planilha, histórico de importações, e formulário de geocodificação por prefixo de CEP/bairro com progresso.
