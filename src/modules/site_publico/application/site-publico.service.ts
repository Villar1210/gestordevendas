// src/modules/site_publico/application/site-publico.service.ts
// Regras da vitrine publica: resolve a empresa pelo slug ou pelo dominio
// proprio, aplica paginacao e registra o lead do site na Caixa de Entrada
// do funil principal de vendas.
import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CreateQuickCardUseCase } from '../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import {
  ISitePublicoRepository,
  SITE_PUBLICO_REPOSITORY,
  SiteTenant,
} from '../domain/site-publico-repository.interface';
import {
  EmpreendimentoPublicoDetalhe,
  EmpreendimentoPublicoResumo,
  FiltrosImoveisPublicos,
  ImovelPublicoDetalhe,
  ImovelPublicoResumo,
  Paginado,
  SitePublicoInfo,
} from '../domain/site-publico.types';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;
export const ORIGEM_SITE = 'site';

// "https://WWW.Exemplo.com.br:443/x" -> "exemplo.com.br"
export function normalizarDominio(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
}

export interface RegistrarLeadInput {
  nome: string;
  telefone: string;
  email?: string;
  mensagem?: string;
  imovelId?: string;
  empreendimentoId?: string;
  website?: string;
}

@Injectable()
export class SitePublicoService {
  private readonly logger = new Logger(SitePublicoService.name);

  constructor(
    @Inject(SITE_PUBLICO_REPOSITORY) private readonly repo: ISitePublicoRepository,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
  ) {}

  private async tenantPorSlug(slug: string): Promise<SiteTenant> {
    const tenant = SLUG_REGEX.test(slug) ? await this.repo.findTenantBySlug(slug) : null;
    if (!tenant) throw new NotFoundException('Site não encontrado.');
    return tenant;
  }

  async resolverPorDominio(host: string): Promise<SitePublicoInfo> {
    const dominio = normalizarDominio(host);
    const tenant = dominio ? await this.repo.findTenantByDominio(dominio) : null;
    if (!tenant) throw new NotFoundException('Site não encontrado.');
    return { slug: tenant.slug, nome: tenant.nome };
  }

  async info(slug: string): Promise<SitePublicoInfo> {
    const tenant = await this.tenantPorSlug(slug);
    return { slug: tenant.slug, nome: tenant.nome };
  }

  async listarImoveis(
    slug: string,
    filtros: Omit<FiltrosImoveisPublicos, 'page' | 'pageSize'> & { page?: number; pageSize?: number },
  ): Promise<Paginado<ImovelPublicoResumo>> {
    const tenant = await this.tenantPorSlug(slug);
    return this.repo.listarImoveis(tenant.id, {
      ...filtros,
      page: filtros.page ?? 1,
      pageSize: filtros.pageSize ?? 12,
    });
  }

  async obterImovel(slug: string, id: string): Promise<ImovelPublicoDetalhe> {
    const tenant = await this.tenantPorSlug(slug);
    const imovel = await this.repo.obterImovel(tenant.id, id);
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
    return imovel;
  }

  async listarEmpreendimentos(slug: string): Promise<EmpreendimentoPublicoResumo[]> {
    const tenant = await this.tenantPorSlug(slug);
    return this.repo.listarEmpreendimentos(tenant.id);
  }

  async obterEmpreendimento(slug: string, id: string): Promise<EmpreendimentoPublicoDetalhe> {
    const tenant = await this.tenantPorSlug(slug);
    const emp = await this.repo.obterEmpreendimento(tenant.id, id);
    if (!emp) throw new NotFoundException('Empreendimento não encontrado.');
    return emp;
  }

  // Cria um card na Caixa de Entrada do funil principal (a Roleta Online,
  // se ativa, distribui normalmente). Sempre responde "recebido" para nao
  // revelar a robos se o envio foi descartado pela armadilha.
  async registrarLead(slug: string, input: RegistrarLeadInput): Promise<{ recebido: true }> {
    const tenant = await this.tenantPorSlug(slug);

    if (input.website && input.website.trim() !== '') {
      this.logger.warn(`Lead do site descartado (armadilha anti-robo) - tenant ${tenant.id}`);
      return { recebido: true };
    }

    // So vincula imovel/empreendimento que estejam publicados neste site.
    const imovel = input.imovelId ? await this.repo.obterImovel(tenant.id, input.imovelId) : null;
    const empId = input.empreendimentoId ?? imovel?.empreendimentoId ?? undefined;
    const emp = empId ? await this.repo.obterEmpreendimento(tenant.id, empId) : null;

    const pipelineId = await this.repo.findPipelinePrincipalId(tenant.id);
    if (!pipelineId) {
      this.logger.error(`Lead do site sem funil de vendas - tenant ${tenant.id}`);
      throw new ServiceUnavailableException('Não foi possível enviar agora. Tente novamente mais tarde.');
    }

    const telefone = input.telefone.replace(/\D/g, '');
    const interesse = imovel?.titulo ?? emp?.nome;
    const descricao = [
      'Lead recebido pelo site.',
      interesse ? `Interesse: ${interesse}.` : null,
      input.email ? `E-mail: ${input.email}` : null,
      input.mensagem ? `Mensagem: ${input.mensagem.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await this.createQuickCardUseCase.execute({
      tenantId: tenant.id,
      pipelineId,
      isSystemCall: true,
      title: `Site: ${input.nome.trim()}`,
      origem: ORIGEM_SITE,
      phone: telefone,
      imovelId: imovel?.id,
      description: descricao,
      customFields: {
        site: {
          email: input.email ?? null,
          empreendimentoId: emp?.id ?? null,
          aceiteLgpdEm: new Date().toISOString(),
        },
      },
    });

    return { recebido: true };
  }
}
