import {
  CARGOS_QUE_ALTERAM_STATUS,
  podeAlterarStatusUnidade,
  verificarEdicaoCadastroImovel,
} from './permissao-imovel';

describe('podeAlterarStatusUnidade (R1)', () => {
  it('Administrador sempre pode (com ou sem cargo)', () => {
    expect(podeAlterarStatusUnidade('Administrador', null)).toBe(true);
    expect(podeAlterarStatusUnidade('Administrador', 'corretor')).toBe(true);
  });

  it.each(CARGOS_QUE_ALTERAM_STATUS)('Corretor com cargo %s pode', (cargo) => {
    expect(podeAlterarStatusUnidade('Corretor', cargo)).toBe(true);
  });

  it('lista de cargos e exatamente a decidida', () => {
    expect([...CARGOS_QUE_ALTERAM_STATUS].sort()).toEqual(
      ['coordenador', 'diretor', 'diretor_regional', 'gerente', 'gerente_regional', 'superintendente'].sort(),
    );
  });

  it.each([
    ['Corretor', 'corretor'],
    ['Corretor', null],
    ['Corretor', undefined],
    ['Corretor', ''],
    ['Corretor', 'cargo_inventado'],
    ['Corretor Parceiro', null],
    ['Cliente', 'gerente'],
    [undefined, 'gerente'],
  ])('role %s / cargo %s NAO pode', (role, cargo) => {
    expect(podeAlterarStatusUnidade(role, cargo)).toBe(false);
  });

  it('Corretor Parceiro com cargo de gestao tambem pode (regra e por cargo)', () => {
    expect(podeAlterarStatusUnidade('Corretor Parceiro', 'gerente')).toBe(true);
  });
});

describe('verificarEdicaoCadastroImovel (R2)', () => {
  const corretor = { userId: 'u-1', role: 'Corretor' };

  it('dono com imovel nao publicado: ok', () => {
    expect(verificarEdicaoCadastroImovel(corretor, { criadoPorUserId: 'u-1', publicado: false })).toBeNull();
  });

  it('dono com imovel publicado: ja_publicado', () => {
    expect(verificarEdicaoCadastroImovel(corretor, { criadoPorUserId: 'u-1', publicado: true })).toBe('ja_publicado');
  });

  it('outro corretor: nao_e_dono', () => {
    expect(verificarEdicaoCadastroImovel(corretor, { criadoPorUserId: 'u-2', publicado: false })).toBe('nao_e_dono');
  });

  it('imovel sem dono (antigo/lote/book): so admin', () => {
    expect(verificarEdicaoCadastroImovel(corretor, { criadoPorUserId: null, publicado: false })).toBe('nao_e_dono');
    expect(
      verificarEdicaoCadastroImovel({ userId: 'a', role: 'Administrador' }, { criadoPorUserId: null, publicado: true }),
    ).toBeNull();
  });

  it('Corretor Parceiro dono segue a mesma regra', () => {
    const parceiro = { userId: 'p-1', role: 'Corretor Parceiro' };
    expect(verificarEdicaoCadastroImovel(parceiro, { criadoPorUserId: 'p-1', publicado: false })).toBeNull();
    expect(verificarEdicaoCadastroImovel(parceiro, { criadoPorUserId: 'p-1', publicado: true })).toBe('ja_publicado');
  });
});
