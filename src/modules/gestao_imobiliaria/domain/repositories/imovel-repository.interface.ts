// src/modules/gestao_imobiliaria/domain/repositories/imovel-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface ImovelRecord {
  id: string;
  tenantId: string;
  empreendimentoId: string | null;
  title: string;
  codigoInterno: string | null;
  tipo: string;
  uso: string | null;
  finalidade: string;
  tags: string | null;
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
  disponivelApartirDe: Date | null;
  localChaves: string | null;
  exclusividade: boolean;
  proprietarioNome: string | null;
  proprietarioTelefone: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // Preenchido apenas por findAllByTenant (1a foto, para a visao Cards do
  // Catalogo) - null em create/update/findByIdAndTenant.
  coverPhotoUrl: string | null;
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

// Campos graváveis do Imovel, compartilhados entre create (title/tipo/
// finalidade obrigatorios) e update (tudo opcional).
export interface ImovelWritableFields {
  empreendimentoId?: string | null;
  title?: string;
  codigoInterno?: string | null;
  tipo?: string;
  uso?: string | null;
  finalidade?: string;
  tags?: string | null;
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
  disponivelApartirDe?: Date | null;
  localChaves?: string | null;
  exclusividade?: boolean;
  proprietarioNome?: string | null;
  proprietarioTelefone?: string | null;
  customFields?: Record<string, unknown>;
}

export interface IImovelRepository {
  create(
    input: ImovelWritableFields & {
      tenantId: string;
      title: string;
      tipo: string;
      finalidade: string;
    },
  ): Promise<ImovelRecord>;
  update(id: string, input: ImovelWritableFields): Promise<ImovelRecord>;
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
