import {
  limparNomeConstrutora,
  mensagemConstrutoraComVinculo,
  normalizarNomeConstrutora,
  siteValido,
  textoOuNull,
} from './construtora';

describe('normalizarNomeConstrutora', () => {
  it.each([
    ['Novolar', 'novolar'],
    ['NOVOLAR', 'novolar'],
    ['  novolar  ', 'novolar'],
    ['Novo   Lar', 'novo lar'],
    ['Construtora Sólida', 'construtora solida'],
    ['CONSTRUÇÃO  ÁGIL', 'construcao agil'],
    ['Ação Imóveis', 'acao imoveis'],
    ['Linha\tcom\ttab\n', 'linha com tab'],
    // Ja decomposto (e + acento combinante): mesmo resultado.
    ['José', 'jose'],
  ])('%j -> %j', (entrada, esperado) => {
    expect(normalizarNomeConstrutora(entrada)).toBe(esperado);
  });

  it('as 3 grafias da mesma construtora viram a mesma chave', () => {
    const chaves = new Set(['Novolar', 'NOVOLAR', '  novolar '].map(normalizarNomeConstrutora));
    expect(chaves.size).toBe(1);
  });
});

describe('limparNomeConstrutora', () => {
  it('mantem caixa e acento, tira espacos repetidos e das pontas', () => {
    expect(limparNomeConstrutora('  Construtora   Sólida ')).toBe('Construtora Sólida');
  });
});

describe('textoOuNull', () => {
  it('vazio/so espacos vira null', () => {
    expect(textoOuNull('   ')).toBeNull();
    expect(textoOuNull(null)).toBeNull();
    expect(textoOuNull(undefined)).toBeNull();
    expect(textoOuNull(' x ')).toBe('x');
  });
});

describe('siteValido', () => {
  it('so https, com host e sem usuario/senha', () => {
    expect(siteValido('https://novolar.com.br')).toBe(true);
    expect(siteValido('http://novolar.com.br')).toBe(false);
    expect(siteValido('javascript:alert(1)')).toBe(false);
    expect(siteValido('https://user:senha@novolar.com.br')).toBe(false);
    expect(siteValido('novolar.com.br')).toBe(false);
    expect(siteValido(`https://a.com/${'x'.repeat(260)}`)).toBe(false);
  });
});

describe('mensagemConstrutoraComVinculo', () => {
  it('singular e plural', () => {
    expect(mensagemConstrutoraComVinculo(1)).toBe(
      'Esta construtora tem 1 empreendimento. Troque a construtora deles antes de excluir.',
    );
    expect(mensagemConstrutoraComVinculo(3)).toBe(
      'Esta construtora tem 3 empreendimentos. Troque a construtora deles antes de excluir.',
    );
  });
});
