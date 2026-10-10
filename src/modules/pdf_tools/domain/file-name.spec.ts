import { buildOutputFileName, sanitizeBaseName } from './file-name';

describe('sanitizeBaseName / buildOutputFileName', () => {
  it('remove acentos, extensao e caracteres proibidos', () => {
    expect(sanitizeBaseName('Contrato São João (final).pdf')).toBe('Contrato Sao Joao _final');
    expect(buildOutputFileName('contrato.pdf', 'comprimido', 'pdf')).toBe('contrato_comprimido.pdf');
  });

  it('ignora caminhos e tentativas de path traversal', () => {
    expect(sanitizeBaseName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeBaseName('C:\\fakepath\\relatorio.docx')).toBe('relatorio');
  });

  it('limita a 80 caracteres e usa fallback quando sobra nada', () => {
    expect(sanitizeBaseName('a'.repeat(200) + '.pdf')).toHaveLength(80);
    expect(sanitizeBaseName('😀😀.pdf')).toBe('documento');
    expect(sanitizeBaseName(undefined)).toBe('documento');
  });
});
