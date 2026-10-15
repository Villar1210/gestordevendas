// src/modules/gestao_imobiliaria/domain/services/imagem-book.interface.ts
// Camada de DOMINIO: contrato para tratar as imagens JPG do book sem saber
// qual biblioteca decodifica/codifica (hoje @napi-rs/canvas, na infra).

export interface ImagemJpegBook {
  jpeg: Buffer;
  largura: number;
  altura: number;
}

export interface IImagemBookService {
  // Para cada JPEG: aplica a orientacao EXIF, reduz para no maximo
  // larguraMaxPx (mantendo a proporcao, nunca amplia), fundo branco e
  // re-codifica em JPEG na qualidade pedida. O resultado NAO tem EXIF
  // (localizacao do celular, modelo, data...). Mesma ordem da entrada.
  // Quem chama ja validou o tipo e o tamanho em pixels pelo cabecalho.
  redimensionarJpegs(
    jpegs: Buffer[],
    opcoes: { larguraMaxPx: number; qualidadeJpeg: number },
  ): Promise<ImagemJpegBook[]>;
}
