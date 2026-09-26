// src/modules/site_publico/domain/site-publico-repository.interface.ts
import {
  EmpreendimentoPublicoDetalhe,
  EmpreendimentoPublicoResumo,
  FiltrosImoveisPublicos,
  ImovelPublicoDetalhe,
  ImovelPublicoResumo,
  Paginado,
} from './site-publico.types';

export interface SiteTenant {
  id: string;
  slug: string;
  nome: string;
}

export interface ISitePublicoRepository {
  findTenantBySlug(slug: string): Promise<SiteTenant | null>;
  findTenantByDominio(dominio: string): Promise<SiteTenant | null>;
  listarImoveis(tenantId: string, filtros: FiltrosImoveisPublicos): Promise<Paginado<ImovelPublicoResumo>>;
  obterImovel(tenantId: string, id: string): Promise<ImovelPublicoDetalhe | null>;
  listarEmpreendimentos(tenantId: string): Promise<EmpreendimentoPublicoResumo[]>;
  obterEmpreendimento(tenantId: string, id: string): Promise<EmpreendimentoPublicoDetalhe | null>;
  // Pipeline principal de vendas do tenant (nunca o funil de remarketing),
  // onde o lead do site cai na Caixa de Entrada.
  findPipelinePrincipalId(tenantId: string): Promise<string | null>;
}

export const SITE_PUBLICO_REPOSITORY = 'ISitePublicoRepository';
