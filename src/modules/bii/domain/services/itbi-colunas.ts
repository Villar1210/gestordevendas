// src/modules/bii/domain/services/itbi-colunas.ts
// MAPA DE COLUNAS da planilha do ITBI (Prefeitura de SP). Funcoes PURAS.
//
// Cabecalhos CONFIRMADOS no arquivo real "GUIAS DE ITBI PAGAS (30092026).xlsx"
// (docs/bii/fatia2/ITBI_COLUNAS.md). Se a Prefeitura mudar o layout: ajustar
// SO o objeto ITBI_COLUNAS abaixo (acrescentar nomes candidatos). Cada
// candidato e comparado DEPOIS de normalizarCabecalho (sem acento, minusculo,
// sem pontuacao, espacos colapsados) - escreva o nome como aparece no arquivo,
// com acento e parenteses, que a normalizacao cuida do resto.
//
// LGPD / minimizacao: so as colunas deste mapa sao importadas. Ficam de fora
// DE PROPOSITO (nao acrescentar sem decisao do Villar): "Matricula do Imovel",
// "Cartorio de Registro", "Testada (m)", "Base de Calculo adotada" e "Valor
// Venal de Referencia (proporcional)" - e qualquer coluna desconhecida (ex.:
// nome/documento de comprador ou vendedor, se um dia aparecer).

export type CampoItbi =
  | 'sqlCadastro'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'referencia'
  | 'cep'
  | 'naturezaTransacao'
  | 'valorTransacao'
  | 'dataTransacao'
  | 'valorVenalReferencia'
  | 'proporcaoTransmitida'
  | 'tipoFinanciamento'
  | 'valorFinanciado'
  | 'situacaoSql'
  | 'areaTerreno'
  | 'fracaoIdeal'
  | 'areaConstruida'
  | 'usoIptu'
  | 'usoDescricao'
  | 'padraoIptu'
  | 'padraoDescricao'
  | 'accIptu';

// O 1o de cada lista e o nome exato do arquivo real; os demais sao variacoes
// toleradas (inclusive erro de digitacao conhecido da Prefeitura).
export const ITBI_COLUNAS: Record<CampoItbi, string[]> = {
  sqlCadastro: ['N° do Cadastro (SQL)', 'Nº do Cadastro (SQL)', 'Numero do Cadastro (SQL)'],
  logradouro: ['Nome do Logradouro'],
  numero: ['Número'],
  complemento: ['Complemento'],
  bairro: ['Bairro'],
  referencia: ['Referência'],
  cep: ['CEP'],
  naturezaTransacao: ['Natureza de Transação'],
  valorTransacao: ['Valor de Transação (declarado pelo contribuinte)'],
  dataTransacao: ['Data de Transação'],
  // ATENCAO: "Valor Venal de Referência (proporcional)" NAO entra (normaliza
  // diferente, "... referencia proporcional", entao nunca casa com este).
  valorVenalReferencia: ['Valor Venal de Referência'],
  proporcaoTransmitida: ['Proporção Transmitida (%)'],
  tipoFinanciamento: ['Tipo de Financiamento'],
  valorFinanciado: ['Valor Financiado'],
  situacaoSql: ['Situação do SQL'],
  areaTerreno: ['Área do Terreno (m2)', 'Área do Terreno (m²)'],
  fracaoIdeal: ['Fração Ideal'],
  areaConstruida: ['Área Construída (m2)', 'Área Construída (m²)'],
  usoIptu: ['Uso (IPTU)'],
  usoDescricao: ['Descrição do uso (IPTU)'],
  padraoIptu: ['Padrão (IPTU)'],
  // aba FEV-2026 do arquivo real: "Descrição do pardão (IPTU)" (sic)
  padraoDescricao: ['Descrição do padrão (IPTU)', 'Descrição do pardão (IPTU)'],
  accIptu: ['ACC (IPTU)'],
};

// Abas de apoio do arquivo (dicionario/tabelas), nunca transacoes: ignoradas
// pelo NOME mesmo que algum dia tenham um cabecalho parecido.
export const ABAS_DE_APOIO = ['LEGENDA', 'EXPLICAÇÕES', 'Tabela de USOS', 'Tabela de PADRÕES'];

export function ehAbaDeApoio(nome: string): boolean {
  const n = normalizarCabecalho(nome);
  return ABAS_DE_APOIO.some((a) => normalizarCabecalho(a) === n);
}

// Abas mensais: "JAN-2026" ... Qualquer outra aba so e importada se o
// cabecalho reconhecer logradouro + valor + data.
export function ehAbaMensal(nome: string): boolean {
  return /^[A-Za-zÇç]{3}-\d{4}$/.test(nome.trim());
}

// Sem eles a linha e descartada (e contada); sem eles no cabecalho a aba
// inteira e ignorada (e reportada).
export const CAMPOS_OBRIGATORIOS: CampoItbi[] = ['logradouro', 'valorTransacao', 'dataTransacao'];

// Quantas linhas nao vazias do topo de cada aba podem ser o cabecalho (o
// esperado e a 1a; a folga cobre uma linha de titulo acima dele).
export const MAX_LINHAS_PROCURANDO_CABECALHO = 5;

