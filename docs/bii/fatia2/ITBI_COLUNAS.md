# ITBI da Prefeitura de SP — estrutura real do arquivo

Conferido em 20/10/2026 no arquivo `GUIAS DE ITBI PAGAS (30092026).xlsx` (31,9 MB, dados de jan a set/2026, baixado pelo Villar da página da Secretaria da Fazenda).

## Abas
- Abas mensais com nome `MMM-AAAA` (`JAN-2026` … `AGO-2026` neste arquivo): cabeçalho na 1ª linha, uma guia de ITBI por linha. 14.735 a 22.561 linhas por mês; **155.906 linhas** em 8 abas.
- Abas de apoio, que NÃO são transações e devem ser ignoradas: `LEGENDA`, `EXPLICAÇÕES` (dicionário dos campos), `Tabela de USOS`, `Tabela de PADRÕES`.

## Colunas (28, mesma ordem em todas as abas mensais)
| # | Cabeçalho exato | Tipo no arquivo | Usar no BII |
|---|---|---|---|
| 1 | N° do Cadastro (SQL) | número (11 dígitos; perde zeros à esquerda) | sim (`sql`, texto com padStart 11) |
| 2 | Nome do Logradouro | texto ("R TERESINA", "AV PRESTES MAIA") | sim |
| 3 | Número | número; **99999 e 0 = sem número** (22.681 linhas com 99999) | sim (null nesses casos) |
| 4 | Complemento | texto ("AP 162 E 2VGS") | sim |
| 5 | Bairro | texto, às vezes nulo ou com lixo (ex. "E 3 VAGAS") | sim (não confiar para filtro sozinho) |
| 6 | Referência | texto (nome do condomínio) | sim |
| 7 | CEP | número **sem zero à esquerda** (5662000 = 05662-000) | sim (padStart 8) |
| 8 | Natureza de Transação | texto "1.Compra e venda", "20.Realização ou integralização de capital " (com espaço no fim) | sim (código numérico + descrição) |
| 9 | Valor de Transação (declarado pelo contribuinte) | número | sim (obrigatório) |
| 10 | Data de Transação | **número serial do Excel** (46010 = 19/12/2025) | sim (obrigatório) |
| 11 | Valor Venal de Referência | número | sim |
| 12 | Proporção Transmitida (%) | número 0–100 | sim |
| 13 | Valor Venal de Referência (proporcional) | número | não |
| 14 | Base de Cálculo adotada | número | não |
| 15 | Tipo de Financiamento | texto ("1.Sistema Financeiro de Habitação", "2.Minha Casa Minha Vida", "3.Consórcio", "99.SFI, Carteira Hipotecária, etc") ou vazio | sim |
| 16 | Valor Financiado | número | sim |
| 17 | Cartório de Registro | texto | não |
| 18 | Matrícula do Imóvel | número | **não** (identifica o imóvel no registro; dispensável para análise — minimização) |
| 19 | Situação do SQL | "Ativo Predial", "Ativo Territorial", "Cancelado Predial", "Cancelado Territorial", "Não_Existe_Exercício" | sim |
| 20 | Área do Terreno (m2) | número | sim |
| 21 | Testada (m) | número | não |
| 22 | Fração Ideal | número 0–1 | sim |
| 23 | Área Construída (m2) | número; **0 em terreno** | sim |
| 24 | Uso (IPTU) | código numérico (ver tabela abaixo) | sim |
| 25 | Descrição do uso (IPTU) | texto | sim |
| 26 | Padrão (IPTU) | código numérico | sim |
| 27 | Descrição do padrão (IPTU) — **na aba FEV-2026 o cabeçalho vem com erro de digitação: "Descrição do pardão (IPTU)"** | texto | sim |
| 28 | ACC (IPTU) | ano de conclusão da construção | sim |

A planilha não tem nome de comprador ou vendedor (a aba LEGENDA indica que dados pessoais ou protegidos por sigilo fiscal foram retirados).

