import { parsePageRange, parsePageRangeGroups } from './page-range';
import { PdfToolsError } from './pdf-tools.errors';

function expectInvalid(fn: () => unknown, message?: RegExp) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PdfToolsError);
    expect((error as PdfToolsError).code).toBe('INVALID_INPUT');
    if (message) expect((error as PdfToolsError).message).toMatch(message);
    return;
  }
  throw new Error('esperava PdfToolsError');
}

describe('parsePageRange', () => {
  it('converte "1-3,5,8-" em indices 0-based (aberto ate o fim)', () => {
    expect(parsePageRange('1-3,5,8-', 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
  });

  it('aceita espacos, ponto e virgula e "-3" (do inicio ate 3)', () => {
    expect(parsePageRange(' 2 , 4 - 5 ; -1', 6)).toEqual([1, 3, 4, 0]);
  });

  it('mantem a ordem digitada e remove repeticoes', () => {
    expect(parsePageRange('5,1-3,2', 5)).toEqual([4, 0, 1, 2]);
  });

  it('pagina unica', () => {
    expect(parsePageRange('1', 1)).toEqual([0]);
  });

  it('rejeita pagina alem do total com mensagem clara', () => {
    expectInvalid(() => parsePageRange('1-12', 10), /página 12 não existe.*10 páginas/);
  });

  it('rejeita zero, intervalo invertido, texto, virgula sobrando e vazio', () => {
    expectInvalid(() => parsePageRange('0', 5), /começam em 1/);
    expectInvalid(() => parsePageRange('4-2', 5), /início maior/);
    expectInvalid(() => parsePageRange('abc', 5));
    expectInvalid(() => parsePageRange('1-2-3', 5));
    expectInvalid(() => parsePageRange('1,,2', 5), /vírgula/);
    expectInvalid(() => parsePageRange('   ', 5), /Informe/);
    expectInvalid(() => parsePageRange('-', 5));
  });

  it('rejeita PDF sem paginas e especificacao gigante', () => {
    expectInvalid(() => parsePageRange('1', 0));
    expectInvalid(() => parsePageRange('1,'.repeat(400) + '1', 5), /muito longo/);
  });
});

describe('parsePageRangeGroups', () => {
  it('um grupo por intervalo', () => {
    expect(parsePageRangeGroups('1-3,4-6', 6)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  it('permite repeticao entre grupos e intervalo aberto', () => {
    expect(parsePageRangeGroups('1-2,2,3-', 4)).toEqual([[0, 1], [1], [2, 3]]);
  });
});
