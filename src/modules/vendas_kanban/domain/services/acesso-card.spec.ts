// Regra de quem pode ver/alterar um card (decisao de 27/10/2026): dono,
// superiores (mesmo escopo do board) e Administrador.
import { podeAcessarCard } from './acesso-card';

const base = { requesterUserId: 'eu', idsDoEscopo: null as string[] | null };

describe('podeAcessarCard', () => {
  it("escopo 'todos' (Admin/diretor) altera qualquer card, com ou sem dono", () => {
    expect(podeAcessarCard({ ...base, escopo: 'todos', operacao: 'alterar', cardOwnerId: 'outro' })).toBe(true);
    expect(podeAcessarCard({ ...base, escopo: 'todos', operacao: 'alterar', cardOwnerId: null })).toBe(true);
  });

  it('corretor altera o proprio card e NAO o de outro corretor', () => {
    expect(podeAcessarCard({ ...base, escopo: 'proprio', operacao: 'alterar', cardOwnerId: 'eu' })).toBe(true);
    expect(podeAcessarCard({ ...base, escopo: 'proprio', operacao: 'alterar', cardOwnerId: 'outro' })).toBe(false);
    expect(podeAcessarCard({ ...base, escopo: 'proprio', operacao: 'ver', cardOwnerId: 'outro' })).toBe(false);
  });

  it('card sem dono (Caixa de Entrada): corretor ve mas nao altera; gestao altera', () => {
    expect(podeAcessarCard({ ...base, escopo: 'proprio', operacao: 'ver', cardOwnerId: null })).toBe(true);
    expect(podeAcessarCard({ ...base, escopo: 'proprio', operacao: 'alterar', cardOwnerId: null })).toBe(false);
    expect(podeAcessarCard({ ...base, escopo: 'equipe', operacao: 'alterar', cardOwnerId: null })).toBe(true);
    expect(podeAcessarCard({ ...base, escopo: 'plantao', operacao: 'alterar', cardOwnerId: null })).toBe(true);
  });

  it('gerente altera card de subordinado e nao de quem esta fora da equipe', () => {
    const entrada = { ...base, escopo: 'equipe' as const, operacao: 'alterar' as const, idsDoEscopo: ['sub-1'] };
    expect(podeAcessarCard({ ...entrada, cardOwnerId: 'sub-1' })).toBe(true);
    expect(podeAcessarCard({ ...entrada, cardOwnerId: 'eu' })).toBe(true);
    expect(podeAcessarCard({ ...entrada, cardOwnerId: 'fora' })).toBe(false);
  });

  it('coordenador altera card de corretor escalado hoje no stand dele, e so esses', () => {
    const entrada = { ...base, escopo: 'plantao' as const, operacao: 'alterar' as const, idsDoEscopo: ['escalado'] };
    expect(podeAcessarCard({ ...entrada, cardOwnerId: 'escalado' })).toBe(true);
    expect(podeAcessarCard({ ...entrada, cardOwnerId: 'nao-escalado' })).toBe(false);
  });
});
