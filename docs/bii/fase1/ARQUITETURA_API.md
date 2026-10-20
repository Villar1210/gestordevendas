# BII — Fase 1: arquitetura da API (backend)

Autor: Dev Backend + Engenheiro Python. Data: 19/10/2026. Só desenho, nenhum código foi alterado.
Base: `docs/bii/FASE0_LEVANTAMENTO.md`, `CLAUDE.md`, o molde `src/modules/plantao/` e o módulo `vendas_kanban`.

## 1. Pastas de `src/modules/bii/`

```
bii/
  bii.module.ts
  domain/
    entities/            analise-endereco.ts, transacao-itbi.ts, concorrente.ts,
                         parametro-his.ts, parametro-mcmv.ts, card-stage-evento.ts
    ports/               geocoding-provider.interface.ts, itbi-repository.interface.ts,
                         concorrente-source.interface.ts, indice-provider.interface.ts,
                         parecer-ia.interface.ts, geocode-cache.interface.ts
    repositories/        stage-history-repository.interface.ts, painel-vendas-repository.interface.ts,
                         parametros-repository.interface.ts, consulta-log-repository.interface.ts
    services/            (funções puras) estatistica.ts, haversine.ts, classificacao-his-mcmv.ts,
                         ciclo-venda.ts, funil.ts, normalizar-endereco.ts, dedup-itbi.ts
  application/
    use-cases/           (ver seção 3)
    services/            importador-itbi.service.ts (orquestra parse → dedup → grava → geocodifica)
  infra/
    http/                bii-painel.controller.ts, bii-mercado.controller.ts,
                         bii-viabilidade.controller.ts, bii-admin.controller.ts, dtos/
    database/            prisma-*.repository.ts (um por interface)
    providers/           google-geocoding.provider.ts, nominatim-geocoding.provider.ts,
                         geocoding-com-cache.provider.ts (decorator), bcb-incc.provider.ts,
                         manual-concorrente.source.ts, (futuro) apify-concorrente.source.ts,
                         anthropic-parecer.service.ts, itbi-planilha.reader.ts (exceljs)
    listeners/           card-stage-changed.listener.ts
    scheduler/           itbi-import.scheduler.ts, incc-sync.scheduler.ts, geocode-lote.scheduler.ts
```

Regras: `domain/` não importa Prisma, Nest nem libs. O BII **lê** tabelas do kanban (Card, Stage, User, Stand) só por repositórios próprios dentro de `bii/infra/database` (mesmo padrão do RH sobre User/Role), sem importar arquivos do `vendas_kanban`. Tabelas novas do BII levam prefixo `Bii` e `tenantId`, exceto as de dado público (ITBI, cache de geocodificação, índices, parâmetros legais), que são globais e somente leitura para o tenant.

## 2. Portas de domínio

