// src/modules/gestao_imobiliaria/domain/services/book-temporario.interface.ts
// Guarda o book entre a ANALISE (IA separa as paginas) e a CONFIRMACAO (o
// usuario revisou e salvou) - assim os arquivos grandes nao sao enviados 2
// vezes. Sempre amarrado ao tenant: um tenant nunca le o book de outro.
// O book pode ser 1 PDF ou uma lista de imagens JPEG ja normalizadas (a
// pagina N e imagens[N - 1]).
// nomeOriginal: nome do PDF enviado, JA sanitizado (sanitizarNomeArquivoBook)
// - so para exibir no book guardado no empreendimento; nunca vira caminho.
export type BookTemporario =
  | { origem: 'pdf'; pdf: Buffer; nomeOriginal?: string | null }
  | { origem: 'imagens'; imagens: Buffer[] };

export interface IBookTemporarioStorage {
  salvar(tenantId: string, book: BookTemporario): Promise<string>; // devolve o id
  ler(tenantId: string, id: string): Promise<BookTemporario | null>;
  remover(tenantId: string, id: string): Promise<void>;
  // Trava exclusiva do book durante a confirmacao (duplo clique em "Salvar"):
  // se ja estiver travado, lanca conflito (409). Devolve a funcao que solta.
  travar(tenantId: string, id: string): Promise<() => Promise<void>>;
}
