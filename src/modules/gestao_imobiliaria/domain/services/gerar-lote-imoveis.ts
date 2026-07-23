// src/modules/gestao_imobiliaria/domain/services/gerar-lote-imoveis.ts
// Camada de DOMINIO: funcoes puras, sem Prisma/NestJS. Expande um "padrao
// estrutural" (bloco + faixa de andares + tipologias por posicao no andar)
// na lista completa de unidades resultante - usada pelo cadastro em lote
// (Fatia 2) para GERAR a lista em memoria, sem persistir nada ainda.

export interface UnidadePadrao {
  posicao: number;
  tipologia: string;
  area?: number;
  dormitorios?: number;
}

export interface PadraoLoteImoveis {
  bloco: string;
  andarInicial: number;
  andarFinal: number;
  unidadesPorAndar: UnidadePadrao[];
}

export interface UnidadeGerada {
  identificadorExterno: string;
  // Nulos para VAGA_AVULSA (Fatia 3a, importacao de planilha - uma vaga
  // avulsa nao pertence a um bloco/andar/posicao da mesma forma que uma
  // unidade). O cadastro em lote manual (Fatia 2, so gera UNIDADE) nunca
  // produz nulo aqui - widening aditivo, sem mudanca de comportamento.
  bloco: string | null;
  andar: number | null;
  numeroNoAndar: number | null;
  title: string;
  tipo: string;
  finalidade: string;
  status: string;
  tipoItem: string;
  enquadramento: string;
  pcd: boolean;
  area: number | null;
  bedrooms: number | null;
  vagasIncluidas: number;
  // Preenchidos so pela importacao de planilha (Fatia 3a) - o cadastro em
  // lote manual (Fatia 2) deixa esses valores para o usuario preencher
  // depois no grid, entao nunca os popula aqui.
  valorTabela?: number | null;
  valorComDesconto?: number | null;
  // "tipologia" nao tem campo proprio no Imovel - guardada aqui para nao
  // sobrecarregar nenhum campo existente. Record<string, unknown> (nao
  // { tipologia: string } fixo) porque a importacao de planilha pode gerar
  // uma unidade sem coluna TIPOLOGIA no arquivo de origem.
  customFields: Record<string, unknown>;
}

// Zero a esquerda so no valor absoluto - andares em subsolo (negativos, ex:
// -1, -2) preservam o sinal antes do preenchimento (padStart aplicado antes
// do sinal produziria algo como "0-1", que nao faz sentido).
function comZeroEsquerda(valor: number): string {
  const sinal = valor < 0 ? '-' : '';
  return sinal + String(Math.abs(valor)).padStart(2, '0');
}

// Padrao: {bloco}-{andar com zero a esquerda}{posicao com zero a esquerda}.
// O "bloco" ja vem exatamente como o usuario digitou (ex: "BL02") - nenhum
// prefixo adicional e concatenado aqui.
export function gerarIdentificadorExterno(bloco: string, andar: number, posicao: number): string {
  return `${bloco}-${comZeroEsquerda(andar)}${comZeroEsquerda(posicao)}`;
}

// Gera a lista completa de unidades (andarInicial..andarFinal x
// unidadesPorAndar), com defaults sensatos para os campos que o usuario
// ainda vai revisar/editar no frontend (fatia seguinte) antes de confirmar
// o salvamento. "tipologia" nao tem campo proprio no Imovel - guardada em
// customFields para nao sobrecarregar nenhum campo existente.
export function gerarLoteImoveis(padrao: PadraoLoteImoveis): UnidadeGerada[] {
  const unidades: UnidadeGerada[] = [];
  for (let andar = padrao.andarInicial; andar <= padrao.andarFinal; andar++) {
    for (const unidade of padrao.unidadesPorAndar) {
      const identificadorExterno = gerarIdentificadorExterno(padrao.bloco, andar, unidade.posicao);
      unidades.push({
        identificadorExterno,
        bloco: padrao.bloco,
        andar,
        numeroNoAndar: unidade.posicao,
        title: `${unidade.tipologia} - ${identificadorExterno}`,
        tipo: 'apartamento',
        finalidade: 'venda',
        status: 'disponivel',
        tipoItem: 'unidade',
        enquadramento: 'nenhum',
        pcd: false,
        area: unidade.area ?? null,
        bedrooms: unidade.dormitorios ?? null,
        vagasIncluidas: 0,
        customFields: { tipologia: unidade.tipologia },
      });
    }
  }
  return unidades;
}