## Regras de qualidade para o BII
1. **Área construída do IPTU não é área privativa.** Em condomínio ela inclui a parte proporcional das áreas comuns. O R$/m² do BII fica **abaixo** do R$/m² de área privativa usado no mercado, e a tela precisa dizer isso.
2. **Unidades na planta.** 31.338 linhas (20%) são `Uso 0 TERRENO`, com área construída 0, quase todas `Ativo Territorial`, e muitas financiadas pelo MCMV (25.705 linhas com financiamento MCMV no total). São, em grande parte, **vendas de unidades novas** cujo SQL ainda é o do terreno: exatamente o mercado HIS/MCMV. Elas não têm R$/m², mas têm valor. O BII mostra esse grupo separado ("Unidades vendidas sem área no IPTU, em geral na planta"), com quantidade e valor mediano, sem misturar no R$/m².
3. **R$/m² só para residenciais com área > 0:** usos 10, 12, 14 (casas), 20 (apartamento em condomínio), 21, 22 (prédio de apartamentos) e 25 (flat residencial). Garagens (23, 24, 63) e não residenciais ficam fora por padrão.
4. **Natureza padrão: "1.Compra e venda"** (141.680 de 155.906 linhas). As demais naturezas (integralização de capital, dação, leilão, permuta, herança) distorcem o preço e ficam fora por padrão.
5. Para geocodificar, a chave é logradouro + número + CEP. Linhas sem número (99999/0) usam logradouro + CEP, com precisão "rua".

## Tabela de USOS (do próprio arquivo)
0 TERRENO · 10 RESIDÊNCIA · 12 RESIDÊNCIA COLETIVA · 13 CORTIÇO · 14 RESIDÊNCIA E OUTRO USO · 20 APARTAMENTO EM CONDOMÍNIO · 21 PRÉDIO DE APARTAMENTO, NÃO EM CONDOMÍNIO, RESIDENCIAL · 22 PRÉDIO DE APARTAMENTO, USO MISTO · 23 GARAGEM EM CONDOMÍNIO COMERCIAL · 24 GARAGEM EM CONDOMÍNIO RESIDENCIAL · 25 FLAT RESIDENCIAL · 26 DEPÓSITO EM CONDOMÍNIO · 30 ESCRITÓRIO EM CONDOMÍNIO · 31 PRÉDIO DE ESCRITÓRIO · 32 PRÉDIO MISTO NÃO RESIDENCIAL · 40 LOJA · 41 LOJA EM CONDOMÍNIO · 42 LOJA E RESIDÊNCIA · 43 OUTRAS · 50 INDÚSTRIA · 51 ARMAZÉNS · 60 OFICINA · 61 POSTO · 62 GARAGEM · 63 GARAGEM EM PRÉDIO DE GARAGENS · 64 OUTRAS · 70 CINEMA/CLUBE · 71 ESCOLA · 72 TEMPLO · 74 OUTRAS · 80 HOTEL · 81 HOSPITAL · 82 RÁDIO/TV · 83 ASILO/CRECHE · 84 OUTRAS · 85 FLAT COMERCIAL.

## Diferenças entre os anos (conferido nos 5 arquivos baixados pelo Villar em 20/10/2026)
| Arquivo | Abas mensais | Linhas (aprox.) | Diferença |
|---|---|---|---|
| `GUIAS_DE_ITBI_PAGAS_12-2022.xlsx` (2022) | JAN a DEZ (MAI-2022 vem primeiro) | ~164 mil | Cabeçalho da coluna 27 vem como **"ACC (IPTU)" repetido** no lugar de "Descrição do padrão (IPTU)" |
| `GUIAS-DE-ITBI-PAGAS-2023.xlsx` (2023) | JAN a DEZ | ~178 mil | igual ao padrão |
| `GUIAS-DE-ITBI-PAGAS-2024.xlsx` (2024) | JAN a DEZ | ~220 mil | **JAN-2024 e OUT-2024 não têm linha de cabeçalho** (a 1ª linha já é dado). As abas de apoio (LEGENDA etc.) vêm com ~1000 linhas vazias |
| `GUIAS DE ITBI PAGAS (28012026) XLS.xlsx` (2025) | JAN a DEZ | ~230 mil | igual ao padrão |
| `GUIAS DE ITBI PAGAS (30092026).xlsx` (2026) | JAN a AGO | ~156 mil | FEV-2026 com "Descrição do pardão (IPTU)" |

Total aproximado: **950 mil transações** em 5 anos.

Regra do importador: reconhecer o cabeçalho pelo nome. Se o mesmo nome aparecer duas vezes, valer a POSIÇÃO da ordem padrão das 28 colunas acima. Se a aba mensal (nome `MMM-AAAA`) não tiver cabeçalho reconhecível e a 1ª linha parecer dado (coluna 2 texto e coluna 9 número), usar a ordem padrão por posição e tratar a 1ª linha como dado.
