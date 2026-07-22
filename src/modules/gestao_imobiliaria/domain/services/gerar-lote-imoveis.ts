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
  bloco: string;
  andar: number;
  numeroNoAndar: number;
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
  customFields: { tipologia: string };
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
