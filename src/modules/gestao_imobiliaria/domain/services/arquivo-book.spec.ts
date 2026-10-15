import { detectarTipoArquivoBook, lerDimensoesJpeg } from './arquivo-book';
import { caracteresUteis, selecionarPaginasParaFicha } from './book-empreendimento';

describe('arquivo do book', () => {
  it('detecta o tipo pelo conteudo, nao pela extensao', () => {
    expect(detectarTipoArquivoBook(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(detectarTipoArquivoBook(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectarTipoArquivoBook(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('outro');
    expect(detectarTipoArquivoBook(Buffer.from('texto qualquer'))).toBe('outro');
  });

  it('le largura/altura do SOF sem decodificar; cabecalho invalido -> null', () => {
    const sof = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0xe8, 0x07, 0xd0]);
    expect(lerDimensoesJpeg(Buffer.concat([sof, Buffer.alloc(12)]))).toEqual({ largura: 2000, altura: 1000 });
    expect(lerDimensoesJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]))).toBeNull();
    expect(lerDimensoesJpeg(Buffer.from('nao e jpeg'))).toBeNull();
  });
});

describe('selecao de paginas para a ficha', () => {
  it('prioriza ficha_tecnica, planta, area_comum, localizacao, fachada e limita a 10', () => {
    const paginas = [
      { numero: 1, categoria: 'fachada' },
      { numero: 2, categoria: 'descartar' },
      { numero: 3, categoria: 'localizacao' },
      { numero: 4, categoria: 'area_comum' },
      { numero: 5, categoria: 'planta' },
      { numero: 6, categoria: 'ficha_tecnica' },
      { numero: 7, categoria: 'decorado' },
    ];
    expect(selecionarPaginasParaFicha(paginas)).toEqual([6, 5, 4, 3, 1]);
    expect(selecionarPaginasParaFicha(paginas, 2)).toEqual([6, 5]);
  });

  it('sem nenhuma pagina relevante (IA falhou): usa as primeiras paginas', () => {
    const paginas = Array.from({ length: 15 }, (_, i) => ({ numero: i + 1, categoria: 'descartar' }));
    expect(selecionarPaginasParaFicha(paginas)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('conta so caracteres uteis', () => {
    expect(caracteresUteis([{ texto: '  a   b \n\n' }, { texto: '' }])).toBe(3);
  });
});
