# BII — Fatia 5: Estudo de terreno (contrato)

Objetivo: juntar num **relatório único, salvo e imprimível** o que as fatias 2, 3 e 4 respondem separadamente — mercado no raio (ITBI), concorrência cadastrada e viabilidade HIS/HMP/MCMV das tipologias pensadas para o terreno. Pergunta: *"vale a pena lançar este produto neste endereço?"* — o "estudo de caso" que o Administrador leva à diretoria.

Fora do escopo: parecer/recomendação gerada por IA, PDF gerado no servidor (o relatório é impresso pelo navegador: "Salvar como PDF"), análise financeira do empreendimento (custo de obra, TIR), compartilhamento por link público.

## 1. Fluxo

1. O estudo **parte de uma Análise por Endereço já feita** (`analiseId`) — a tela permite escolher uma das análises salvas ou fazer uma nova na hora (usa o `POST /bii/analises/endereco` existente, com a mesma cota/limites). O estudo **não geocodifica nem lê ITBI** por conta própria.
2. O Administrador informa as **tipologias** (1 a 20, mesmas regras da Fatia 4) e as **premissas** do financiamento (opcionais, mesmos padrões), o **nome** do estudo e uma **conclusão** em texto livre (opcional, a opinião dele).
3. O servidor monta o relatório e grava um **snapshot** (foto do dia): cópia do resultado da análise + viabilidade calculada + posicionamento + resumo executivo. Mudar parâmetros oficiais, concorrentes ou a própria análise depois **não altera** um estudo salvo.

## 2. Regras novas (domínio puro: `domain/services/estudo.ts`)

- **Posicionamento de preço** de cada tipologia contra a **mediana de R$/m² dos concorrentes no raio** (mesma base: preço de tabela ÷ área privativa): diferença em % e classe `abaixo` (< −5%), `alinhado` (−5% a +5%) ou `acima` (> +5%). Sem concorrente com R$/m² no raio → `null` ("sem concorrentes para comparar"). A diferença é arredondada para 1 casa **antes** de classificar (coerente com o número mostrado: −5,04% vira −5,0% = alinhado). A "posição média" é a posição do R$/m² médio das tipologias (não a média das posições).
- **ITBI só lado a lado**, nunca em %: o relatório mostra a mediana e a faixa p25–p75 do ITBI ao lado do R$/m² da tipologia, com a observação de que as bases são diferentes (valor pago × área construída do IPTU com áreas comuns vs. preço de tabela × área privativa) — mesma decisão da Fatia 3.
- **Resumo executivo** (só fatos, sem recomendação): transações ITBI no raio e período; R$/m² mediano ITBI (p25–p75); concorrentes no raio e R$/m² mediano deles; quantas tipologias ficam `ok`/`atencao`/`fora`; quantas enquadram no MCMV; R$/m² médio das tipologias e posição média contra os concorrentes.
- **Alertas de qualidade** automáticos: amostra ITBI pequena (< 30 transações no raio); nenhum concorrente no raio ("cadastre os concorrentes da região"); análise feita antes da Fatia 3 (sem concorrentes no snapshot); análise com mais de 90 dias.

## 3. Banco (migration `20261023120000_bii_estudos`, só CREATE)

`BiiEstudo` (`bii_estudos`, **por tenant**, FK Tenant Cascade): `nome` (3–120), `analiseId` (FK `BiiAnalise` **SetNull** — o estudo guarda a própria cópia), `enderecoFormatado` (cópia, para a listagem), `raioMetros`, `meses`, `tipologias` (Json, entrada), `premissas` (Json), `conclusao` (≤ 5000, texto livre, opcional), `situacaoResumo` (Json `{ ok, atencao, fora }`, para a listagem), `resultado` (Json, snapshot completo), `createdById`/`updatedById` (sem FK), `createdAt`/`updatedAt`. Índice `(tenantId, createdAt)`. Sempre lido por `{ id, tenantId }`. Limite: **500 estudos por tenant** (409). Cada estudo guarda o snapshot inteiro da análise (amostra de até 200 transações, até 50 concorrentes): ~50–150 KB, ou seja, até ~75 MB por tenant no teto.

## 4. Rotas (`BiiEstudoController`, `@Controller('bii')`, só Administrador, reforçado no use case)

| Rota | O que faz | Limite |
|---|---|---|
| `GET /bii/estudos` | últimos 100 (id, nome, endereço, raio, situação, criado/atualizado) | — |
| `GET /bii/estudos/:id` | estudo completo (snapshot) | — |
| `POST /bii/estudos` | cria a partir de `analiseId` + tipologias + premissas + nome + conclusão | 30/min por IP + 30/min por usuário somando POST/PATCH/DELETE |
| `PATCH /bii/estudos/:id` | altera **só** nome e conclusão (o snapshot não é recalculado); `nome: null` → 400 | idem |
| `DELETE /bii/estudos/:id` | exclui (204) | idem |

- Análise de outro tenant ou inexistente → 404 "Análise não encontrada." (mesma resposta, sem revelar existência).
- Impersonação do Super Usuário: GET liberado; POST/PATCH/DELETE → 403 `BII_SOMENTE_LEITURA`.
- Textos (nome, conclusão, descrição das tipologias) passam pela mesma limpeza da Fatia 3 (sem caracteres de controle/bidi/invisíveis). A conclusão é exibida como texto puro (nunca HTML).
- Escrita condicional `updateMany/deleteMany where { id, tenantId }`. Só Prisma tipado.
- Log de auditoria: ids, tenant, usuário, quantidade de tipologias — nunca endereço, nome do estudo ou conclusão.

## 5. Tela

Nova aba **Estudos** no BII (`/dashboard/bii/estudos`): lista com nome, endereço, situação (chips ok/atenção/fora) e datas; botão **Novo estudo** abre um assistente em 3 passos — (1) escolher análise salva ou fazer uma nova, (2) tipologias + premissas (botão "Trazer de um concorrente no raio"), (3) nome + conclusão → salvar. O relatório (`/dashboard/bii/estudos/[id]`) tem: cabeçalho (nome, endereço, data, raio/período), resumo executivo, alertas, mapa (endereço + concorrentes), ITBI por mês, tabela de concorrentes, tabela de viabilidade com posicionamento, premissas e parâmetros oficiais com fontes, conclusão do Administrador e notas de método. Botão **Imprimir / Salvar PDF** usa `window.print()` com CSS de impressão (A4, sem menu/sidebar, quebras de página por seção). Editar nome/conclusão e excluir no próprio relatório.

## 6. Testes e aceite

Domínio (posicionamento nas fronteiras ±5%, sem concorrentes, resumo, alertas, snapshot antigo sem `concorrentes`); use cases (404 de outro tenant, impersonação, limite 500, PATCH não recalcula); meta-teste de permissões cobrindo o controller novo; integração do repositório (isolamento de tenant); E2E da tela (criar a partir de análise, relatório, editar conclusão, imprimir, 360 px); build limpo. Sem dependência nova, sem variável nova.
