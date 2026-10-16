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
  // Site imobiliario publico: aparece na vitrine quando true.
  publicado: boolean;
  // Quem cadastrou pelo POST /imoveis (null = antigos/lote/book, tratados
  // como do Administrador) - ver domain/services/permissao-imovel.ts.
  criadoPorUserId: string | null;
  proprietarioNome: string | null;
  proprietarioTelefone: string | null;
  // Cadastro em lote (Fatia 2) - ver domain/services/gerar-lote-imoveis.ts.
  tipoItem: string;
  identificadorExterno: string | null;
  bloco: string | null;
  andar: number | null;
  numeroNoAndar: number | null;
  enquadramento: string;
  pcd: boolean;
  valorTabela: number | null;
  valorComDesconto: number | null;
  vagasIncluidas: number;
  customFields: Record<string, unknown>;
  suites: number | null;
  areaTotal: number | null;
  iptu: number | null;
  valorCondominio: number | null;
  aceitaFinanciamento: boolean;
  aceitaPermuta: boolean;
  latitude: number | null;
  longitude: number | null;
  linkTourVirtual: string | null;
  areaExterna: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Preenchido apenas por findAllByTenant (1a foto, para a visao Cards do
  // Catalogo) - null em create/update/findByIdAndTenant.
  coverPhotoUrl: string | null;
  // Foto do EMPREENDIMENTO (area comum antes de planta), usada como capa
  // quando a unidade nao tem foto propria - a maioria das unidades de um
  // lancamento nao tem. Preenchido junto com coverPhotoUrl.
  empreendimentoFotoUrl?: string | null;
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
  publicado?: boolean;
  proprietarioNome?: string | null;
  proprietarioTelefone?: string | null;
  // Cadastro em lote (Fatia 2) - ver domain/services/gerar-lote-imoveis.ts.
  tipoItem?: string;
  identificadorExterno?: string | null;
  bloco?: string | null;
  andar?: number | null;
  numeroNoAndar?: number | null;
  enquadramento?: string;
  pcd?: boolean;
  valorTabela?: number | null;
  valorComDesconto?: number | null;
  vagasIncluidas?: number;
  customFields?: Record<string, unknown>;
  suites?: number | null;
  areaTotal?: number | null;
  iptu?: number | null;
  valorCondominio?: number | null;
  aceitaFinanciamento?: boolean;
  aceitaPermuta?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  linkTourVirtual?: string | null;
  areaExterna?: number | null;
}

// Escrita CONDICIONAL para quem nao e Administrador (R2, revisao de
// seguranca): a escrita so acontece se, no MOMENTO da escrita, o imovel
// ainda for do usuario e nao publicado (where id+tenant+publicado=false+
// criadoPorUserId). Se nao bater, o repositorio lanca
// EdicaoImovelBloqueadaError e nada e gravado - fecha a corrida "checou,
// alguem publicou, gravou".
export interface CondicaoDonoImovel {
  tenantId: string;
  userId: string;
}

export class EdicaoImovelBloqueadaError extends Error {
  constructor() {
    super('Edicao do imovel bloqueada: nao e mais do usuario ou ja foi publicado.');
    this.name = 'EdicaoImovelBloqueadaError';
  }
}

export interface IImovelRepository {
  // criadoPorUserId so e gravado na criacao (nao esta em ImovelWritableFields
  // de proposito: o PATCH nunca troca o dono do cadastro).
  create(
    input: ImovelWritableFields & {
      tenantId: string;
      title: string;
      tipo: string;
      finalidade: string;
      criadoPorUserId?: string | null;
    },
  ): Promise<ImovelRecord>;
  // Cria varias unidades em uma unica transacao Prisma - tudo ou nada (ver
  // CriarImoveisLoteUseCase). Nao chama create() varias vezes de proposito:
  // create() nao compartilha transacao entre chamadas separadas.
  createMany(
    items: Array<
      ImovelWritableFields & {
        tenantId: string;
        title: string;
        tipo: string;
        finalidade: string;
      }
    >,
  ): Promise<ImovelRecord[]>;
  update(id: string, input: ImovelWritableFields, condicaoDono?: CondicaoDonoImovel): Promise<ImovelRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ImovelRecord | null>;
  // Marca/desmarca "Publicar no site" em TODAS as unidades de um
  // empreendimento do tenant, numa unica consulta. Retorna quantas mudaram.
  // Nunca mexe em imovel cadastrado por corretor (criadoPorUserId preenchido).
  setPublicadoPorEmpreendimento(
    tenantId: string,
    empreendimentoId: string,
    publicado: boolean,
  ): Promise<number>;
  findAllByTenant(tenantId: string, filters?: ImovelFilters): Promise<ImovelRecord[]>;
  // Dos identificadores informados, devolve so os que ja existem no banco
  // para esse tenant - usado tanto para o aviso do gerar-lote (nao bloqueia)
  // quanto para a validacao que ABORTA o criar-lote (ver CriarImoveisLoteUseCase).
  findExistingIdentificadoresExternos(
    tenantId: string,
    identificadores: string[],
  ): Promise<string[]>;

  findPhotosByImovel(imovelId: string): Promise<ImovelPhotoRecord[]>;
  addPhoto(
    input: {
      tenantId: string;
      imovelId: string;
      url: string;
      order: number;
    },
    condicaoDono?: CondicaoDonoImovel,
  ): Promise<ImovelPhotoRecord>;
  findPhotoByIdAndTenant(photoId: string, tenantId: string): Promise<ImovelPhotoRecord | null>;
  deletePhoto(photoId: string, condicaoDono?: CondicaoDonoImovel & { imovelId: string }): Promise<void>;
  // Fatia 5: aplica o novo "order" de cada foto (ja calculado por
  // computePhotoOrders, ver domain/services/reorder-photos.ts) numa unica
  // transacao, e devolve a lista ja reordenada.
  reorderPhotos(
    imovelId: string,
    orders: { id: string; order: number }[],
    condicaoDono?: CondicaoDonoImovel,
  ): Promise<ImovelPhotoRecord[]>;
}
