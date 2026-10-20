// src/modules/bii/domain/services/itbi-classificacao.ts
// Regras de qualidade do ITBI para a analise (docs/bii/fatia2/ITBI_COLUNAS.md,
// "Regras de qualidade"). Funcoes PURAS.

export type TipoImovelAnalise = 'residencial' | 'apartamento' | 'casa' | 'todos';

export const TIPOS_IMOVEL_ANALISE: TipoImovelAnalise[] = ['residencial', 'apartamento', 'casa', 'todos'];

// Codigos de "Uso (IPTU)" da Tabela de USOS do proprio arquivo.
export const USO_TERRENO = 0;
// 10 residencia, 12 residencia coletiva, 14 residencia e outro uso
export const USOS_CASA = [10, 12, 14];
// 20 apto em condominio, 21 predio de aptos residencial, 22 predio de aptos
// uso misto, 25 flat residencial
export const USOS_APARTAMENTO = [20, 21, 22, 25];
export const USOS_RESIDENCIAIS = [...USOS_CASA, ...USOS_APARTAMENTO];

// Natureza "1.Compra e venda" (padrao da analise; as demais distorcem preco).
export const NATUREZA_COMPRA_E_VENDA = 1;

// Faixa plausivel de R$/m2 (fora dela e descartado do calculo de
// mediana/percentis, mas a transacao continua contando).
export const PRECO_M2_MINIMO = 500;
export const PRECO_M2_MAXIMO = 60_000;

// Usos que entram no R$/m2 para cada tipo ('todos' nao inclui nao
// residenciais no R$/m2 - garagem/loja distorcem; eles so contam).
export function usosPrecoM2(tipo: TipoImovelAnalise): number[] {
  if (tipo === 'casa') return USOS_CASA;
  if (tipo === 'apartamento') return USOS_APARTAMENTO;
  return USOS_RESIDENCIAIS;
}

// Usos aceitos na contagem principal (null = qualquer uso).
export function usosDoTipo(tipo: TipoImovelAnalise): number[] | null {
  return tipo === 'todos' ? null : usosPrecoM2(tipo);
}

// Unidade "na planta": SQL ainda do terreno (uso 0) e area construida 0.
export function ehUnidadeNaPlanta(uso: number | null, areaConstruida: number | null): boolean {
  return uso === USO_TERRENO && (areaConstruida === null || areaConstruida === 0);
}

export type CategoriaFinanciamento = 'mcmv' | 'sfh' | 'outros' | 'semFinanciamento';

// "1.Sistema Financeiro de Habitacao", "2.Minha Casa Minha Vida",
// "3.Consorcio", "99.SFI, Carteira Hipotecaria, etc" ou vazio.
export function categoriaFinanciamento(codigo: number | null, descricao: string | null): CategoriaFinanciamento {
  if (codigo === 2) return 'mcmv';
  if (codigo === 1) return 'sfh';
  if (codigo !== null) return 'outros';
  const d = (descricao ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  if (!d) return 'semFinanciamento';
  if (d.includes('minha casa')) return 'mcmv';
  if (d.includes('sistema financeiro de habita')) return 'sfh';
  return 'outros';
}

export function precoM2(valor: number, areaConstruida: number | null): number | null {
  if (areaConstruida === null || !(areaConstruida > 0) || !Number.isFinite(valor)) return null;
  return valor / areaConstruida;
}

export function precoM2Plausivel(p: number | null): p is number {
  return p !== null && p >= PRECO_M2_MINIMO && p <= PRECO_M2_MAXIMO;
}