```ts
export interface GeoPonto { lat: number; lng: number }
export interface GeocodeResultado extends GeoPonto {
  enderecoFormatado: string; precisao: 'rooftop' | 'rua' | 'cep' | 'bairro';
  fonte: 'google' | 'nominatim' | 'cache';
}
export interface IGeocodingProvider {
  geocodificar(endereco: string, opts?: { cep?: string; cidade?: string }): Promise<GeocodeResultado | null>;
  readonly limitePorSegundo: number; // Nominatim 1, Google ~50
}
export interface IGeocodeCache {
  buscar(chaveNormalizada: string): Promise<GeocodeResultado | null>;
  gravar(chaveNormalizada: string, r: GeocodeResultado | null): Promise<void>; // null = "não achou" (evita repetir)
}
// GeocodingComCacheProvider implementa IGeocodingProvider: cache → Google (se GOOGLE_GEOCODING_KEY e cota do mês) → Nominatim.

export interface TransacaoItbi {
  id: string; sql: string | null; logradouro: string; numero: string | null; cep: string | null;
  bairro: string | null; dataTransacao: Date; valorTransacao: number; valorVenal: number | null;
  areaConstruida: number | null; areaTerreno: number | null; tipoUso: string | null;
  padrao: string | null; anoConstrucao: number | null; naturezaTransacao: string; ponto: GeoPonto | null;
}
export interface FiltroItbi {
  centro: GeoPonto; raioMetros: number; desde: Date; ate?: Date;
  tiposUso?: string[]; areaMin?: number; areaMax?: number; limite?: number;
}
export interface IItbiRepository {
  upsertLote(linhas: Omit<TransacaoItbi, 'id' | 'ponto'>[], hashLinha: string[]): Promise<{ inseridas: number; ignoradas: number }>;
  buscarNoRaio(f: FiltroItbi): Promise<TransacaoItbi[]>; // bounding box no SQL + haversine no domínio
  listarEnderecosSemPonto(limite: number, bbox?: { sul: number; oeste: number; norte: number; leste: number } | { ceps: string[] }): Promise<{ chave: string; logradouro: string; numero: string | null; cep: string | null }[]>;
  gravarPonto(chaveEndereco: string, ponto: GeoPonto | null): Promise<number>;
}

export interface Concorrente {
  id: string; nome: string; incorporadora: string | null; endereco: string; ponto: GeoPonto | null;
  precoMin: number | null; precoMax: number | null; areaMin: number | null; areaMax: number | null;
  totalUnidades: number | null; estagio: 'lancamento' | 'obras' | 'pronto' | null;
  enquadramento: string | null; fonte: 'manual' | 'apify'; coletadoEm: Date; urlOrigem: string | null;
}
export interface IConcorrenteSource {
  readonly fonte: 'manual' | 'apify';
  buscarProximos(tenantId: string, centro: GeoPonto, raioMetros: number): Promise<Concorrente[]>;
}
// Token 'IConcorrenteSource' ligado a ManualConcorrenteSource; Apify entra depois como outra classe (ou composta).

export interface PontoIndice { referencia: Date; valor: number } // valor % no mês
export interface IIndiceProvider {
  readonly codigo: 'INCC' ; // série SGS 192
  buscarSerie(de: Date, ate: Date): Promise<PontoIndice[]>;
}
export function acumular(pontos: PontoIndice[]): number; // domínio: produto (1 + v/100) - 1

export interface DadosParecer {
  tipo: 'endereco' | 'viabilidade' | 'painel';
  numeros: Record<string, number | string | null>; // só valores já calculados
  contexto: string[]; // fatos textuais curtos, ex.: "raio 1.000 m", "fonte ITBI jan-set/2026"
}
export interface IParecerIaService {
  redigir(tenantId: string, dados: DadosParecer): Promise<{ texto: string; tokensEntrada: number; tokensSaida: number }>;
}
```

`AnthropicParecerService` usa o SDK já instalado, com prompt fixo ("use apenas os números fornecidos; se faltar dado, diga que falta"), sem tool de web_search, e um validador no use case que extrai todo número do texto e rejeita o parecer se aparecer valor que não está em `numeros` (tolerância de arredondamento). Custo gravado em `BiiUsoIa` (mesmo modelo de `ViviUsoDiario`).

## 3. Use cases e endpoints

Todos os controllers: `@Controller('bii')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('Administrador')` na classe; todo use case recebe `requesterRole` e lança 403 se não for Administrador (como `CreateStandUseCase`); `tenantId` sempre de `req.user`. Meta-teste `bii-permissoes.http.spec.ts` percorre o metadata e falha se alguma rota não for só Administrador. Toda consulta cara grava `BiiConsultaLog` (tenant, usuário, ação, parâmetros sem dado pessoal, duração).

