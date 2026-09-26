// src/features/site-publico/types.ts
// Espelho dos formatos publicos devolvidos por /public/site/* (backend
// src/modules/site_publico/domain/site-publico.types.ts).

export interface SiteInfo {
  slug: string;
  nome: string;
}

export interface ImovelResumo {
  id: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  preco: number | null;
  precoAluguel: number | null;
  area: number | null;
  quartos: number | null;
  banheiros: number | null;
  suites: number | null;
  vagas: number | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fotoCapa: string | null;
  empreendimentoId: string | null;
  empreendimentoNome: string | null;
}

export interface ImovelDetalhe extends ImovelResumo {
  descricao: string | null;
  areaTotal: number | null;
  areaExterna: number | null;
  valorCondominio: number | null;
  iptu: number | null;
  aceitaFinanciamento: boolean;
  aceitaPermuta: boolean;
  latitude: number | null;
  longitude: number | null;
  linkTourVirtual: string | null;
  fotos: string[];
}

export interface EmpreendimentoResumo {
  id: string;
  nome: string;
  tipo: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  precoMinimo: number | null;
  precoMaximo: number | null;
  statusObra: string | null;
  fotoCapa: string | null;
}

export interface EmpreendimentoDetalhe extends EmpreendimentoResumo {
  descricao: string | null;
  construtora: string | null;
  endereco: string;
  itensLazer: string[];
  diferenciais: string[];
  proximoMetro: boolean;
  totalUnidades: number | null;
  vagas: number | null;
  plantaoEndereco: string | null;
  plantaoHorario: string | null;
  tipologias: { nome: string; areaPrivativa: number | null; dormitorios: number | null }[];
  fotos: { url: string; categoria: string }[];
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  page: number;
  pageSize: number;
}
