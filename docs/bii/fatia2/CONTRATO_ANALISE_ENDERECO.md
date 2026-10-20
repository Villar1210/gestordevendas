# BII — Fatia 2: Análise por Endereço (mapa + ITBI no raio)

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
- `POST /bii/analises/endereco` — body `{ endereco: string (5–200), raioMetros: 500|1000|2000 (padrão 1000), meses: 6|12|24|36 (padrão 12), areaMin?: number, areaMax?: number }`. Geocodifica (cache → Nominatim), busca ITBI no raio (bounding box no SQL + haversine no domínio), calcula estatísticas, grava `BiiAnalise`, devolve `AnaliseEnderecoResponse`. Endereço não encontrado → 422 "Não encontramos esse endereço. Inclua número, bairro e cidade.". Throttle 10/min + LimiteConcorrencia 2.
- `GET /bii/analises` — últimas 50 do tenant (id, endereço, raio, meses, criadoEm, n transações, mediana).
- `GET /bii/analises/:id` — a análise salva (404 se de outro tenant).
- `GET /bii/itbi/cobertura` — `{ anos: number[], totalTransacoes, geocodificadas, ultimaImportacao: string|null }` (para a tela avisar quando não há dado).

### Super Usuário (`@Controller('bii-plataforma')`, `@Roles(SUPER_USUARIO_ROLE_NAME)`)
- `POST /bii-plataforma/itbi/importar` — multipart `file` (.xlsx, máx. 120 MB, assinatura ZIP `PK\x03\x04`), campo `ano`. Processa em segundo plano (responde 202 com `importacaoId`), leitura em streaming (exceljs `WorkbookReader`), fórmulas nunca avaliadas, deduplica por `hashLinha`, insere em lotes. Throttle 2/hora. Uma importação por vez (409 se houver outra `processando`).
- `GET /bii-plataforma/itbi/importacoes` — histórico.
- `POST /bii-plataforma/itbi/geocodificar` — body `{ ceps?: string[] (prefixos de 5 dígitos, ex. "03277"), bairros?: string[], max?: number (≤ 5000, padrão 2000) }`. Job em segundo plano que geocodifica endereços únicos ainda sem ponto, respeitando 1 req/s no Nominatim. 202 com contagem enfileirada. Uma por vez.
- `GET /bii-plataforma/itbi/geocodificacao` — progresso do job atual/último.

## Resposta da análise

```ts
interface AnaliseEnderecoResponse {
  id: string;
  endereco: { digitado: string; formatado: string; lat: number; lng: number; precisao: 'rooftop' | 'rua' | 'cep' | 'bairro' };
  parametros: { raioMetros: number; meses: number; areaMin: number | null; areaMax: number | null; de: string; ate: string };
  cobertura: { transacoesNoPeriodoNaRegiao: number; semLocalizacao: number }; // semLocalizacao = ITBI da região ainda não geocodificado (aviso)
  resumo: {
    transacoes: number;
    precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null;
    valorMediano: number | null; areaMediana: number | null;
  };
  porMes: { mes: string /* YYYY-MM */; transacoes: number; precoM2Mediano: number | null }[];
  amostra: { data: string; logradouro: string; numero: string | null; bairro: string | null; areaConstruida: number | null; valor: number; precoM2: number | null; distanciaMetros: number; lat: number; lng: number }[]; // até 200, mais próximas primeiro
  fonte: { nome: 'ITBI — Prefeitura de São Paulo'; atualizadoAte: string | null };
  criadoEm: string;
}
```
- preço/m² = valor da transação ÷ área construída; descarta área nula/zero e outliers absurdos (< R$ 500/m² ou > R$ 60.000/m²) do cálculo de mediana/percentis (continua contando em `transacoes`).
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
