// Nivel 2 da captura automatica de lead minimo (funil de remarketing): a
// VIVI deve confirmar proativamente o nome sugerido pelo pushName do
// WhatsApp em vez de perguntar do zero - so quando o parametro e
// preenchido (conversation.nomeColetado ainda vazio, ver
// ProcessIncomingMessageUseCase).
import { buildViviSystemPrompt, ViviPromptConfig } from './vivi-prompt';

const baseConfig: ViviPromptConfig = {
  precoMinimo: 200000,
  limiteSemPerfil: 2000,
  limiteFaixa1: 2850,
  limiteFaixa2: 4700,
  limiteFaixa3: 8600,
  limiteFaixa4: 12000,
  faixa1SubsidioMax: 55000,
  faixa1JurosMin: 4,
  faixa1JurosMax: 5,
  faixa1TetoFinanciamento: null,
  faixa2SubsidioMax: 30000,
  faixa2JurosMin: 5,
  faixa2JurosMax: 6,
  faixa2TetoFinanciamento: null,
  faixa3SubsidioMax: null,
  faixa3JurosMin: 7.66,
  faixa3JurosMax: 7.66,
  faixa3TetoFinanciamento: null,
  faixa4SubsidioMax: null,
  faixa4JurosMin: 9,
  faixa4JurosMax: 10,
  faixa4TetoFinanciamento: null,
};

describe('buildViviSystemPrompt - Nivel 2 (nome sugerido pelo pushName)', () => {
  it('sem nomeSugerido: NAO inclui a secao de confirmacao de nome', () => {
    const prompt = buildViviSystemPrompt(baseConfig);
    expect(prompt).not.toContain('Nome sugerido pelo contato');
  });

  it('com nomeSugerido: inclui a secao pedindo confirmacao proativa, com o nome certo', () => {
    const prompt = buildViviSystemPrompt(baseConfig, undefined, 'Daniel');
    expect(prompt).toContain('Nome sugerido pelo contato');
    // O texto quebra linha dentro do template (irrelevante para a IA ler,
    // mas o teste normaliza espacos/quebras antes de comparar).
    expect(prompt.replace(/\s+/g, ' ')).toContain('Vi que seu nome e Daniel, correto?');
  });

  it('nomeSugerido vazio/so espacos: tratado como ausente', () => {
    const prompt = buildViviSystemPrompt(baseConfig, undefined, '   ');
    expect(prompt).not.toContain('Nome sugerido pelo contato');
  });
});
