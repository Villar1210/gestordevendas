// src/modules/gestao_imobiliaria/domain/repositories/imovel-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ImovelRecord {
  id: string;
  tenantId: string;
  empreendimentoId: string | null;
  title: string;
  tipo: string;
  finalidade: string;
  price: number | null;
  rentPrice: number | null;
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
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImovelPhotoRecord {
  id: string;
  tenantId: string;
  imovelId: string;
  url: string;
  order: number;
  createdAt: Date;
}

export interface ImovelFilters {
  finalidade?: string;
  status?: string;
  empreendimentoId?: string;
  // Busca por titulo (case-insensitive, "contem")
  busca?: string;
}

export interface IImovelRepository {
  create(input: {
    tenantId: string;
    empreendimentoId?: string | null;
    title: string;
    tipo: string;
    finalidade: string;
    price?: number | null;
    rentPrice?: number | null;
    area?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parkingSpots?: number | null;
    rua?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    description?: string | null;
    status?: string;
    customFields?: Record<string, unknown>;
  }): Promise<ImovelRecord>;
  update(
    id: string,
    input: {
      empreendimentoId?: string | null;
      title?: string;
      tipo?: string;
      finalidade?: string;
      price?: number | null;
      rentPrice?: number | null;
      area?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      parkingSpots?: number | null;
      rua?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      cep?: string | null;
      description?: string | null;
      status?: string;
      customFields?: Record<string, unknown>;
    },
  ): Promise<ImovelRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ImovelRecord | null>;
  findAllByTenant(tenantId: string, filters?: ImovelFilters): Promise<ImovelRecord[]>;

  findPhotosByImovel(imovelId: string): Promise<ImovelPhotoRecord[]>;
  addPhoto(input: {
    tenantId: string;
    imovelId: string;
    url: string;
    order: number;
  }): Promise<ImovelPhotoRecord>;
  findPhotoByIdAndTenant(photoId: string, tenantId: string): Promise<ImovelPhotoRecord | null>;
  deletePhoto(photoId: string): Promise<void>;
}
