import {
  parseCodigoComZeros,
  parseCodigoDescricao,
  parseDataItbi,
  parseDecimal,
  parseInteiro,
  parseNumeroImovel,
  parseNumeroPtBr,
  parseTexto,
  serialExcelParaData,
} from './itbi-valores';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe('itbi-valores - numeros pt-BR', () => {
  it.each([
    [1234.56, 1234.56],
    ['1.234,56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['-10,5', -10.5],
    ['(10,5)', -10.5],
    ['', null],
    ['abc', null],
    ['1,2,3', null],
    [null, null],
    [true, null],
    [Number.NaN, null],
  ])('parseNumeroPtBr(%p) = %p', (entrada, saida) => {
    expect(parseNumeroPtBr(entrada as never)).toBe(saida);
  });

  it('parseDecimal e parseInteiro respeitam faixa e casas', () => {
    expect(parseDecimal('10,555', 0, 100)).toBe(10.56);
    expect(parseDecimal(101, 0, 100)).toBeNull();
    expect(parseDecimal(0.123456789012, 0, 1, 10)).toBe(0.123456789);
    expect(parseInteiro('2020', 1500, 2100)).toBe(2020);
    expect(parseInteiro(2020.5, 1500, 2100)).toBeNull();
  });
});

describe('itbi-valores - datas', () => {
  it('serial do Excel (1900): 46009 = 2025-12-18 (mesma conta do exceljs); 1 fora da faixa', () => {
    expect(iso(serialExcelParaData(46009))).toBe('2025-12-18');
    expect(iso(serialExcelParaData(46010))).toBe('2025-12-19');
    expect(iso(serialExcelParaData(45658))).toBe('2025-01-01');
    expect(serialExcelParaData(1)).toBeNull();
    expect(serialExcelParaData(-5)).toBeNull();
  });

  it('aceita Date do exceljs, serial, dd/mm/aaaa e aaaa-mm-dd; sempre meia-noite UTC', () => {
    expect(parseDataItbi(new Date(Date.UTC(2025, 7, 29)))!.toISOString()).toBe('2025-08-29T00:00:00.000Z');
    expect(iso(parseDataItbi(46009))).toBe('2025-12-18');
    expect(iso(parseDataItbi('46009'))).toBe('2025-12-18');
    expect(iso(parseDataItbi('18/12/2025'))).toBe('2025-12-18');
    expect(iso(parseDataItbi('1/2/2026 00:00:00'))).toBe('2026-02-01');
    expect(iso(parseDataItbi('2026-02-01'))).toBe('2026-02-01');
  });

  it('recusa data invalida', () => {
    expect(parseDataItbi('31/02/2026')).toBeNull();
    expect(parseDataItbi('2026-13-01')).toBeNull();
    expect(parseDataItbi('ontem')).toBeNull();
    expect(parseDataItbi(new Date('x'))).toBeNull();
    expect(parseDataItbi(null)).toBeNull();
    expect(parseDataItbi('01/01/1900')).toBeNull();
  });
});

describe('itbi-valores - textos e codigos', () => {
  it('parseTexto: limpa controle/bidi, colapsa, corta, inteiro sem notacao cientifica', () => {
    expect(parseTexto('  AP 162‮  E 2VGS ', 100)).toBe('AP 162 E 2VGS');
    expect(parseTexto('abcdef', 3)).toBe('abc');
    expect(parseTexto('   ', 10)).toBeNull();
    expect(parseTexto(12318300101, 30)).toBe('12318300101');
  });

  it('parseCodigoDescricao: "1.Compra e venda", com espaco no fim, so texto, so numero', () => {
    expect(parseCodigoDescricao('1.Compra e venda', 120)).toEqual({ codigo: 1, descricao: 'Compra e venda' });
    expect(parseCodigoDescricao('20.Realização ou integralização de capital ', 120)).toEqual({
      codigo: 20,
      descricao: 'Realização ou integralização de capital',
    });
    expect(parseCodigoDescricao('99.SFI, Carteira Hipotecária, etc', 120)).toEqual({ codigo: 99, descricao: 'SFI, Carteira Hipotecária, etc' });
    expect(parseCodigoDescricao('Permuta', 120)).toEqual({ codigo: null, descricao: 'Permuta' });
    expect(parseCodigoDescricao(2, 120)).toEqual({ codigo: 2, descricao: null });
    expect(parseCodigoDescricao(null, 120)).toEqual({ codigo: null, descricao: null });
  });

  it('parseCodigoComZeros: SQL padStart 11, CEP padStart 8', () => {
    expect(parseCodigoComZeros(12318300101, 11)).toBe('12318300101');
    expect(parseCodigoComZeros(1001200, 11)).toBe('00001001200');
    expect(parseCodigoComZeros(5662000, 8)).toBe('05662000');
    expect(parseCodigoComZeros('056.620-00', 8)).toBe('05662000');
    expect(parseCodigoComZeros(123456789012, 11)).toBeNull();
    expect(parseCodigoComZeros(0, 8)).toBeNull();
  });

  it('parseNumeroImovel: 99999 e 0 = sem numero', () => {
    expect(parseNumeroImovel(99999)).toBeNull();
    expect(parseNumeroImovel(0)).toBeNull();
    expect(parseNumeroImovel('99999')).toBeNull();
    expect(parseNumeroImovel('S/N')).toBeNull();
    expect(parseNumeroImovel(71)).toBe('71');
    expect(parseNumeroImovel('71A')).toBe('71A');
  });
});
