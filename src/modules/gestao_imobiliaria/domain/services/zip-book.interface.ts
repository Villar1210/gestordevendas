// src/modules/gestao_imobiliaria/domain/services/zip-book.interface.ts
// Camada de DOMINIO: monta um ZIP em memoria com as paginas do book (sem
// saber como o ZIP e gerado).
export interface IZipBookService {
  // Nomes ja sanitizados por quem chama (nomePaginaNoZip); a implementacao
  // ainda neutraliza separadores - nenhum nome vira caminho.
  montar(arquivos: { nome: string; dados: Buffer }[]): Buffer;
}
