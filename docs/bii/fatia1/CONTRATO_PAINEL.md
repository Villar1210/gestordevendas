# BII — Fatia 1: contrato do Painel de Vendas

Decisões aprovadas pelo Villar em 19/10/2026 (resposta "ok" às 6 decisões da Fase 1):
1. Ganho = lead ENTRA na etapa "Fechamento". Perda = lead ENTRA na etapa "Repique" (motivo = `motivoRepique`). Nenhum campo novo no Card.
2. O `vendas_kanban` só emite o evento `card.stage.changed` (uma linha em cada ponto que muda `stageId`). Comportamento do Kanban não muda.
3. Frontend pode instalar `recharts` + `react-is@19.1.0` (Fatia 1) e `leaflet` + `react-leaflet` (Fatia 2).
4. Super Usuário impersonando: só leitura no BII (Fatia 1 só tem leitura).
5. Importação do ITBI só pelo Super Usuário (Fatia 2).
6. Geocodificação começa no OpenStreetMap/Nominatim (Fatia 2).

## Evento `card.stage.changed` (contrato entre módulos)

```ts
interface CardStageChangedEvent {
  tenantId: string;
  cardId: string;
  pipelineId: string | null;
  fromStageId: string | null; // null = entrada no funil
  toStageId: string;
  userId: string | null;      // null = job/sistema
  origem: 'move' | 'claim' | 'job_repique' | 'promocao' | 'criacao';
  ocorridoEm: Date;
  motivoRepique?: string | null;
}
```
Emitido com `emit` (não `emitAsync`), DEPOIS da escrita bem-sucedida, só quando o stage realmente muda (ou na criação com stage). O BII grava `BiiCardStageEvento` em try/catch que só loga.

## Endpoint

`GET /bii/painel` — só Administrador (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('Administrador')` na classe + checagem no use case). Impersonação permitida (é leitura).

Query (todos opcionais):
- `de`, `ate`: `YYYY-MM-DD` (date-only, usar `parseDateOnly`). Padrão: últimos 6 meses até hoje. `ate` inclusivo (até 23:59:59.999 local). Máximo 24 meses de intervalo (400 se passar). `de > ate` → 400.
- `pipelineId`: padrão = primeiro pipeline do tenant (o mais antigo).
- `corretorId`: filtra por `Card.ownerId`.
- `origem`: filtra por `Card.origem`.

Resposta (valores em reais como `number`; percentuais 0–100 com 1 casa; `null` quando não há base para calcular):

```ts
interface PainelVendasResponse {
  periodo: { de: string; ate: string };          // YYYY-MM-DD
  historicoDesde: string | null;                 // ISO do 1º BiiCardStageEvento do tenant (null = ainda não há histórico)
  pipelineId: string | null;
  pipelines: { id: string; nome: string }[];
  filtros: { corretores: { id: string; nome: string }[]; origens: string[] };
  resumo: ResumoVendas;
  comparativo: ResumoVendas;                     // período anterior de mesma duração
  funil: { stageId: string; nome: string; entradas: number; conversaoProximaPct: number | null }[];
  vgvPorMes: { mes: string /* YYYY-MM */; vgv: number; ganhos: number }[]; // todos os meses do período, inclusive zerados
  ranking: { corretorId: string; nome: string; leads: number; ganhos: number; conversaoPct: number | null; vgv: number }[]; // ordenado por vgv desc, depois ganhos
  porOrigem: { origem: string; leads: number; ganhos: number; conversaoPct: number | null }[];
  motivosPerda: { motivo: string; rotulo: string; quantidade: number; pct: number }[];
}
interface ResumoVendas {
  leadsNovos: number;          // cards criados no período (filtros aplicados)
  ganhos: number;              // cards distintos que ENTRARAM em "Fechamento" no período
  perdidos: number;            // cards distintos que ENTRARAM em "Repique" no período
  conversaoPct: number | null; // ganhos / leadsNovos * 100
  vgvGanho: number;            // soma de Card.value dos ganhos (value nulo conta 0)
  ticketMedio: number | null;  // vgvGanho / ganhos com value preenchido
  cicloMedioDias: number | null;   // média (data do ganho - Card.createdAt) em dias
  cicloMedianoDias: number | null;
}
```

Regras:
- Funil: etapas do pipeline em ordem de `position`, SEM "Repique". `entradas` = cards distintos com evento de entrada naquela etapa no período. `conversaoProximaPct` = entradas da próxima / entradas desta (última = null).
- Ganho/perda pelo NOME da etapa no momento do evento (`toStageNome`), comparação sem acento e sem caixa ("fechamento", "repique").
- Cards de outro tenant nunca entram (toda query com `tenantId`).
- Ranking/porOrigem: `leads` = leadsNovos do corretor/origem; `ganhos` idem resumo.
- Motivos de perda: rótulos de `motivo-repique.ts`; motivo nulo = "Não informado".
- Sem dados pessoais além do nome do corretor (nada de telefone/e-mail/renda de lead).

## Frontend
- Item "BII" no `NAV_ITEMS` do Sidebar, ícone `ChartNoAxesCombined`, `href: "/dashboard/bii"`, `requiredRole: "Administrador"`.
- `/dashboard/bii` com abas: "Painel de Vendas" (ativa) + "Análise por Endereço", "Concorrentes", "Viabilidade", "Histórico" desabilitadas com selo "em breve".
- Visual conforme `docs/bii/fase1/WIREFRAMES.html` (aba Painel).
