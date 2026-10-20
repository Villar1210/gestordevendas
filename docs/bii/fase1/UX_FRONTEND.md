# BII — Fase 1: UX e Frontend (19/10/2026)

Wireframe navegável: `docs/bii/fase1/WIREFRAMES.html` (abrir no navegador; dados fictícios). Nada do `frontend/` foi alterado.

## Fluxo do usuário (Administrador)
1. Menu **BII** → abre em **Painel de Vendas** (o uso mais frequente: olhar o mês).
2. Filtra período/stand/corretor/origem → lê KPIs → acha o gargalo no funil → vê motivos de perda. "Comprou na concorrência" leva a **Concorrentes**.
3. **Nova Análise por Endereço**: digita o endereço, escolhe raio (500 m / 1 km / 2 km), vincula ou não a um empreendimento próprio → confere o pino → vê ITBI no raio, perfil IBGE e demanda do CRM → **Salvar análise**.
4. **Concorrentes** (do raio da análise ou do empreendimento): tabela + "Cadastrar concorrente" + comparativo lado a lado.
5. **Viabilidade**: enquadramento HIS/HMP e MCMV por tipologia, renda necessária × limites, INCC, **Parecer** gerado por IA → revisar/editar → salvar ou baixar PDF.
6. **Histórico**: reabre a análise como foi salva; "Atualizar com dados de hoje" cria nova versão (não sobrescreve).

## Decisões de UX (heurísticas de Nielsen)
- **Visibilidade do estado / honestidade do dado**: todo número tem selo de fonte (CRM, ITBI·Prefeitura, IBGE, Banco Central, Tabela oficial, Manual, IA) e rodapé com data da última leitura. O usuário sempre sabe de onde veio e de quando é.
- **Correspondência com o mundo real**: vocabulário do incorporador (VGV, HIS-1, Faixa 2, R$/m², p25–p75 explicado como "faixa típica").
- **Prevenção de erro**: pino confirmável antes de salvar (geocodificação erra); raio como botão segmentado (3 opções fixas, sem digitar); tabelas de parâmetros versionadas por vigência.
- **Reconhecer em vez de lembrar**: filtros sempre visíveis no topo; o empreendimento escolhido aparece no título das abas seguintes.
- **IA sob controle humano**: parecer com selo escuro "gerado por IA — revise", botões Gerar de novo/Editar, só recebe números agregados (nunca dados pessoais). No histórico: "IA revisado" vs "não revisado".
- **Cores**: azul = destaque/ação; verde = vantagem/OK; âmbar só para status "Atenção" (regra do projeto); vermelho só para queda. Gráficos com eixo em zero (exceto evolução de m², sinalizado).
- **Estados vazios que ensinam**: cada aba tem um vazio com a próxima ação (primeira busca, cadastrar concorrente, salvar análise).
- **LGPD**: renda de leads (VIVI) só em faixas agregadas com mínimo de 20 leads.
- **Responsivo até 360 px**: sidebar vira gaveta (padrão atual), KPIs 5→3→2→1 colunas, abas com rolagem horizontal, tabelas largas com `overflow-x:auto`, comparativo empilha.

## Estrutura de pastas proposta
```
src/app/dashboard/bii/
  layout.tsx            # SomenteAdminGuard + cabeçalho + abas (links)
  page.tsx              # redirect -> /dashboard/bii/vendas
  vendas/page.tsx
  analise/page.tsx      # nova análise
  analise/[id]/page.tsx # análise salva (endereço, concorrentes, viabilidade)
  concorrentes/page.tsx
  viabilidade/page.tsx
  historico/page.tsx
src/features/bii/
  api/            # chamadas /bii/* (apiRequest)
  store/          # useBiiFiltrosStore, useBiiAnaliseStore (Zustand)
  hooks/          # useBiiPainelIntegration, useBiiAnaliseIntegration
  components/
    painel/       # FunilEtapas, VgvMensalChart, RankingCorretores, MotivosPerda
    analise/      # EnderecoForm, MapaEntorno (dynamic), ItbiResumo, PerfilDemografico
    concorrentes/ # ConcorrentesTable, ConcorrenteForm, ComparativoLadoALado
    viabilidade/  # EnquadramentoTable, RendaPrecoChart, ParametrosVigentes, ParecerIa
  constants.ts    # fontes (selos), cores de enquadramento, labels
  types.ts
```
Abas como **rotas** (não estado local): link compartilhável, botão voltar funciona, cada página carrega só seus dados.

