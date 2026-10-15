// src/modules/gestao_imobiliaria/domain/services/book-temporario.interface.ts
// Guarda o book entre a ANALISE (IA separa as paginas) e a CONFIRMACAO (o
// usuario revisou e salvou) - assim os arquivos grandes nao sao enviados 2
// vezes. Sempre amarrado ao tenant: um tenant nunca le o book de outro.
// O book pode ser 1 PDF ou uma lista de imagens JPEG ja normalizadas (a
// pagina N e imagens[N - 1]).
export type BookTemporario = { origem: 'pdf'; pdf: Buffer } | { origem: 'imagens'; imagens: Buffer[] };

export interface IBookTemporarioStorage {
  salvar(tenantId: string, book: BookTemporario): Promise<string>; // devolve o id
  ler(tenantId: string, id: string): Promise<BookTemporario | null>;
  remover(tenantId: string, id: string): Promise<void>;
}
