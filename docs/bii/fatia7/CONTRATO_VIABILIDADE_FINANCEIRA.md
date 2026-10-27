# BII — Fatia 7: Viabilidade financeira do empreendimento (contrato)

Status: **APROVADO pelo Villar em 27/10/2026 — implementado.**

Objetivo: responder *"este terreno, com este produto, dá lucro? quanto posso pagar no terreno?"*. A partir das tipologias (preço, área privativa e **quantidade**), do custo do terreno (compra e/ou permuta) e do custo de obra, montar o **resultado final** do empreendimento:

- VGV;
- impostos, comissão e marketing;
- custos de terreno, obra e indiretos;
- lucro e margem;
- **valor máximo do terreno** para uma margem desejada.

Premissas escolhidas pelo Villar (27/10/2026):

- **Impostos por estudo**: RET 4% (padrão), RET 1% (MCMV/HIS) ou outro % digitado.
- **Comissão 5% e marketing 3%** do VGV, editáveis.
- **Custo de obra em R$/m² digitado**, com o **CUB-SP** mostrado só como referência.
- Nível **"resultado final"**, com opção de **terreno em permuta** (% das unidades).

**Fora do escopo:**

- fluxo de caixa mês a mês, TIR, VPL e exposição máxima de caixa;
- financiamento à produção (plano empresário) e juros de obra;
- correção do custo pelo INCC durante a obra;
- distrato e inadimplência;
- imposto sobre a unidade dada em permuta (veja o aviso fixo);
- parecer por IA.

Esses itens ficam para uma fatia futura, se o Villar quiser.

## 1. Entradas

| Campo | Padrão | Limites | Observação |
|---|---|---|---|
| tipologias[] `{ descricao, areaPrivativa, preco, quantidade }` | — | 1–20 tipologias; quantidade 1–5.000; área e preço como na Fatia 4 | `quantidade` é novo |
| terreno.valorCompra | 0 | 0 – R$ 2 bi | o que se paga em dinheiro |
| terreno.itbiPercentual | 3 | 0–10 | ITBI da capital = 3% |
| terreno.escrituraRegistroPercentual | 1 | 0–10 | cartório (estimativa) |
| terreno.permutaPercentual | 0 | 0–60 | % do VGV entregue ao dono do terreno em unidades |
| obra.custoM2 | — (obrigatório) | R$ 500 – 20.000 | por m² de **área construída** |
| obra.areaConstruida | — (opcional) | 1 – 2.000.000 m² | se vazio, é calculada pelo fator abaixo |
| obra.fatorAreaConstruida | 1,6 | 1,0–3,0 | área construída ÷ área privativa total |
| obra.indiretosPercentual | 10 | 0–50 | projetos, aprovações, administração, sobre o custo de obra |
| obra.contingenciaPercentual | 5 | 0–30 | sobre o custo de obra |
| comercial.impostoRegime | `ret4` | `ret4` \| `ret1` \| `outro` | |
| comercial.impostoPercentual | 4 / 1 | 0–30 | só digitado quando o regime é `outro` |
| comercial.comissaoPercentual | 5 | 0–15 | sobre o VGV vendável |
| comercial.marketingPercentual | 3 | 0–15 | sobre o VGV vendável |
| margemAlvoPercentual | 15 | 0–60 | sobre o VGV vendável; usado no valor máximo do terreno |

## 2. Contas (domínio puro: `domain/services/viabilidade-financeira.ts`)

**Áreas e VGV**

- Área privativa total = Σ (área × quantidade).
- Área construída = `obra.areaConstruida`, ou, se vazia, área privativa total × fator.
- **VGV total** = Σ (preço × quantidade).
- **VGV da permuta** = VGV total × permuta%.
- **VGV vendável** = VGV total − VGV da permuta.

**Deduções** (sobre o VGV vendável)

- Imposto = VGV vendável × imposto%.
- Comissão = VGV vendável × comissão%.
- Marketing = VGV vendável × marketing%.
- **Receita líquida** = VGV vendável − imposto − comissão − marketing.

**Custos**

- Terreno = compra × (1 + ITBI% + escritura%). A permuta não entra aqui em dinheiro: o custo dela já está no VGV que deixou de ser vendido.
- Obra = área construída × R$/m².
- Indiretos = obra × indiretos%.
- Contingência = obra × contingência%.
- **Custo total** = terreno + obra + indiretos + contingência.

**Resultado**

- **Lucro** = receita líquida − custo total.
- **Margem sobre o VGV** = lucro ÷ VGV vendável. É o indicador principal e decide a situação.
- **Margem sobre o custo** (markup) = lucro ÷ custo total.
- **Peso do terreno** = (terreno + VGV da permuta) ÷ VGV total. Mostra o quanto o terreno "custa" do produto, somando dinheiro e unidades.
- **Custo por m² privativo** = custo total ÷ área privativa total. Também mostra só a parte da obra.
- **Valor máximo do terreno** (compra em dinheiro, com a mesma permuta): o valor V em que a margem sobre o VGV chega exatamente à margem-alvo.
  - Fórmula: V = (receita líquida − obra − indiretos − contingência − alvo% × VGV vendável) ÷ (1 + ITBI% + escritura%).
  - Se V ≤ 0, devolve `null`, com o aviso "Mesmo com o terreno de graça a margem não chega a X%".

