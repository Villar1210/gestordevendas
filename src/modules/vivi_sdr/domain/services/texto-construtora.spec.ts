import { escolherTextoConstrutora } from './texto-construtora';
import { buildViviSystemPrompt } from '../../constants/vivi-prompt';

// Config minima da VIVI (so os campos que o prompt le). Nao usa
// test/factories/vivi-config-record.factory.ts: aquela factory esta
// desatualizada (sem diasParaRotting - falha pre-existente, ver CLAUDE.md).
const CONFIG_VIVI = {
  precoMinimo: 200000,
  limiteSemPerfil: 2000,
  limiteFaixa1: 2850,
  limiteFaixa2: 4700,
  limiteFaixa3: 8600,
  limiteFaixa4: 12000,
  faixa1SubsidioMax: null,
  faixa1JurosMin: null,
  faixa1JurosMax: null,
  faixa1TetoFinanciamento: null,
  faixa2SubsidioMax: null,
  faixa2JurosMin: null,
  faixa2JurosMax: null,
  faixa2TetoFinanciamento: null,
  faixa3SubsidioMax: null,
  faixa3JurosMin: null,
  faixa3JurosMax: null,
  faixa3TetoFinanciamento: null,
  faixa4SubsidioMax: null,
  faixa4JurosMin: null,
  faixa4JurosMax: null,
  faixa4TetoFinanciamento: null,
};

const padrao = { sobreConstrutora: 'Sobre padrao.', diferenciaisConstrutora: 'Diferenciais padrao.' };

describe('escolherTextoConstrutora (Construtoras, Fatia B)', () => {
  it('construtora do empreendimento com texto: usa o dela, com o nome', () => {
    expect(
      escolherTextoConstrutora({ nome: ' Novolar ', sobre: ' Sobre Novolar ', diferenciais: null }, padrao),
    ).toEqual({
      nomeConstrutora: 'Novolar',
      sobreConstrutora: 'Sobre Novolar',
      diferenciaisConstrutora: null,
      origem: 'empreendimento',
    });
  });

  it('sem construtora ou construtora sem texto: texto padrao, sem nome', () => {
    const esperado = { nomeConstrutora: null, ...padrao, origem: 'padrao' };
    expect(escolherTextoConstrutora(null, padrao)).toEqual(esperado);
    expect(escolherTextoConstrutora({ nome: 'Riva', sobre: '  ', diferenciais: null }, padrao)).toEqual(esperado);
  });

  it('padrao vazio e sem construtora: bloco some do prompt', () => {
    const texto = escolherTextoConstrutora(null, {});
    const config = { ...CONFIG_VIVI, sobreConstrutora: null, diferenciaisConstrutora: null };
    expect(buildViviSystemPrompt({ ...config, ...texto })).not.toContain('Sobre a construtora/incorporadora');
  });
});
