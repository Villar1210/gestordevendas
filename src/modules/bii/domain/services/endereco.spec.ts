import {
  consultaGeocodeItbi,
  extrairCep,
  limparEnderecoDigitado,
  montarEnderecoChave,
  normalizarBairro,
  normalizarBasico,
  normalizarCep,
  normalizarEnderecoLivre,
  normalizarLogradouro,
  normalizarNumero,
  prefixoCep,
  separarEnderecoChave,
} from './endereco';

describe('endereco - normalizacao', () => {
  it('normalizarBasico: sem acento, minusculo, pontuacao vira espaco', () => {
    expect(normalizarBasico('  Avenida  São João, 1.000 ')).toBe('avenida sao joao 1 000');
    expect(normalizarBasico(null)).toBe('');
  });

  it.each([
    ['R TERESINA', 'rua teresina'],
    ['Rua Teresina', 'rua teresina'],
    ['R. Teresina', 'rua teresina'],
    ['AV PRESTES MAIA', 'avenida prestes maia'],
    ['Av. Prestes Maia', 'avenida prestes maia'],
    ['AL SANTOS', 'alameda santos'],
    ['PCA DA SE', 'praca da se'],
    ['Travessa Ávila', 'travessa avila'],
    ['ESTR DO ALVARENGA', 'estrada do alvarenga'],
    ['VERGUEIRO', 'vergueiro'],
  ])('normalizarLogradouro(%s) = %s', (entrada, saida) => {
    expect(normalizarLogradouro(entrada)).toBe(saida);
  });

  it('nao expande abreviacao no meio do nome', () => {
    expect(normalizarLogradouro('R DR AV LIMA')).toBe('rua dr av lima');
  });

  it('normalizarNumero: so digitos, sem zero a esquerda; vazio -> null', () => {
    expect(normalizarNumero('0071')).toBe('71');
    expect(normalizarNumero(1500)).toBe('1500');
    expect(normalizarNumero('S/N')).toBeNull();
    expect(normalizarNumero('0')).toBeNull();
    expect(normalizarNumero(null)).toBeNull();
  });

  it('normalizarCep: 8 digitos; numero do Excel com zero perdido; invalido -> null', () => {
    expect(normalizarCep('03277-000')).toBe('03277000');
    expect(normalizarCep(5662000)).toBe('05662000');
    expect(normalizarCep('123')).toBeNull();
    expect(normalizarCep('00000000')).toBeNull();
    expect(prefixoCep('03277000')).toBe('03277');
    expect(prefixoCep(null)).toBeNull();
  });

  it('normalizarBairro', () => {
    expect(normalizarBairro('Vila Ema')).toBe('vila ema');
    expect(normalizarBairro('  ')).toBeNull();
  });

  it('enderecoChave: abreviacoes e acentos diferentes viram a mesma chave', () => {
    const a = montarEnderecoChave('R TERESINA', '71', '05662000');
    const b = montarEnderecoChave('Rua Teresína', '71', '05662000');
    expect(a).toBe('rua teresina|71|05662000');
    expect(b).toBe(a);
    expect(montarEnderecoChave('R TERESINA', null, null)).toBe('rua teresina||');
  });

  it('separarEnderecoChave e consultaGeocodeItbi (sem CEP na consulta)', () => {
    expect(separarEnderecoChave('rua teresina|71|05662000')).toEqual({ logradouro: 'rua teresina', numero: '71', cep: '05662000' });
    expect(separarEnderecoChave('rua teresina||')).toEqual({ logradouro: 'rua teresina', numero: null, cep: null });
    expect(consultaGeocodeItbi('rua teresina|71|05662000')).toBe('rua teresina 71, Sao Paulo, SP, Brasil');
    expect(consultaGeocodeItbi('rua teresina||')).toBe('rua teresina, Sao Paulo, SP, Brasil');
    expect(consultaGeocodeItbi('||')).toBeNull();
  });

  it('endereco digitado: remove controle/bidi e colapsa espacos', () => {
    expect(limparEnderecoDigitado('Rua X,\n 10‮  ')).toBe('Rua X, 10');
    expect(normalizarEnderecoLivre('Rua São  José, 10')).toBe(normalizarEnderecoLivre('rua sao jose 10'));
  });

  it('extrairCep: so quando aparece no texto (nunca inventa)', () => {
    expect(extrairCep('Rua Ibitirama, Vila Prudente, São Paulo, 03134-000, Brasil')).toBe('03134000');
    expect(extrairCep('Rua Ibitirama, São Paulo, Brasil')).toBeNull();
    expect(extrairCep(null)).toBeNull();
  });
});
