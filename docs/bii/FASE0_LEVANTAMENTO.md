# BII — Fase 0: levantamento (19/10/2026)

Repositório: Villar1210/gestordevendas (commit 4e22bed). Nada foi alterado.

## Backend, banco e segurança
- Molde de módulo: `src/modules/plantao/` (Clean Architecture, só Administrador). Agregação de referência: `edoc/.../get-envelope-stats.use-case.ts`.
- Acesso: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('Administrador')` + checagem repetida no use case + meta-teste de rotas (`permissoes-imoveis.http.spec.ts`).
- Tenant: isolamento 100% manual (`where: { tenantId }`), sem RLS. No BII: escrita sempre com `{ id, tenantId }`, SQL bruto só parametrizado, teste que obrigue o filtro.
- **Lacuna principal:** não existe histórico de mudança de etapa nem data/motivo de ganho e perda no Card. Funil, conversão e VGV por período dependem de criar `CardStageHistory` + `ganhoEm`/`perdidoEm`/`motivoPerda`.
- Dados úteis já existentes: `Card.value` (VGV), `Card.origem`, `motivoRepique`, `Imovel.status` (VENDIDO), `Contrato` (venda), `Empreendimento` (endereço, sem lat/lng), `Imovel.latitude/longitude` (vazios), `ViviConversation` (renda, região — dado sensível), `EnderecoBuscaLog` (sinal de demanda).
- Integrações: Anthropic já com web_search (reaproveitável); não há Apify, Google Maps nem geocoding.
- Custo de IA por tenant: imitar `ViviUsoDiario`. Auditoria: criar trilha própria de consultas do BII.

## Frontend e UX
- Next 15.5 (webpack), React 19, Tailwind v4, Zustand, lucide-react. Sem shadcn, sem gráficos, sem mapa, sem toast, sem dark mode.
- Menu: `NAV_ITEMS` em `Sidebar.tsx` com `requiredRole: "Administrador"`. Guard de página: `SomenteAdminGuard.tsx` + `useMe`.
- Moldes: `src/features/dashboard-corretor/` (painel com polling silencioso) e `src/features/equipe/`.
- Visual: base slate, cards brancos rounded-2xl, destaque blue-600/700, Inter.

## Fontes externas (Analista SaaS)
- MVP: ITBI da Prefeitura de SP (transações reais, XLSX anual, atualização mensal, grátis); IBGE Censo 2022 por setor (demografia; renda por setor não confirmada); Google Geocoding (10 mil/mês grátis) com Nominatim de fallback; INCC (API do Banco Central) + tabela MCMV cadastrada à mão.
- Depois: lançamentos concorrentes via Apify (ZAP/VivaReal) só após revisão jurídica dos termos e sem dados de corretores; solução definitiva via contrato com Órulo ou Embraesp. GeoSampa (lotes, ZEIS) a confirmar.
- MCMV desde 22/04/2026 (fonte: imprensa, conferir resolução oficial): F1 até R$3.200, F2 até R$5.000 (teto até R$275 mil), F3 até R$9.600 (teto R$400 mil), F4 até R$13.000 (teto R$600 mil).

## Faixas municipais HIS/HMP (conferido na Prefeitura de SP, 19/10/2026)
Fonte: Gestão Urbana / Prefeitura de SP, publicação no DOM de 06/01/2026 (Decreto 64.895 de 05/01/2026). Salário mínimo de referência R$ 1.621,00.

| Categoria | Renda familiar máx. | Teto de venda |
|---|---|---|
| HIS-1 | R$ 4.863,00 (3 SM) | R$ 276.102,20 |
| HIS-2 | R$ 9.726,00 (6 SM) | R$ 383.636,74 |
| HMP | R$ 16.210,00 (10 SM) | R$ 537.672,71 |

- Renda corrigida pelo salário mínimo todo ano; tetos de venda corrigidos pelo INCC.
- Correspondência com MCMV é aproximada: HIS-1 ≈ Faixas 1-2, HIS-2 ≈ Faixas 2-3, HMP ≈ Faixas 3-4. Faixa 4 do MCMV (renda R$ 9.600,01 a R$ 13.000, teto R$ 600 mil) não tem categoria municipal; uma unidade pode caber na Faixa 4 e passar do teto HMP.
- Decisão de modelagem: duas tabelas de parâmetros separadas e versionadas por vigência (municipal HIS/HMP e federal MCMV); o BII classifica empreendimento e cliente nas duas.

## Decisões pendentes do Villar (Fase 1)
1. Criar histórico de etapas e ganho/perda no Card (mexe no módulo vendas_kanban).
2. Instalar dependências: gráficos (recharts) e mapa (leaflet + react-leaflet).
3. Fontes do MVP e chave do Google Geocoding.
4. Ordem das fatias.