| Método e rota | Use case | Entrada | Resposta | Throttle |
|---|---|---|---|---|
| GET `/bii/painel/funil` | GetFunilUseCase | `de, ate, pipelineId?, corretorId?, standId?, origem?` | etapas com entradas, saídas, conversão, tempo médio | — |
| GET `/bii/painel/resumo` | GetResumoVendasUseCase | mesmos filtros | VGV ganho, nº ganhos/perdidos, ciclo médio/mediano, ticket médio | — |
| GET `/bii/painel/ranking` | GetRankingUseCase | filtros + `agrupar=corretor\|stand\|origem` | linhas com leads, ganhos, conversão, VGV, ciclo | — |
| GET `/bii/painel/motivos-perda` | GetMotivosPerdaUseCase | filtros | motivo → quantidade, % | — |
| POST `/bii/analises/endereco` | AnalisarEnderecoUseCase | `endereco, cep?, raioMetros (200–3000), meses (6–36), areaMin?, areaMax?` | ponto, ITBI (n, mediana R$/m², p25/p75, série mensal, amostra), concorrentes, perfil IBGE (se carregado) | 10/min |
| GET `/bii/analises` / `/bii/analises/:id` | List/GetAnaliseUseCase | paginação | análises salvas (snapshot) | — |
| GET/POST/PATCH/DELETE `/bii/concorrentes` | CRUD Concorrente (manual) | nome, endereço, preços, áreas, unidades, estágio | concorrente (geocodificado no create) | POST 30/min |
| POST `/bii/viabilidade` | CalcularViabilidadeUseCase | `precoVenda, areaPrivativa, rendaAlvo?, custoObraM2?, dataBase?` | enquadramento HIS/HMP e MCMV (faixa, teto, folga), teto corrigido pelo INCC, avisos | 30/min |
| GET/POST `/bii/parametros/his` e `/bii/parametros/mcmv` | List/CreateParametroUseCase | categoria, renda máx., teto, `vigenteDesde`, fonte (texto/URL) | versões; nunca edita, só cria nova vigência | — |
| GET `/bii/indices/incc` | GetInccUseCase | `de, ate` | série e acumulado | — |
| POST `/bii/indices/incc/sincronizar` | SincronizarInccUseCase | — | meses inseridos | 2/min |
| POST `/bii/itbi/importar` | ImportarItbiUseCase (upload) | multipart `file` XLSX/ODS ≤ 60 MB, `ano` | id do job | 2/hora |
| GET `/bii/itbi/importacoes` | ListImportacoesUseCase | — | jobs: status, linhas lidas/inseridas/duplicadas, erros | — |
| POST `/bii/itbi/geocodificar` | GeocodificarLoteItbiUseCase | `ceps[]` ou bbox, `max (≤ 2000)` | job | 2/hora |
| POST `/bii/pareceres` | GerarParecerUseCase | `analiseId` ou `viabilidadeId` | texto + aviso "gerado por IA sobre os números acima" | 5/min, teto diário por tenant |

## 4. Histórico de etapa

### Onde o `stageId` muda hoje (vendas_kanban)
1. `MoveCardUseCase.execute` → `updateStageAndPosition` (drag no Kanban; também usado pelo `MoverCardViviUseCase` do vivi-integration, que chama este use case — fica coberto).
2. `ClaimCardUseCase.execute` → `assignOwnerAndStage` (assumir lead; Roleta automática passa por aqui).
3. `MoverLeadsInativosParaRepiqueUseCase` → `updateStageAndPosition` (job de inatividade).
4. `PromoverLeadMinimoUseCase.execute` → `moveToPipelineAndStage` (remarketing → funil de vendas).
5. Entrada inicial: `CreateCardUseCase` (nasce com stage) e `CreateQuickCardUseCase` (com ou sem stage; usado pela VIVI e pelo transfer-to-broker).

Nenhum outro módulo grava `stageId` direto (conferido: `follow-up` só atualiza `followUpsEnviados`).

