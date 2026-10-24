# BII Fatia 6 — Localização do ITBI pelo SQL do IPTU (GeoSampa)

Status: PROPOSTA (aguardando aprovação do Villar). Data: 24/10/2026.

## Objetivo
Dar coordenadas a TODAS as ~937 mil guias do ITBI da capital sem geocodificar
endereço (Nominatim: 1 req/s, inviável para a cidade inteira), cruzando o SQL
do IPTU de cada guia (`itbi_transacoes.sql_cadastro`, 11 dígitos = setor 3 +
quadra 3 + lote 4 + dígito 1) com as camadas públicas do GeoSampa.

## Fonte (conferida na VPS em 24/10/2026)
WFS 2.0.0 `https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs`,
JSON, paginação `count`/`startIndex` (máx. 30.000 por pedido).
- `geoportal:quadra_fiscal` — 64.229 polígonos. Campos: `cd_setor_fiscal` (3),
  `cd_quadra_fiscal` (3), `cd_subquadra_fiscal`, `cd_tipo_quadra` (F/QP/R/E),
  `cd_situacao_quadra`, `qt_area_quadra_fiscal`, `dt_carga`.
- `geoportal:lote_cidadao` — 1.687.982 polígonos. Campos usados:
  `cd_setor_fiscal`, `cd_quadra_fiscal`, `cd_lote` (4), `cd_condominio` (2;
  "00" = não é condomínio), `cd_tipo_lote`, `tx_situ_lote` (ATIVO/CANCELADO).
  NÃO guardar: logradouro, número, áreas, uso (minimização; o ITBI já tem).
- Licença: CC BY-SA 4.0 (página oficial "Licença para uso de dados do
  GeoSampa"): uso livre com atribuição; obra derivada republicada sob a mesma
  licença. Atribuição obrigatória na tela e no PDF: "Localização: GeoSampa —
  Prefeitura de São Paulo (CC BY-SA 4.0)". Revisão jurídica junto com a de LGPD.

## Limitação conhecida: apartamentos
Unidade de condomínio tem SQL próprio (lote = nº da unidade) que NÃO casa com
o lote do mapa (o lote do condomínio é "0000" + `cd_condominio`; a ligação
unidade→condomínio está só na base do IPTU, fora desta fatia). Por isso:
lote exato só quando casar (casas, terrenos, comerciais); senão, quadra
(setor+quadra = 6 primeiros dígitos, casa ~100% das guias). Precisão da quadra
~50-150 m: suficiente para anéis de 1/3/5 km.

## Dados (migration só CREATE TABLE, globais como o ITBI, sem tenantId)
- `geo_quadras_fiscais`: setor char(3), quadra char(3), PK (setor, quadra);
  lat, lng (centroide ponderado por área das subquadras, WGS84), area_m2,
  carga_em (dt_carga da fonte), atualizado_em.
- `geo_lotes_fiscais`: setor, quadra, lote char(4), condominio char(2), PK
  (setor, quadra, lote, condominio); lat, lng (centroide), ativo bool,
  atualizado_em. Só tipo F. ~1,7 mi linhas × ~60 B ≈ 150-250 MB com índice.
- `itbi_transacoes.geo_precisao` ganha os valores `lote` e `quadra`.

## Jobs (Super Usuário, tela "Dados do BII", um por vez, progresso como a geocodificação)
1. **Atualizar base do GeoSampa**: pagina as 2 camadas com
   `srsName=EPSG:4326` e `propertyName` só com os campos acima + geometria;
   calcula o centroide (polígono/multipolígono, fórmula de área assinada) em
   JS; grava em lotes de 1.000 (INSERT ... ON CONFLICT DO UPDATE, unnest
   parametrizado como o ITBI). Host fixo (nunca da requisição), só https,
   timeout 60 s por página, resposta ≤ 60 MB, 3 tentativas com espera,
   1 pedido por vez. Estimado: ~60 páginas, 15-30 min. Rodar de novo é seguro.
2. **Localizar ITBI pelo SQL**: para cada guia com `sql_cadastro` válido (11
   dígitos): lote exato (setor+quadra+lote, condominio "00", ativo) → `lote`;
   senão quadra → `quadra`. Ordem de confiança: lote > rooftop > quadra > rua >
   cep > bairro — só sobrescreve coordenada de precisão PIOR. Em lote de
   10.000 guias, UPDATE ... FROM parametrizado. Estimado: poucos minutos.
   Importação nova do ITBI chama este passo ao terminar (só nas guias dela).
- Rotas novas em `BiiPlataformaController` (classe Super Usuário, meta-teste
  cobre): POST `itbi/geosampa/atualizar` (202), POST `itbi/localizar-sql` (202),
  GET `itbi/geosampa` (progresso + contagens + data da carga). Throttle 6/hora.

## Tela e análise
- "Dados do BII": card "Base do GeoSampa" (data da carga, quadras, lotes,
  botões dos 2 jobs) e cobertura "X% das guias com localização (lote/quadra/
  endereço)".
- Análise por Endereço e Estudo: selo de precisão "quadra"/"lote" e a
  atribuição do GeoSampa na fonte. Nenhuma outra regra muda.

## Fora desta fatia
Ligação unidade→condomínio pela base do IPTU (refinar apartamentos para o
lote); PostGIS; raio de 5 km e o novo dashboard (Fatia 7).

## Testes
Centroide (quadrado, L, multipolígono, buraco), montagem da URL (host fixo,
paginação, srsName), parser tolerante a campo ausente, prioridade de precisão,
casamento lote/quadra, job com WFS fake (páginas, falha e retomada),
integração no Postgres (upsert, UPDATE só melhora precisão), meta-teste de
permissões, E2E da tela.
