// src/modules/gestao_imobiliaria/infra/database/prisma-empreendimento-book.repository.ts
// Camada de INFRA: book completo do empreendimento (EmpreendimentoBook +
// EmpreendimentoBookPagina) via Prisma. Toda leitura filtra por tenant.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  EmpreendimentoBookPaginaRecord,
  EmpreendimentoBookRecord,
  GravarBookInput,
  IEmpreendimentoBookRepository,
} from '../../domain/repositories/empreendimento-book-repository.interface';
import { OrigemBook } from '../../domain/services/book-empreendimento';

const SELECT_PAGINA = { numero: true, categoria: true, url: true, largura: true, altura: true } as const;

@Injectable()
export class PrismaEmpreendimentoBookRepository implements IEmpreendimentoBookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async substituirBookEGravarFotos(input: GravarBookInput): Promise<{ urlsBookAnterior: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      // Book anterior (no maximo 1, @@unique empreendimentoId): guarda as urls
      // para remover os arquivos so depois do commit.
      const anterior = await tx.empreendimentoBook.findFirst({
        where: { empreendimentoId: input.empreendimentoId, tenantId: input.tenantId },
        select: { pdfUrl: true, paginas: { select: { url: true } } },
      });
      const urlsBookAnterior: string[] = anterior
        ? [
            ...(anterior.pdfUrl ? [anterior.pdfUrl] : []),
            ...anterior.paginas.map((p: { url: string }) => p.url),
          ]
        : [];
      await tx.empreendimentoBook.deleteMany({
        where: { empreendimentoId: input.empreendimentoId, tenantId: input.tenantId },
      });

      await tx.empreendimentoBook.create({
        data: {
          id: input.book.id,
          tenantId: input.tenantId,
          empreendimentoId: input.empreendimentoId,
          origem: input.book.origem,
          pdfUrl: input.book.pdfUrl,
          pdfNomeOriginal: input.book.pdfNomeOriginal,
          totalPaginas: input.book.totalPaginas,
        },
      });
      if (input.book.paginas.length > 0) {
        await tx.empreendimentoBookPagina.createMany({
          data: input.book.paginas.map((p) => ({
            tenantId: input.tenantId,
            bookId: input.book.id,
            numero: p.numero,
            categoria: p.categoria,
            url: p.url,
            largura: p.largura,
            altura: p.altura,
          })),
        });
      }

      for (const foto of input.fotos) {
        await tx.empreendimentoPhoto.create({
          data: {
            tenantId: input.tenantId,
            empreendimentoId: input.empreendimentoId,
            categoria: foto.categoria,
            url: foto.url,
            order: foto.order,
          },
        });
      }
      return { urlsBookAnterior };
    });
  }

  async buscarPorEmpreendimento(
    tenantId: string,
    empreendimentoId: string,
  ): Promise<EmpreendimentoBookRecord | null> {
    const book = await this.prisma.empreendimentoBook.findFirst({
      where: { empreendimentoId, tenantId },
      include: { paginas: { select: SELECT_PAGINA, orderBy: { numero: 'asc' } } },
    });
    if (!book) return null;
    return { ...book, origem: book.origem as OrigemBook };
  }

  async listarPaginasPorCategoria(
    tenantId: string,
    empreendimentoId: string,
    categorias?: readonly string[],
  ): Promise<EmpreendimentoBookPaginaRecord[]> {
    return this.prisma.empreendimentoBookPagina.findMany({
      where: {
        tenantId,
        book: { empreendimentoId, tenantId },
        categoria: categorias && categorias.length > 0 ? { in: [...categorias] } : { not: 'descartar' },
      },
      select: SELECT_PAGINA,
      orderBy: { numero: 'asc' },
    });
  }
}
