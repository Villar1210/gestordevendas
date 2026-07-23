// src/modules/gestao_imobiliaria/domain/repositories/empreendimento-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface EmpreendimentoRecord {
  id: string;
  tenantId: string;
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description: string | null;
  createdAt: Date;
  // Fatia 1 (schema) + Fatia 3a (importacao de planilha, primeiro consumidor
  // real): publicado controla se o empreendimento aparece no site publico
  // (fora do escopo ainda); origemImportacao registra como os dados
  // chegaram (ex: "planilha") - nulo para empreendimentos cadastrados a mao.
  publicado: boolean;
  origemImportacao: string | null;
  // Ficha tecnica (Fatia 3c) - preenchidos so pelo fluxo de importacao de
  // PDF (ConfirmarFichaTecnicaUseCase), nulos/vazio ate la.
  areaTerreno: number | null;
  totalUnidades: number | null;
  numeroTorres: number | null;
  unidadesPorAndar: number | null;
  gabarito: number | null;
  vagas: number | null;
  itensLazer: string[];
}

// Foto do EMPREENDIMENTO como um todo (Fatia 5) - model separado de
// ImovelPhoto de proposito (ver comentario em EmpreendimentoPhoto no
// schema.prisma). Os metodos vivem dentro de IEmpreendimentoRepository, nao
// um repositorio proprio - mesmo padrao ja usado para ImovelPhoto dentro de
// IImovelRepository.
export const EMPREENDIMENTO_PHOTO_CATEGORIAS = ['planta', 'area_comum'] as const;
export type EmpreendimentoPhotoCategoria = (typeof EMPREENDIMENTO_PHOTO_CATEGORIAS)[number];

export interface EmpreendimentoPhotoRecord {
  id: string;
  tenantId: string;
  empreendimentoId: string;
  categoria: string;
  url: string;
  order: number;
  createdAt: Date;
}

export interface FichaTecnicaPatch {
  description?: string | null;
  areaTerreno?: number | null;
  totalUnidades?: number | null;
  numeroTorres?: number | null;
  unidadesPorAndar?: number | null;
  gabarito?: number | null;
  vagas?: number | null;
  itensLazer?: string[];
  origemImportacao?: string | null;
}

export interface IEmpreendimentoRepository {
  create(input: {
    tenantId: string;
    name: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    description?: string | null;
  }): Promise<EmpreendimentoRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<EmpreendimentoRecord | null>;
  // filters.publicado opcional (Fatia 4): ausente = todos (Catalogo/Cadastro
  // em Lote, que precisam ver tambem os pendentes); true = so publicados
  // (Espelho de Vendas, ver EspelhoDeVendas.tsx no frontend).
  findAllByTenant(tenantId: string, filters?: { publicado?: boolean }): Promise<EmpreendimentoRecord[]>;
  update(
    id: string,
    patch: { publicado?: boolean; origemImportacao?: string | null },
  ): Promise<EmpreendimentoRecord>;
  // Fatia 3c: grava os campos da ficha tecnica extraida/revisada. Separado
  // de update() acima (que so mexe em publicado/origemImportacao) para nao
  // misturar o contrato ja usado pelo fluxo de planilha (Fatia 3a) com o
  // novo conjunto de campos desta fatia.
  updateFichaTecnica(id: string, patch: FichaTecnicaPatch): Promise<EmpreendimentoRecord>;

  // Fatia 5 - fotos do empreendimento (planta/area comum).
  findPhotosByEmpreendimento(empreendimentoId: string): Promise<EmpreendimentoPhotoRecord[]>;
  // filters.categoria opcional: presente ao contar quantas fotos ja existem
  // NAQUELA categoria (para calcular o "order" do upload seguinte, ver
  // UploadEmpreendimentoPhotoUseCase) e ao reordenar (so aceita reordenar
  // fotos de uma categoria por vez).
  findPhotosByEmpreendimentoAndCategoria(
    empreendimentoId: string,
    categoria: string,
  ): Promise<EmpreendimentoPhotoRecord[]>;
  addPhoto(input: {
    tenantId: string;
    empreendimentoId: string;
    categoria: string;
    url: string;
    order: number;
  }): Promise<EmpreendimentoPhotoRecord>;
  findPhotoByIdAndTenant(photoId: string, tenantId: string): Promise<EmpreendimentoPhotoRecord | null>;
  deletePhoto(photoId: string): Promise<void>;
  // categoria aqui NAO e so para validacao - e o que garante que o re-fetch
  // apos a transacao devolva so as fotos DAQUELA categoria, ordenadas certo.
  // Sem isso, o "order" (sequencial POR categoria, ver EmpreendimentoPhoto no
  // schema.prisma) colide entre categorias diferentes (ambas podem ter uma
  // foto com order=0) e misturar tudo numa lista so por "order asc" devolve
  // uma ordem sem sentido.
  reorderPhotos(
    empreendimentoId: string,
    categoria: string,
    orders: { id: string; order: number }[],
  ): Promise<EmpreendimentoPhotoRecord[]>;
}
