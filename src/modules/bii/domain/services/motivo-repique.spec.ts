import { chaveMotivo, rotuloMotivo } from './motivo-repique';

describe('motivo-repique (rotulos)', () => {
  it('rotulos conhecidos', () => {
    expect(rotuloMotivo('PRECO')).toBe('Preço (fora do orçamento do lead)');
    expect(rotuloMotivo('SEM_RESPOSTA_90_DIAS')).toBe('Sem resposta há 90+ dias');
  });
  it('nulo/vazio = Não informado', () => {
    expect(chaveMotivo(null)).toBe('NAO_INFORMADO');
    expect(chaveMotivo('  ')).toBe('NAO_INFORMADO');
    expect(rotuloMotivo(undefined)).toBe('Não informado');
  });
  it('motivo desconhecido: devolve o valor cru', () => {
    expect(rotuloMotivo('NOVO_MOTIVO')).toBe('NOVO_MOTIVO');
  });
});
