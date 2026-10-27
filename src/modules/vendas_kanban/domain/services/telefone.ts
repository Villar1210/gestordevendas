// src/modules/vendas_kanban/domain/services/telefone.ts
// Camada de DOMINIO (funcoes puras). Fase B do mapa de processos (27/10/2026):
// "o mesmo cliente nao vira 2 ou 3 cards". O telefone chega em formatos
// diferentes conforme o canal ("5511973879858", "(11) 97387-9858",
// "11 7387-9858"...), entao a comparacao usa uma CHAVE normalizada:
// - so digitos; tira o DDI 55; tira o 9 do celular (DDD + 9 + 8 digitos)
//   -> DDD + 8 digitos (10 digitos). Assim "11 97387-9858" e "1173879858"
//   sao o mesmo cliente.
// - identificador que nao e telefone (ex.: id do Instagram/Facebook, que e
//   numerico e longo) fica so com os digitos, comparado por inteiro.
// - menos de 10 digitos: nao da para afirmar que e telefone -> texto
//   original aparado (comparacao exata).
export function chaveTelefone(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto) return null;

  const digitos = texto.replace(/\D/g, '');
  if (digitos.length < 10) return texto.toLowerCase();

  let numero = digitos;
  if ((numero.length === 12 || numero.length === 13) && numero.startsWith('55')) {
    numero = numero.slice(2);
  }
  if (numero.length === 11 && numero[2] === '9') {
    numero = numero.slice(0, 2) + numero.slice(3);
  }
  return numero.length === 10 ? numero : digitos;
}

// Trecho usado para pre-filtrar candidatos no banco (contains): os 4 ultimos
// digitos aparecem juntos em qualquer formatacao comum do numero. A
// comparacao final e sempre pela chave completa (chaveTelefone).
export function trechoBuscaTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length >= 4 ? digitos.slice(-4) : valor.trim();
}

export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = chaveTelefone(a);
  return ca !== null && ca === chaveTelefone(b);
}
