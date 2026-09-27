// src/modules/gestao_imobiliaria/domain/services/book-temporario.interface.ts
// Guarda o PDF entre a ANALISE (IA separa as paginas) e a CONFIRMACAO (o
// usuario revisou e salvou) - assim o arquivo grande nao e enviado 2 vezes.
// Sempre amarrado ao tenant: um tenant nunca le o book de outro.
export interface IBookTemporarioStorage {
  salvar(tenantId: string, pdf: Buffer): Promise<string>; // devolve o id
  ler(tenantId: string, id: string): Promise<Buffer | null>;
  remover(tenantId: string, id: string): Promise<void>;
}