**Situação**

- `viavel`: margem ≥ alvo.
- `apertado`: 0 ≤ margem < alvo.
- `inviavel`: lucro < 0.

**Arredondamento**: valores em R$ com 2 casas e percentuais com 1 casa, só na saída. Nas contas não há arredondamento intermediário.

**Avisos**

- Custo de obra abaixo do CUB-SP de referência. O texto avisa que o CUB não inclui fundações, elevadores, paisagismo, impostos nem a remuneração da construtora, por isso o custo real costuma ficar acima dele.
- RET 1% escolhido, mas alguma tipologia não cabe no MCMV pelo preço. Usa as mesmas regras da Fatia 4, `faixaPeloPreco`.
- Permuta maior que 0. Aviso fixo: a unidade dada em permuta também tem tributação, e o contador deve confirmar.
- Margem abaixo do alvo.
- Área construída digitada menor que a área privativa total. Nesse caso a conta é recusada com erro 400, porque não faz sentido.

## 3. Referência do CUB-SP (versionada no código, como os parâmetros da Fatia 4)

Arquivo `domain/services/referencia-cub.ts`. Cada versão tem mês, valor e fonte; mudou o mês → **acrescentar** uma versão nova, nunca editar a antiga.

Valor de partida: **CUB-SP R8-N (residencial multifamiliar, padrão normal, 8 pavimentos), agosto/2026 = R$ 2.235,58/m²**, sem desoneração (SindusCon-SP). A tela mostra o valor com mês e fonte e a razão "seu custo = 1,4 × CUB". O CUB nunca é usado como custo automaticamente.

## 4. Rotas (no `BiiViabilidadeController` da Fatia 4, `@Controller('bii')`, só Administrador)

- `GET /bii/viabilidade-financeira/parametros`: padrões editáveis e a referência do CUB.
- `POST /bii/viabilidade-financeira` (200): calcula e devolve o resultado.
  - Nada é gravado e nenhum serviço externo é chamado.
  - Por isso fica **liberado na impersonação** do Super Usuário, igual à Fatia 4.
  - Limite de 30 requisições por minuto por IP.
  - DTO com mensagens em português; percentuais como número; `@IsObject` nos blocos.
- Meta-teste de permissões atualizado com as 2 rotas.

## 5. Integração com o Estudo de terreno (Fatia 5)

- `POST /bii/estudos` ganha o campo opcional `financeiro` (as premissas da seção 1, sem as tipologias) e `quantidade` opcional em cada tipologia.
- Sem o bloco, `financeiro: null`. Com o bloco e alguma tipologia sem quantidade → 400 "Para incluir a viabilidade financeira, informe a quantidade de unidades de todas as tipologias." (decidido na implementação: erro claro em vez de salvar sem o financeiro sem avisar).
- O resultado vai para o snapshot (`resultado.financeiro`), como foto do dia.
- Estudos antigos não têm o campo; a tela mostra "sem viabilidade financeira".
- Sem migration: o snapshot já é Json.
- O resumo executivo ganha 3 linhas: VGV, margem e valor máximo do terreno. Entra também o destaque "terreno pedido acima do valor máximo para X% de margem".

## 6. Frontend

**Aba "Viabilidade"** (`/dashboard/bii/viabilidade`)

- A tabela de tipologias ganha a coluna **Quantidade**.
- Abaixo do enquadramento entra o card novo **"Resultado financeiro"**, com 4 blocos que começam com os padrões:
  - Terreno: compra, ITBI, escritura e chave "Permuta" com o %;
  - Obra: R$/m², área construída ou fator, indiretos, contingência, e o CUB ao lado;
  - Comercial: regime de imposto, comissão, marketing;
  - Margem-alvo.
- O resultado aparece em quadro de DRE simples (VGV → deduções → receita líquida → custos → lucro), com o selo de situação e o **valor máximo do terreno** em destaque.
- Funciona em 360 px.

**Estudo de terreno**

- O passo das tipologias ganha "Incluir viabilidade financeira" (mesmos campos).
- O relatório e a versão de impressão A4 mostram o quadro.

## 7. Testes

- Unitários das contas:
  - VGV, permuta e deduções;
  - área pelo fator × área digitada;
  - valor máximo do terreno conferido com um cálculo independente (a margem resultante bate com o alvo);
  - fronteiras das situações;
  - todos os avisos;
  - área construída menor que a privativa → 400.
- Caso de uso, DTO (limites) e meta-teste de permissões.
- Estudo com e sem financeiro, e estudo antigo sem o campo.
- E2E com Playwright: tela da Viabilidade com permuta, estudo com financeiro, impressão e 360 px.

## 8. Deploy

Nenhuma migration, nenhuma dependência nova, nenhuma variável nova: só build do backend e do frontend (`rm -rf .next`).
