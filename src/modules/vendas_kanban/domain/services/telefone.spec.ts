import { chaveTelefone, mesmoTelefone, trechoBuscaTelefone } from './telefone';

describe('telefone (chave para nao duplicar cliente)', () => {
  it('mesmo celular em formatos diferentes vira a mesma chave', () => {
    const formatos = ['5511973879858', '+55 (11) 97387-9858', '11973879858', '(11) 7387-9858', '1173879858'];
    for (const f of formatos) expect(chaveTelefone(f)).toBe('1173879858');
  });

  it('fixo de 10 digitos e mantido', () => {
    expect(chaveTelefone('(11) 2345-6789')).toBe('1123456789');
    expect(chaveTelefone('551123456789')).toBe('1123456789');
  });

  it('numeros diferentes nao se confundem', () => {
    expect(mesmoTelefone('11973879858', '11973879850')).toBe(false);
    expect(mesmoTelefone('11973879858', '21973879858')).toBe(false);
  });

  it('id do Instagram (numerico longo) compara por inteiro', () => {
    expect(chaveTelefone('17841400000000001')).toBe('17841400000000001');
    expect(mesmoTelefone('17841400000000001', '17841400000000002')).toBe(false);
  });

  it('vazio nunca casa', () => {
    expect(chaveTelefone(null)).toBeNull();
    expect(chaveTelefone('  ')).toBeNull();
    expect(mesmoTelefone(null, null)).toBe(false);
  });

  it('trecho de busca usa os 4 ultimos digitos', () => {
    expect(trechoBuscaTelefone('(11) 97387-9858')).toBe('9858');
  });
});
