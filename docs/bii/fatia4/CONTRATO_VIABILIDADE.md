# BII — Fatia 4: Viabilidade HIS/HMP/MCMV (contrato)

Objetivo: para cada tipologia (preço e área), dizer **em que categoria municipal (HIS-1, HIS-2, HMP) e em que faixa do Minha Casa Minha Vida ela se encaixa**, quanto sobra até o teto, e **qual renda o comprador precisa ter** para financiar — com aviso quando essa renda não bate com a categoria. Pergunta: *"esse produto, por esse preço, vende para quem eu quero vender?"*

Fora do escopo: subsídio do MCMV (depende da renda e da região, calculado pela Caixa), correção automática pelo INCC (os valores do decreto já são os de 2026), parecer por IA, salvar simulação.

## 1. Parâmetros (domínio, versionados no código)

`domain/services/parametros-habitacionais.ts` — cada versão com `vigenteDesde` e `fonte`. Mudou a regra → nova versão no código (fica no histórico do git), nunca editar a antiga.

**Municipal — Prefeitura de São Paulo**, Decreto 64.895 de 05/01/2026 (DOM 06/01/2026), salário mínimo de referência R$ 1.621,00:

| Categoria | Renda familiar máx. | Teto de venda |
|---|---|---|
| HIS-1 | R$ 4.863,00 (3 SM) | R$ 276.102,20 |
| HIS-2 | R$ 9.726,00 (6 SM) | R$ 383.636,74 |
| HMP | R$ 16.210,00 (10 SM) | R$ 537.672,71 |

**Federal — MCMV**, Conselho Curador do FGTS (24/03/2026), operado pela Caixa desde 22/04/2026. Tetos da cidade de São Paulo (Faixas 1 e 2 têm teto por região; SP capital usa o maior, R$ 275 mil):

| Faixa | Renda bruta | Teto do imóvel | Juros de referência (a.a., não cotista) |
|---|---|---|---|
| Faixa 1 | até R$ 3.200 | R$ 275.000 | 5,25% |
| Faixa 2 | R$ 3.200,01 a R$ 5.000 | R$ 275.000 | 7,00% |
| Faixa 3 | R$ 5.000,01 a R$ 9.600 | R$ 400.000 | 8,16% |
| Faixa 4 | R$ 9.600,01 a R$ 13.000 | R$ 600.000 | 10,50% |
| Fora do MCMV (SBPE) | acima de R$ 13.000 | — | 12,00% |

Os juros são **referência** para estimar a renda (o maior da faixa, conservador); o usuário pode informar outro valor.

## 2. Regras (domínio puro: `domain/services/viabilidade.ts`)

- **Municipal pelo preço**: menor categoria cujo teto ≥ preço (fronteira inclusiva: R$ 276.102,20 = HIS-1; +0,01 = HIS-2). Acima do teto HMP → "Mercado (acima de HMP)". Folga = teto − preço (R$ e %).
- **Renda necessária** (estimativa = renda **mínima** do comprador): financiado = preço × (1 − entrada%); parcela pela Tabela Price com juros mensal equivalente ao anual e prazo em meses; renda pela parcela = parcela ÷ comprometimento%.
- **MCMV** (corrigido na revisão independente): percorre, em ordem crescente, as faixas **cujo teto cobre o preço**. Em cada uma, calcula a renda pela parcela com os juros da faixa (ou a taxa fixa informada) e eleva ao **piso da faixa** se ficar abaixo (quem ganha menos está numa faixa cujo teto não cobre o preço). A primeira faixa em que essa renda cabe é a resposta (`rendaPeloPiso` indica quando o piso mandou). Nenhuma → fora do MCMV (SBPE 12% a.a. ou a taxa fixa). Também mostra a faixa mínima pelo preço.
- **Situação**: `ok` = enquadra no MCMV **e** é HIS/HMP com a renda necessária ≤ renda máxima da categoria; `atencao` = qualquer outro caso que ainda cabe numa categoria ou faixa — inclusive produto **acima de HMP que enquadra na Faixa 4** (decisão: perde os incentivos municipais de HIS/HMP, por isso não é "ok"); `fora` = acima de HMP **e** fora do MCMV.
- **Avisos** em linguagem de incorporador (ex.: "o preço cabe no teto HIS-1, mas a renda necessária (R$ 5.027) passa do limite de renda HIS-1 (R$ 4.863)"; "a renda cai na Faixa 3, cujo teto (R$ 400 mil) não cobre o preço").
- R$/m² = preço ÷ área privativa.

## 3. Rotas (`BiiViabilidadeController`, `@Controller('bii')`, só Administrador)

| Rota | O que faz | Limite |
|---|---|---|
| `GET /bii/viabilidade/parametros` | parâmetros vigentes + fontes | — |
| `POST /bii/viabilidade` | calcula (não grava nada, não chama serviço externo) | 30/min por IP |

Corpo: `{ tipologias: [{ descricao (1-100), areaPrivativa (10-1000), preco (10 mil-100 mi) }] (1 a 20), premissas: { entradaPercentual 0-90 (padrão 20), prazoMeses 60-420 (padrão 420), comprometimentoPercentual 10-50 (padrão 30), jurosAnual? 0-30 } }`. Impersonação do Super Usuário: liberado (só leitura/cálculo, sem custo).

## 4. Tela

Aba **Viabilidade** deixa de ser "em breve": lista de tipologias (adicionar/remover; botão **"Trazer de um concorrente"** copia as tipologias de um concorrente cadastrado), premissas do financiamento, botão Calcular → tabela (tipologia, área, preço, R$/m², categoria municipal com teto e folga, faixa MCMV, renda necessária, parcela, situação) + avisos + quadro "Parâmetros vigentes" com as fontes. Selo de fonte "Tabela oficial". Texto fixo: estimativa, sem subsídio; confirme com a Caixa.

## 5. Testes e aceite
Fronteiras exatas dos tetos e rendas, Faixa 4 acima do teto HMP, iteração de juros, Price conferida com valor calculado à parte, avisos; meta-teste do controller; E2E da tela; build limpo. Sem migration, sem dependência nova, sem variável nova.
