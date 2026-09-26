// src/modules/site_publico/domain/site-publico.types.ts
// Formatos PUBLICOS devolvidos pela vitrine (site imobiliario). Nunca
// incluem dados internos: proprietario, customFields, identificador de
// importacao, valores de tabela interna ou contato pessoal de corretor.

export interface SitePublicoInfo {
  slug: string;
  nome: string;
}

export interface ImovelPublicoResumo {
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

export interface ImovelPublicoDetalhe extends ImovelPublicoResumo {
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

export interface EmpreendimentoPublicoResumo {
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

export interface EmpreendimentoPublicoDetalhe extends EmpreendimentoPublicoResumo {
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

export interface FiltrosImoveisPublicos {
  finalidade?: string;
  tipo?: string;
  quartosMin?: number;
  precoMin?: number;
  precoMax?: number;
  cidade?: string;
  bairro?: string;
  empreendimentoId?: string;
  busca?: string;
  page: number;
  pageSize: number;
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  page: number;
  pageSize: number;
}