## Item do menu
```ts
{ icon: ChartNoAxesCombined, label: "BII", href: "/dashboard/bii", requiredRole: "Administrador" }
```
Inserir depois de "Simulador". Ícone confirmado no `lucide-react@1.23.0` instalado (`chart-no-axes-combined`); alternativas: `Radar`, `ChartSpline`. O menu só esconde; a proteção real é o `@Roles('Administrador')` no backend + `SomenteAdminGuard` na página.

## Componentes novos reutilizáveis (`src/components/ui/`)
- **KpiCard** — `label`, `value`, `delta` (+/−, "pior" quando maior é ruim), `source`. Reaproveitável no Início e no E-doc.
- **SourceBadge** — selo de fonte padronizado (cor por fonte + tooltip com data).
- **ChartCard** — card branco com título, selo de fonte, `hint`, rodapé e estados `loading` / `empty` / `error` embutidos.
- **EmptyState** — ícone + título + texto + ação.
- **Toast compartilhado** — hoje não existe; `useToastStore` (Zustand) + `<Toaster/>` no layout do dashboard (`role="status"`, some em 4 s). Sem dependência nova.
- **SegmentedControl** — raio, ordenação do ranking.

## Bibliotecas (conferido no registro npm em 19/10/2026)
| Pacote | Versão sugerida | React 19 | Observação |
|---|---|---|---|
| `recharts` | `^3.10.1` (latest, 25/07/2026) | sim — peer `react ^16.8 … ^19` | O README pede instalar `react-is` junto, na mesma versão do React: `react-is@19.1.0`. |
| `leaflet` | `1.9.4` (latest estável) | n/a | 2.0 está em alpha — não usar. Importar `leaflet/dist/leaflet.css`. |
| `react-leaflet` | `^5.0.0` | sim — peer `react ^19`, `leaflet ^1.9` | A v5 **exige** React 19 (projeto está no 19.1.0). |
| `@types/leaflet` | `^1.9.22` | — | dev. |

Riscos e mitigação:
- **Leaflet usa `window`** → `MapaEntorno` carregado com `next/dynamic(() => import(...), { ssr: false })`, mesmo padrão do `PdfViewer`.
- **Ícone padrão do marcador quebra no webpack** (caminho da imagem) → usar `L.divIcon` com SVG próprio (dispensa os PNGs).
- **Recharts com SSR**: os componentes são `"use client"`; `ResponsiveContainer` precisa de altura fixa no pai.
- Alternativa caso o Recharts dê problema: gráficos em **SVG próprio** (funil e barras são simples, como no wireframe) — zero dependência. Alternativa para o mapa: **MapLibre GL** com tiles vetoriais de provedor comercial (mais pesado; só se o OSM bloquear).
- Pelas regras do projeto, as três instalações precisam de **aprovação do Villar** (decisão pendente nº 2).

## Política de tiles do OpenStreetMap (operations.osmfoundation.org/policies/tiles, lida em 19/10/2026)
- URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (só HTTPS); deixar a URL **configurável** (`NEXT_PUBLIC_MAP_TILE_URL`).
- **Atribuição visível** no mapa ("© colaboradores do OpenStreetMap", canto inferior direito, sem esconder) — o `attributionControl` do Leaflet já faz isso.
- Navegador precisa enviar **Referer** válido: não usar `Referrer-Policy: no-referrer` no Next.
- **Proibido** baixar em massa/pré-carregar áreas ou modo offline; respeitar cache (mínimo 7 dias).
- **Sem limite numérico publicado e sem SLA**: o acesso pode ser cortado sem aviso se o uso pesar; para uso comercial a política sugere provedor comercial.
- Recomendação: OSM serve no MVP (poucos administradores, poucos mapas por dia). Se o BII for oferecido a muitos tenants, trocar a URL para um provedor pago compatível (ex.: MapTiler, Stadia) só pela variável de ambiente.
