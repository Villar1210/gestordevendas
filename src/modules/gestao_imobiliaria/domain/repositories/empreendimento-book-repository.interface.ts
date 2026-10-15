// src/modules/gestao_imobiliaria/domain/repositories/empreendimento-book-repository.interface.ts
// Camada de DOMINIO: book COMPLETO guardado no empreendimento (Fatia 2 do
// book) - PDF original (quando houver) + todas as paginas em JPG com a
// categoria de cada uma. Contrato sem saber que existe Prisma.
// Sempre filtrado por tenant: um tenant nunca le o book de outro.
import { OrigemBook } from '../services/book-empreendimento';

export interface EmpreendimentoBookPaginaRecord {
  numero: number;
  categoria: string;
  url: string;
  largura: number;
  altura: number;
}

export interface EmpreendimentoBookRecord {
  id: string;
  tenantId: string;
  empreendimentoId: string;
  origem: OrigemBook;
  pdfUrl: string | null;
  pdfNomeOriginal: string | null;
  totalPaginas: number;
  createdAt: Date;
  // Sempre ordenadas pelo numero.
  paginas: EmpreendimentoBookPaginaRecord[];
}

export interface GravarBookInput {
  tenantId: string;
  empreendimentoId: string;
  book: {
    id: string; // gerado antes do upload (vai no nome dos arquivos)
    origem: OrigemBook;
    pdfUrl: string | null;
    pdfNomeOriginal: string | null;
    totalPaginas: number;
    paginas: EmpreendimentoBookPaginaRecord[];
  };
  // Fotos do empreendimento criadas a partir do book (mesmas regras de
  // sempre: categoria + "order" continuando depois das fotos existentes).
  fotos: { categoria: string; url: string; order: number }[];
}

export interface IEmpreendimentoBookRepository {
  // UMA transacao: apaga o book anterior do empreendimento (se houver; as
  // paginas saem em cascata), cria o novo book + paginas e cria as fotos.
  // Ou grava tudo, ou nada. Devolve as urls dos arquivos do book ANTERIOR
  // (PDF + paginas) para quem chamou remover DEPOIS do commit.
  substituirBookEGravarFotos(input: GravarBookInput): Promise<{ urlsBookAnterior: string[] }>;

  buscarPorEmpreendimento(tenantId: string, empreendimentoId: string): Promise<EmpreendimentoBookRecord | null>;

  // Paginas do book filtradas por categoria, ordenadas pelo numero. Sem
  // categorias = todas exceto "descartar". Preparado para a VIVI enviar as
  // paginas pelo WhatsApp (ainda NAO ligado na VIVI).
  listarPaginasPorCategoria(
    tenantId: string,
    empreendimentoId: string,
    categorias?: readonly string[],
  ): Promise<EmpreendimentoBookPaginaRecord[]>;
}
