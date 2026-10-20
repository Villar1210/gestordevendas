// src/modules/bii/domain/services/endereco.ts
// Normalizacao de endereco (ITBI e endereco digitado) e chave de ligacao com o
// cache de geocodificacao. Funcoes PURAS (sem Nest/Prisma/libs).
//
// enderecoChave = "<logradouro normalizado>|<numero>|<cep 8 digitos>"
// (numero/cep vazios quando nao existem). Muitas guias do mesmo predio geram a
// mesma chave -> 1 consulta de geocodificacao para todas.

// Sem acento, minusculo, pontuacao vira espaco, espacos colapsados.
export function normalizarBasico(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Abreviacoes de TIPO de logradouro (so na 1a palavra). "r vergueiro" e
// "rua vergueiro" viram a mesma chave.
const TIPOS_LOGRADOURO: Record<string, string> = {
  r: 'rua',
  rua: 'rua',
  av: 'avenida',
  ava: 'avenida',
  avn: 'avenida',
  avenida: 'avenida',
  al: 'alameda',
  alameda: 'alameda',
  pc: 'praca',
  pca: 'praca',
  praca: 'praca',
  tv: 'travessa',
  trav: 'travessa',
  travessa: 'travessa',
  estr: 'estrada',
  est: 'estrada',
  estrada: 'estrada',
  rod: 'rodovia',
  rodovia: 'rodovia',
  lg: 'largo',
  lgo: 'largo',
  largo: 'largo',
  vd: 'viaduto',
  viaduto: 'viaduto',
  vl: 'vila',
  pq: 'parque',
  pque: 'parque',
  jd: 'jardim',
  jard: 'jardim',
  bc: 'beco',
  pte: 'ponte',
  pass: 'passagem',
  ves: 'viela',
  vla: 'viela',
  viela: 'viela',
};

export function normalizarLogradouro(logradouro: string | null | undefined): string {
  const base = normalizarBasico(logradouro);
  if (!base) return '';
  const [primeira, ...resto] = base.split(' ');
  const tipo = TIPOS_LOGRADOURO[primeira];
  return tipo ? [tipo, ...resto].join(' ') : base;
}

// So digitos, sem zeros a esquerda. "S/N", "0", vazio -> null.
export function normalizarNumero(numero: string | number | null | undefined): string | null {
  if (numero === null || numero === undefined) return null;
  const digitos = String(numero).replace(/\D/g, '').replace(/^0+/, '');
  return digitos ? digitos.slice(0, 10) : null;
}

// CEP com exatamente 8 digitos (aceita "03277-000", "3277000" numerico com
// zero a esquerda perdido no Excel). Qualquer outra coisa -> null.
export function normalizarCep(cep: string | number | null | undefined): string | null {
  if (cep === null || cep === undefined) return null;
  let digitos = String(cep).replace(/\D/g, '');
  if (typeof cep === 'number' && digitos.length === 7) digitos = `0${digitos}`;
  return /^\d{8}$/.test(digitos) && digitos !== '00000000' ? digitos : null;
}

export function prefixoCep(cep: string | null | undefined): string | null {
  return cep && /^\d{8}$/.test(cep) ? cep.slice(0, 5) : null;
}

// Campo "Bairro" do ITBI as vezes traz pedaco do complemento ("E 3 VAGAS",
// "TORRE B", "BL 02", "123"). Esses viram bairro NULO (o valor cru nao e
// guardado). Regra (QA-2): 1a palavra TORRE, TR, BLOCO, BL, APTO, AP, VAGA,
// VGS -> invalido; "E " + digito ou so digitos -> invalido. CASA e CJ so quando
// sozinhos ou seguidos de numero ("CASA 02", "CJ 221"): "CASA VERDE",
// "CASA VERDE ALTA", "CJ HAB JOSE BONIFACIO" e "CJ RES ..." sao bairros reais
// de SP (3.726 guias no ITBI 2022-2026).
const PREFIXOS_COMPLEMENTO = new Set(['torre', 'tr', 'bloco', 'bl', 'apto', 'ap', 'vaga', 'vgs']);
const PREFIXOS_SO_COM_NUMERO = new Set(['casa', 'cj']);

export function bairroPareceComplemento(normalizado: string): boolean {
  if (!normalizado) return true;
  if (/^[0-9 ]+$/.test(normalizado)) return true;
  if (/^e \d/.test(normalizado)) return true;
  const [primeira, segunda] = normalizado.split(' ');
  if (PREFIXOS_COMPLEMENTO.has(primeira)) return true;
  if (PREFIXOS_SO_COM_NUMERO.has(primeira)) return segunda === undefined || /^\d/.test(segunda);
  return false;
}

export function normalizarBairro(bairro: string | null | undefined): string | null {
  const b = normalizarBasico(bairro);
  return b && !bairroPareceComplemento(b) ? b.slice(0, 100) : null;
}

export function montarEnderecoChave(logradouro: string, numero: string | null, cep: string | null): string {
  return `${normalizarLogradouro(logradouro).slice(0, 230)}|${numero ?? ''}|${cep ?? ''}`;
}

export function separarEnderecoChave(chave: string): { logradouro: string; numero: string | null; cep: string | null } {
  const [logradouro = '', numero = '', cep = ''] = chave.split('|');
  return { logradouro, numero: numero || null, cep: cep || null };
}

// Texto enviado ao geocodificador para um endereco do ITBI. CEP fica de fora
// de proposito: o Nominatim e fraco em CEP brasileiro e costuma piorar o
// resultado; a cidade fixa + viewbox ja orientam a busca.
export function consultaGeocodeItbi(chave: string): string | null {
  const { logradouro, numero } = separarEnderecoChave(chave);
  if (!logradouro) return null;
  return `${logradouro}${numero ? ` ${numero}` : ''}, Sao Paulo, SP, Brasil`;
}

// Endereco digitado pelo usuario: so texto (sem quebra de linha/controle),
// espacos colapsados. Usado como consulta e (normalizado) como chave do cache.
export function limparEnderecoDigitado(texto: string): string {
  return texto
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarEnderecoLivre(texto: string): string {
  return normalizarBasico(limparEnderecoDigitado(texto));
}

// Primeiro CEP (99999-999 ou 99999999) que aparecer no texto - ex. no
// display_name do Nominatim. Nao inventa: sem CEP no texto -> null.
export function extrairCep(texto: string | null | undefined): string | null {
  const m = (texto ?? '').match(/(?:^|\D)(\d{5})-?(\d{3})(?:\D|$)/);
  return m ? normalizarCep(`${m[1]}${m[2]}`) : null;
}