export function normalizarCabecalho(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const CANDIDATO_PARA_CAMPO: Map<string, CampoItbi> = (() => {
  const mapa = new Map<string, CampoItbi>();
  for (const [campo, nomes] of Object.entries(ITBI_COLUNAS) as [CampoItbi, string[]][]) {
    for (const nome of nomes) {
      const chave = normalizarCabecalho(nome);
      if (chave && !mapa.has(chave)) mapa.set(chave, campo);
    }
  }
  return mapa;
})();

export type MapaColunas = Partial<Record<CampoItbi, number>>;

// ORDEM PADRAO das 28 colunas do arquivo da Prefeitura (indice 0..27; null =
// coluna que NAO e importada - minimizacao). Usada para desempatar nome
// repetido no cabecalho (2022: "ACC (IPTU)" duas vezes) e para abas mensais
// sem linha de cabecalho (2024: JAN-2024, OUT-2024).
export const ORDEM_PADRAO: (CampoItbi | null)[] = [
  'sqlCadastro', // 1  N° do Cadastro (SQL)
  'logradouro', // 2  Nome do Logradouro
  'numero', // 3  Número
  'complemento', // 4  Complemento
  'bairro', // 5  Bairro
  'referencia', // 6  Referência
  'cep', // 7  CEP
  'naturezaTransacao', // 8  Natureza de Transação
  'valorTransacao', // 9  Valor de Transação (declarado pelo contribuinte)
  'dataTransacao', // 10 Data de Transação
  'valorVenalReferencia', // 11 Valor Venal de Referência
  'proporcaoTransmitida', // 12 Proporção Transmitida (%)
  null, // 13 Valor Venal de Referência (proporcional) - NAO importar
  null, // 14 Base de Cálculo adotada - NAO importar
  'tipoFinanciamento', // 15 Tipo de Financiamento
  'valorFinanciado', // 16 Valor Financiado
  null, // 17 Cartório de Registro - NAO importar
  null, // 18 Matrícula do Imóvel - NAO importar
  'situacaoSql', // 19 Situação do SQL
  'areaTerreno', // 20 Área do Terreno (m2)
  null, // 21 Testada (m) - NAO importar
  'fracaoIdeal', // 22 Fração Ideal
  'areaConstruida', // 23 Área Construída (m2)
  'usoIptu', // 24 Uso (IPTU)
  'usoDescricao', // 25 Descrição do uso (IPTU)
  'padraoIptu', // 26 Padrão (IPTU)
  'padraoDescricao', // 27 Descrição do padrão (IPTU)
  'accIptu', // 28 ACC (IPTU)
];

export const MAPA_PADRAO: MapaColunas = Object.fromEntries(
  ORDEM_PADRAO.map((campo, i) => [campo, i] as const).filter(([campo]) => campo !== null),
) as MapaColunas;

export interface DeteccaoCabecalho {
  mapa: MapaColunas; // campo -> indice da coluna na linha
  faltandoObrigatorios: CampoItbi[];
  colunasIgnoradas: number; // so a QUANTIDADE (o nome pode ser dado pessoal)
}

// valores = celulas da linha (indice 0..n). Nome repetido: vale a coluna que
// esta na POSICAO PADRAO daquele campo; a outra ocorrencia assume o campo da
// ordem padrao daquela posicao (se ele ainda nao foi achado pelo nome) - caso
// do 2022, em que a coluna 27 ("Descricao do padrao") veio rotulada "ACC
// (IPTU)". Sem posicao padrao que resolva, vale a 1a ocorrencia.
export function detectarColunas(valores: unknown[]): DeteccaoCabecalho {
  const ocorrencias = new Map<CampoItbi, number[]>();
  let colunasIgnoradas = 0;
  valores.forEach((valor, indice) => {
    const chave = normalizarCabecalho(valor);
    if (!chave) return;
    const campo = CANDIDATO_PARA_CAMPO.get(chave);
    if (!campo) {
      colunasIgnoradas++;
      return;
    }
    ocorrencias.set(campo, [...(ocorrencias.get(campo) ?? []), indice]);
  });

  const mapa: MapaColunas = {};
  const sobras: number[] = [];
  for (const [campo, indices] of ocorrencias) {
    const padrao = MAPA_PADRAO[campo];
    const escolhido = padrao !== undefined && indices.includes(padrao) ? padrao : indices[0];
    mapa[campo] = escolhido;
    sobras.push(...indices.filter((i) => i !== escolhido));
  }
  for (const i of sobras) {
    const campoDaPosicao = ORDEM_PADRAO[i];
    if (campoDaPosicao && mapa[campoDaPosicao] === undefined) mapa[campoDaPosicao] = i;
  }
  return {
    mapa,
    faltandoObrigatorios: CAMPOS_OBRIGATORIOS.filter((c) => mapa[c] === undefined),
    colunasIgnoradas,
  };
}

// Aba mensal SEM linha de cabecalho (2024): a 1a linha ja e dado quando a
// coluna 2 (logradouro) e texto e a coluna 9 (valor) e numero.
export function linhaPareceDado(valores: unknown[]): boolean {
  const logradouro = valores[1];
  const valor = valores[8];
  return (
    typeof logradouro === 'string' &&
    logradouro.trim() !== '' &&
    normalizarCabecalho(logradouro) !== normalizarCabecalho('Nome do Logradouro') &&
    typeof valor === 'number' &&
    Number.isFinite(valor)
  );
}

export function linhaVazia(valores: unknown[]): boolean {
  return valores.every((v) => v === null || v === undefined || String(v).trim() === '');
}
