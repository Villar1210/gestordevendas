// src/modules/gestao_imobiliaria/infra/database/prisma-imovel.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  Prisma,
  ImovelStatus,
  ImovelTipoItem,
  ImovelEnquadramento,
} from '../../../../generated/prisma/client';
import {
  IImovelRepository,
  ImovelFilters,
  ImovelPhotoRecord,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';

// O dominio (e os DTOs/frontend, que nao mudam nesta fatia - ver STATUS_VALUES
// em create-imovel.dto.ts) continuam falando "status" como string minuscula
// snake_case ("disponivel", "em_negociacao"...). O Prisma agora exige o enum
// ImovelStatus (UPPERCASE) na coluna do banco. Essa traducao fica isolada
// aqui, na fronteira com o Prisma, para nao vazar o enum para fora da infra.
const STATUS_TO_PRISMA: Record<string, ImovelStatus> = {
  disponivel: ImovelStatus.DISPONIVEL,
  reservado: ImovelStatus.RESERVADO,
  em_negociacao: ImovelStatus.EM_NEGOCIACAO,
  vendido: ImovelStatus.VENDIDO,
  bloqueado: ImovelStatus.BLOQUEADO,
  em_analise: ImovelStatus.EM_ANALISE,
  distrato: ImovelStatus.DISTRATO,
  ocupado: ImovelStatus.OCUPADO,
  vago: ImovelStatus.VAGO,
  inativo: ImovelStatus.INATIVO,
};

const STATUS_FROM_PRISMA: Record<ImovelStatus, string> = {
  DISPONIVEL: 'disponivel',
  RESERVADO: 'reservado',
  EM_NEGOCIACAO: 'em_negociacao',
  VENDIDO: 'vendido',
  BLOQUEADO: 'bloqueado',
  EM_ANALISE: 'em_analise',
  DISTRATO: 'distrato',
  OCUPADO: 'ocupado',
  VAGO: 'vago',
  INATIVO: 'inativo',
};

function toPrismaStatus(status: string): ImovelStatus {
  const mapped = STATUS_TO_PRISMA[status];
  if (!mapped) {
    throw new Error(`status de imovel invalido: ${status}`);
  }
  return mapped;
}

function fromPrismaStatus(status: string): string {
  return STATUS_FROM_PRISMA[status as ImovelStatus] ?? status;
}

// Mesma logica de traducao do status acima, agora para os 2 enums novos da
// Fatia 1 (tipoItem/enquadramento) - nenhum DTO/frontend existente falava
// esses campos antes desta fatia, mas seguimos o mesmo padrao (dominio em
// lowercase snake_case, traduzido so na fronteira com o Prisma) por
// consistencia com o resto do repository.
const TIPO_ITEM_TO_PRISMA: Record<string, ImovelTipoItem> = {
  unidade: ImovelTipoItem.UNIDADE,
  vaga_avulsa: ImovelTipoItem.VAGA_AVULSA,
};

const TIPO_ITEM_FROM_PRISMA: Record<ImovelTipoItem, string> = {
  UNIDADE: 'unidade',
  VAGA_AVULSA: 'vaga_avulsa',
};

function toPrismaTipoItem(tipoItem: string): ImovelTipoItem {
  const mapped = TIPO_ITEM_TO_PRISMA[tipoItem];
  if (!mapped) {
    throw new Error(`tipoItem de imovel invalido: ${tipoItem}`);
  }
  return mapped;
}

function fromPrismaTipoItem(tipoItem: string): string {
  return TIPO_ITEM_FROM_PRISMA[tipoItem as ImovelTipoItem] ?? tipoItem;
}

// Nomenclatura 2026: alinhado com CategoriaHabitacional (vivi_sdr) - ver
// comentario no enum ImovelEnquadramento em schema.prisma.
const ENQUADRAMENTO_TO_PRISMA: Record<string, ImovelEnquadramento> = {
  faixa1: ImovelEnquadramento.FAIXA_1,
  faixa2: ImovelEnquadramento.FAIXA_2,
  faixa3: ImovelEnquadramento.FAIXA_3,
  faixa4: ImovelEnquadramento.FAIXA_4,
  r2v: ImovelEnquadramento.R2V,
  nenhum: ImovelEnquadramento.NENHUM,
};

const ENQUADRAMENTO_FROM_PRISMA: Record<ImovelEnquadramento, string> = {
  FAIXA_1: 'faixa1',
  FAIXA_2: 'faixa2',
  FAIXA_3: 'faixa3',
  FAIXA_4: 'faixa4',
  R2V: 'r2v',
  NENHUM: 'nenhum',
};

function toPrismaEnquadramento(enquadramento: string): ImovelEnquadramento {
  const mapped = ENQUADRAMENTO_TO_PRISMA[enquadramento];
  if (!mapped) {
    throw new Error(`enquadramento de imovel invalido: ${enquadramento}`);
  }
  return mapped;
}

function fromPrismaEnquadramento(enquadramento: string): string {
  return ENQUADRAMENTO_FROM_PRISMA[enquadramento as ImovelEnquadramento] ?? enquadramento;
}

type PrismaImovelRow = {
  id: string;
  tenantId: string;
  empreendimentoId: string | null;
  title: string;
  codigoInterno: string | null;
  tipo: string;
  uso: string | null;
  finalidade: string;
  tags: string | null;
  price: { toNumber(): number } | null;
  rentPrice: { toNumber(): number } | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  description: string | null;
  status: string;
  disponivelApartirDe: Date | null;
  localChaves: string | null;
  exclusividade: boolean;
  proprietarioNome: string | null;
  proprietarioTelefone: string | null;
  tipoItem: string;
  identificadorExterno: string | null;
  bloco: string | null;
  andar: number | null;
  numeroNoAndar: number | null;
  enquadramento: string;
  pcd: boolean;
  valorTabela: { toNumber(): number } | null;
  valorComDesconto: { toNumber(): number } | null;
  vagasIncluidas: number;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
  // So presente quando a query faz include: { photos: ... } (findAllByTenant)
  photos?: { url: string }[];
};

@Injectable()
export class PrismaImovelRepository implements IImovelRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: PrismaImovelRow): ImovelRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      empreendimentoId: row.empreendimentoId,
      title: row.title,
      codigoInterno: row.codigoInterno,
      tipo: row.tipo,
      uso: row.uso,
      finalidade: row.finalidade,
      tags: row.tags,
      price: row.price ? row.price.toNumber() : null,
      rentPrice: row.rentPrice ? row.rentPrice.toNumber() : null,
      area: row.area,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      parkingSpots: row.parkingSpots,
      rua: row.rua,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      cep: row.cep,
      description: row.description,
      status: fromPrismaStatus(row.status),
      disponivelApartirDe: row.disponivelApartirDe,
      localChaves: row.localChaves,
      exclusividade: row.exclusividade,
      proprietarioNome: row.proprietarioNome,
      proprietarioTelefone: row.proprietarioTelefone,
      tipoItem: fromPrismaTipoItem(row.tipoItem),
      identificadorExterno: row.identificadorExterno,
      bloco: row.bloco,
      andar: row.andar,
      numeroNoAndar: row.numeroNoAndar,
      enquadramento: fromPrismaEnquadramento(row.enquadramento),
      pcd: row.pcd,
      valorTabela: row.valorTabela ? row.valorTabela.toNumber() : null,
      valorComDesconto: row.valorComDesconto ? row.valorComDesconto.toNumber() : null,
      vagasIncluidas: row.vagasIncluidas,
      customFields: (row.customFields as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      coverPhotoUrl: row.photos && row.photos.length > 0 ? row.photos[0].url : null,
    };
  }

  // Compartilhado entre create() e createMany() - mesmo mapeamento de campos,
  // usado dentro de $transaction no caso do lote (ver createMany abaixo).
  private buildCreateData(
    input: ImovelWritableFields & {
      tenantId: string;
      title: string;
      tipo: string;
      finalidade: string;
    },
  ) {
    return {
      tenantId: input.tenantId,
      empreendimentoId: input.empreendimentoId ?? null,
      title: input.title,
      codigoInterno: input.codigoInterno ?? null,
      tipo: input.tipo,
      uso: input.uso ?? null,
      finalidade: input.finalidade,
      tags: input.tags ?? null,
      price: input.price ?? null,
      rentPrice: input.rentPrice ?? null,
      area: input.area ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      parkingSpots: input.parkingSpots ?? null,
      rua: input.rua ?? null,
      numero: input.numero ?? null,
      complemento: input.complemento ?? null,
      bairro: input.bairro ?? null,
      cidade: input.cidade ?? null,
      uf: input.uf ?? null,
      cep: input.cep ?? null,
      description: input.description ?? null,
      status: toPrismaStatus(input.status ?? 'disponivel'),
      disponivelApartirDe: input.disponivelApartirDe ?? null,
      localChaves: input.localChaves ?? null,
      exclusividade: input.exclusividade ?? false,
      proprietarioNome: input.proprietarioNome ?? null,
      proprietarioTelefone: input.proprietarioTelefone ?? null,
      tipoItem: toPrismaTipoItem(input.tipoItem ?? 'unidade'),
      identificadorExterno: input.identificadorExterno ?? null,
      bloco: input.bloco ?? null,
      andar: input.andar ?? null,
      numeroNoAndar: input.numeroNoAndar ?? null,
      enquadramento: toPrismaEnquadramento(input.enquadramento ?? 'nenhum'),
      pcd: input.pcd ?? false,
      valorTabela: input.valorTabela ?? null,
      valorComDesconto: input.valorComDesconto ?? null,
      vagasIncluidas: input.vagasIncluidas ?? 0,
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
    };
  }

  async create(
    input: ImovelWritableFields & {
      tenantId: string;
      title: string;
      tipo: string;
      finalidade: string;
    },
  ): Promise<ImovelRecord> {
    const row = await this.prisma.imovel.create({ data: this.buildCreateData(input) });
    return this.toRecord(row);
  }

  // Tudo ou nada: usa $transaction com um array de promises do Prisma (nao
  // um loop de create() separados) para que qualquer falha (ex: colisao de
  // identificadorExterno que escapou da validacao previa do use case) reverta
  // TODAS as criacoes do lote, nao so a que falhou.
  async createMany(
    items: Array<
      ImovelWritableFields & {
        tenantId: string;
        title: string;
        tipo: string;
        finalidade: string;
      }
    >,
  ): Promise<ImovelRecord[]> {
    const rows = await this.prisma.$transaction(
      items.map((input) => this.prisma.imovel.create({ data: this.buildCreateData(input) })),
    );
    return rows.map((row) => this.toRecord(row));
  }

  async update(id: string, input: ImovelWritableFields): Promise<ImovelRecord> {
    const row = await this.prisma.imovel.update({
      where: { id },
      data: {
        ...(input.empreendimentoId !== undefined
          ? { empreendimentoId: input.empreendimentoId }
          : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.codigoInterno !== undefined ? { codigoInterno: input.codigoInterno } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.uso !== undefined ? { uso: input.uso } : {}),
        ...(input.finalidade !== undefined ? { finalidade: input.finalidade } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.rentPrice !== undefined ? { rentPrice: input.rentPrice } : {}),
        ...(input.area !== undefined ? { area: input.area } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.bathrooms !== undefined ? { bathrooms: input.bathrooms } : {}),
        ...(input.parkingSpots !== undefined ? { parkingSpots: input.parkingSpots } : {}),
        ...(input.rua !== undefined ? { rua: input.rua } : {}),
        ...(input.numero !== undefined ? { numero: input.numero } : {}),
        ...(input.complemento !== undefined ? { complemento: input.complemento } : {}),
        ...(input.bairro !== undefined ? { bairro: input.bairro } : {}),
        ...(input.cidade !== undefined ? { cidade: input.cidade } : {}),
        ...(input.uf !== undefined ? { uf: input.uf } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: toPrismaStatus(input.status) } : {}),
        ...(input.disponivelApartirDe !== undefined
          ? { disponivelApartirDe: input.disponivelApartirDe }
          : {}),
        ...(input.localChaves !== undefined ? { localChaves: input.localChaves } : {}),
        ...(input.exclusividade !== undefined ? { exclusividade: input.exclusividade } : {}),
        ...(input.proprietarioNome !== undefined
          ? { proprietarioNome: input.proprietarioNome }
          : {}),
        ...(input.proprietarioTelefone !== undefined
          ? { proprietarioTelefone: input.proprietarioTelefone }
          : {}),
        ...(input.tipoItem !== undefined ? { tipoItem: toPrismaTipoItem(input.tipoItem) } : {}),
        ...(input.identificadorExterno !== undefined
          ? { identificadorExterno: input.identificadorExterno }
          : {}),
        ...(input.bloco !== undefined ? { bloco: input.bloco } : {}),
        ...(input.andar !== undefined ? { andar: input.andar } : {}),
        ...(input.numeroNoAndar !== undefined ? { numeroNoAndar: input.numeroNoAndar } : {}),
        ...(input.enquadramento !== undefined
          ? { enquadramento: toPrismaEnquadramento(input.enquadramento) }
          : {}),
        ...(input.pcd !== undefined ? { pcd: input.pcd } : {}),
        ...(input.valorTabela !== undefined ? { valorTabela: input.valorTabela } : {}),
        ...(input.valorComDesconto !== undefined
          ? { valorComDesconto: input.valorComDesconto }
          : {}),
        ...(input.vagasIncluidas !== undefined ? { vagasIncluidas: input.vagasIncluidas } : {}),
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
      },
      // Mesmo motivo do findAllByTenant: manter coverPhotoUrl correto tambem
      // apos um PATCH (sem isso, salvar o formulario apos upload zerava a capa).
      include: { photos: { take: 1, orderBy: { order: 'asc' } } },
    });
    return this.toRecord(row);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ImovelRecord | null> {
    const row = await this.prisma.imovel.findFirst({ where: { id, tenantId } });
    return row ? this.toRecord(row) : null;
  }

  async findAllByTenant(tenantId: string, filters?: ImovelFilters): Promise<ImovelRecord[]> {
    const rows = await this.prisma.imovel.findMany({
      where: {
        tenantId,
        ...(filters?.finalidade ? { finalidade: filters.finalidade } : {}),
        ...(filters?.status ? { status: toPrismaStatus(filters.status) } : {}),
        ...(filters?.empreendimentoId ? { empreendimentoId: filters.empreendimentoId } : {}),
        ...(filters?.busca
          ? { title: { contains: filters.busca, mode: 'insensitive' } }
          : {}),
      },
      // 1a foto (menor "order") para a foto de capa da visao Cards do Catalogo
      include: { photos: { take: 1, orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findExistingIdentificadoresExternos(
    tenantId: string,
    identificadores: string[],
  ): Promise<string[]> {
    if (identificadores.length === 0) {
      return [];
    }
    const rows = await this.prisma.imovel.findMany({
      where: { tenantId, identificadorExterno: { in: identificadores } },
      select: { identificadorExterno: true },
    });
    return rows
      .map((row) => row.identificadorExterno)
      .filter((identificador): identificador is string => identificador !== null);
  }

  async findPhotosByImovel(imovelId: string): Promise<ImovelPhotoRecord[]> {
    return this.prisma.imovelPhoto.findMany({
      where: { imovelId },
      orderBy: { order: 'asc' },
    });
  }

  async addPhoto(input: {
    tenantId: string;
    imovelId: string;
    url: string;
    order: number;
  }): Promise<ImovelPhotoRecord> {
    return this.prisma.imovelPhoto.create({
      data: {
        tenantId: input.tenantId,
        imovelId: input.imovelId,
        url: input.url,
        order: input.order,
      },
    });
  }

  async findPhotoByIdAndTenant(
    photoId: string,
    tenantId: string,
  ): Promise<ImovelPhotoRecord | null> {
    return this.prisma.imovelPhoto.findFirst({ where: { id: photoId, tenantId } });
  }

  async deletePhoto(photoId: string): Promise<void> {
    await this.prisma.imovelPhoto.delete({ where: { id: photoId } });
  }

  async reorderPhotos(
    imovelId: string,
    orders: { id: string; order: number }[],
  ): Promise<ImovelPhotoRecord[]> {
    await this.prisma.$transaction(
      orders.map(({ id, order }) => this.prisma.imovelPhoto.update({ where: { id }, data: { order } })),
    );
    return this.findPhotosByImovel(imovelId);
  }
}
