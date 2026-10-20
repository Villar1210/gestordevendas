import { ehEtapaGanho, ehEtapaPerda, normalizarTexto } from './normalizar';

describe('normalizar', () => {
  it('remove acento, caixa e espacos', () => {
    expect(normalizarTexto('  Negociação ÁGIL ')).toBe('negociacao agil');
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
  });

  it.each(['Fechamento', 'FECHAMENTO', ' fechamento ', 'Fechaménto'])('ganho: %p', (nome) => {
    expect(ehEtapaGanho(nome)).toBe(true);
  });

  it.each(['Repique', 'REPIQUE', 'repiqué'])('perda: %p', (nome) => {
    expect(ehEtapaPerda(nome)).toBe(true);
  });

  it('outras etapas nao sao ganho nem perda', () => {
    expect(ehEtapaGanho('Fechamento 2')).toBe(false);
    expect(ehEtapaGanho('Em Atendimento')).toBe(false);
    expect(ehEtapaPerda('Pre-Repique')).toBe(false);
    expect(ehEtapaGanho(null)).toBe(false);
  });
});