### Opção A — evento (recomendada)
Nos 6 métodos acima, depois da escrita bem-sucedida, uma linha:
```ts
this.eventEmitter.emit('card.stage.changed', {
  tenantId, cardId, pipelineId, fromStageId, toStageId, // fromStageId null = entrada
  userId /* null em job/sistema */, origem: 'move'|'claim'|'job_repique'|'promocao'|'criacao',
  ocorridoEm: new Date(), motivoRepique?: string,
});
```
`emit` (não `emitAsync`): o kanban não espera nem falha por causa do BII. O nome e o payload ficam documentados como contrato, igual a `card.sem_dono.criado`. No BII, `CardStageChangedListener` grava `BiiCardStageEvento` (tenantId, cardId, from, to, userId, origem, ocorridoEm, nome da etapa copiado no momento — sobrevive a renomear/excluir etapa) em try/catch que só loga.

Ganho e perda no MVP: **ganho** = entrada em "Fechamento" (já é etapa protegida e terminal); **perda** = entrada em "Repique" com `motivoRepique` (motivos já padronizados em `motivo-repique.ts`). Assim nenhum campo novo no Card é necessário agora. Se o Villar quiser "Perdido" separado de "Repique", isso vira decisão própria (campos `perdidoEm/motivoPerda` no Card) numa fatia futura.

Ganho: impacto mínimo (6 linhas + injeção de `EventEmitter2`, que 2 desses use cases já têm), kanban continua sem conhecer o BII, módulo "cortável". Perda: evento em memória pode se perder se o processo cair entre o commit e o listener (raro; janela de milissegundos) e o histórico começa no dia da implantação (sem passado). Mitigação: backfill único criando um evento "criacao" por card com `createdAt` e a etapa atual (marcado `estimado=true`), e uma conferência noturna que compara `Card.stageId` com o último evento e registra divergência.

### Opção B — gravar dentro do kanban
O repositório de Card gravaria `CardStageHistory` na mesma transação da mudança.
Ganho: atômico, nunca perde evento. Perda: mexe nos 4 métodos do `PrismaCardRepository` e na interface, cria tabela do kanban que só o BII consome, acopla os dois e contraria "não alterar outro módulo além do mínimo".

**Recomendação: A**, com backfill e conferência noturna. Precisa de aprovação do Villar porque toca em 6 arquivos do `vendas_kanban` (decisão pendente nº 1 da Fase 0).

## 5. Importação do ITBI

**Node no próprio projeto, não Python.** O VPS já roda o Nest com PM2; `exceljs` já está instalado e lê XLSX em streaming (`WorkbookReader`), e `@nestjs/schedule` já existe. Python exigiria runtime, venv, segundo processo no PM2 e outro deploy só para ler planilha. Pandas seria mais confortável, mas não compensa. Ponto fraco: `exceljs` **não lê ODS**. Recomendação: aceitar XLSX (formato que a Prefeitura publica hoje) e, se vier ODS, converter com o LibreOffice que o E-doc já usa (`soffice --headless --convert-to xlsx`) — sem dependência nova.

Fluxo (`ImportadorItbiService`, rodando fora da requisição, em job registrado em `BiiImportacaoItbi`):
1. Entrada: upload pelo admin (caminho principal, porque o VPS pode não alcançar o site da Prefeitura) ou download agendado da URL configurada em `ITBI_URL_<ANO>`; falhou o download → job "aguardando upload" e aviso na tela.
2. Leitura em streaming, abas mensais, mapeamento de colunas por nome normalizado (cabeçalhos mudam entre anos); linhas inválidas vão para contagem de erro, nunca derrubam o job.
3. Idempotência: `hashLinha = sha256(SQL | data | valor | logradouro | número | complemento | natureza)` com `@@unique` → `createMany({ skipDuplicates: true })` em lotes de 1.000. Reimportar o arquivo do ano (que cresce todo mês) só insere o novo.
4. Geocodificação separada da importação: agrupa por chave `logradouro+número+CEP` normalizada (muitas transações no mesmo prédio = 1 consulta), olha o `GeocodeCache` primeiro e só geocodifica a região de interesse (CEPs informados, bbox dos empreendimentos do tenant ou do endereço analisado; ex.: Vila Ema, Vila Prudente, São Lucas). Nominatim: fila com 1 req/s e User-Agent próprio, até ~3.000/noite. Google: contador mensal em `BiiGeocodeCota`, para em 9.000 (margem sobre 10 mil). Endereço sem ponto preciso cai no centroide do CEP (precisão "cep").
5. Agendamento: `@Cron('0 4 5 * *')` (dia 5, 04h) tenta baixar; `@Cron('0 2 * * *')` processa a fila de geocodificação. Trava por arquivo (`.lock`, como o book) evita dois jobs simultâneos. Com mais de uma instância no PM2, o cron roda só onde `BII_JOBS=1`.

Tabela `BiiTransacaoItbi` é global (dado público), com índice em `(lat, lng)` e `dataTransacao`. Busca: bounding box no SQL e haversine no domínio. PostGIS não é necessário neste volume (centenas de milhares de linhas por ano).

## 6. Cálculos (funções puras)

Em `src/modules/bii/domain/services/`, sem import externo:
- `estatistica.ts`: `mediana(xs)`, `percentil(xs, p)` (interpolação linear, mesmo método do Excel `PERCENTIL.INC`), `precoM2(valor, area)` (descarta área ≤ 0), `removerOutliersIqr(xs, k = 1.5)`.
- `haversine.ts`: `distanciaMetros(a, b)`, `boundingBox(centro, raio)`.
- `classificacao-his-mcmv.ts`: `classificarHis(preco, renda | null, params, data)` e `classificarMcmv(...)` → categoria, teto, folga em R$ e %; escolhe o parâmetro vigente na data; `corrigirTetoPeloIncc(teto, acumulado)`.
- `ciclo-venda.ts`: `cicloDias(eventos)` (da entrada até a entrada em Fechamento), `cicloMedio`, `cicloMediano`, `tempoPorEtapa`.
- `funil.ts`: `montarFunil(eventos, etapasOrdenadas)` → entradas, saídas e conversão etapa a etapa.

Teste: Jest já configurado (`*.spec.ts` ao lado de cada função), com casos de tabela: lista vazia, um elemento, par/ímpar, distância conhecida (Praça da Sé → Av. Paulista ≈ 2,7 km), valores na fronteira exata dos tetos (R$ 276.102,20 = HIS-1; +0,01 = HIS-2), troca de vigência no meio do mês, Faixa 4 MCMV acima do teto HMP. Repositórios Prisma ganham teste que confere `tenantId` em todo `where`.

## 7. Dependências novas

Conferido no `package.json`: já existem `exceljs` (XLSX), `csv-parse`, `@nestjs/schedule`, `@nestjs/event-emitter`, `@nestjs/throttler`, `@anthropic-ai/sdk`, `date-fns`, e o Node 22 tem `fetch` nativo (Google, Nominatim, SGS do Banco Central e IBGE).

**Backend: nenhuma dependência nova é necessária no MVP.** Candidatas, só se surgir necessidade, cada uma pedindo aprovação do Villar:
- `xlsx` (SheetJS) — leria ODS direto. Não recomendo: a versão do npm está parada e tem vulnerabilidade conhecida; a conversão pelo LibreOffice resolve.
- `apify-client` — só na fase da coleta automática de concorrentes, depois da revisão jurídica; dá para começar com `fetch` na API REST.
- PostGIS (extensão do Postgres, não pacote npm) — só se o volume passar de milhões de linhas.

Variáveis de ambiente novas: `GOOGLE_GEOCODING_KEY` (opcional; sem ela usa só Nominatim), `NOMINATIM_USER_AGENT`, `ITBI_URL_<ANO>`, `BII_JOBS`, `BII_IA_LIMITE_DIARIO`.
