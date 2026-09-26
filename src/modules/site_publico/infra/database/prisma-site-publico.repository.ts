// src/modules/site_publico/infra/database/prisma-site-publico.repository.ts
// Leituras da vitrine publica. Todas as consultas filtram por tenant e por
// publicado=true, e os "select" listam campo a campo o que pode sair para
// a internet - nunca devolvem o registro inteiro.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { Prisma, ImovelStatus } from '../../../../generated/prisma/client';
import { REMARKETING_PIPELINE_NOME } from '../../../vendas_kanban/domain/services/remarketing-pipeline';
import { ISitePublicoRepository, SiteTenant } from '../../domain/site-publico-repository.interface';
import {
  EmpreendimentoPublicoDetalhe,
  EmpreendimentoPublicoResumo,
  FiltrosImoveisPublicos,
  ImovelPublicoDetalhe,
  ImovelPublicoResumo,
  Paginado,
} from '../../domain/site-publico.types';

function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

const IMOVEL_RESUMO_SELECT = {
  id: true,
  title: true,
  tipo: true,
  finalidade: true,
  price: true,
  rentPrice: true,
  area: true,
  bedrooms: true,
  bathrooms: true,
  suites: true,
  parkingSpots: true,
  bairro: true,
  cidade: true,
  uf: true,
  empreendimentoId: true,
  empreendimento: { select: { name: true, publicado: true } },
  photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
} satisfies Prisma.ImovelSelect;

type ImovelResumoRow = Prisma.ImovelGetPayload<{ select: typeof IMOVEL_RESUMO_SELECT }>;

function toImovelResumo(row: ImovelResumoRow): ImovelPublicoResumo {
  return {
    id: row.id,
    titulo: row.title,
    tipo: row.tipo,
    finalidade: row.finalidade,
    preco: num(row.price),
    precoAluguel: num(row.rentPrice),
    area: row.area,
    quartos: row.bedrooms,
    banheiros: row.bathrooms,
    suites: row.suites,
    vagas: row.parkingSpots,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    fotoCapa: row.photos[0]?.url ?? null,
    // Empreendimento ainda nao publicado (ex: lancamento em sigilo) nao
    // aparece nem pelo nome nem pelo id.
    empreendimentoId: row.empreendimento?.publicado ? row.empreendimentoId : null,
    empreendimentoNome: row.empreendimento?.publicado ? row.empreendimento.name : null,
  };
}

// Um imovel so aparece na vitrine se estiver publicado E disponivel.
function imovelVisivel(tenantId: string): Prisma.ImovelWhereInput {
  return { tenantId, publicado: true, status: ImovelStatus.DISPONIVEL };
}

@Injectable()
export class PrismaSitePublicoRepository implements ISitePublicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTenantBySlug(slug: string): Promise<SiteTenant | null> {
    const row = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    return row?.slug ? { id: row.id, slug: row.slug, nome: row.name } : null;
  }

  async findTenantByDominio(dominio: string): Promise<SiteTenant | null> {
    const row = await this.prisma.tenant.findUnique({
      where: { dominio },
      select: { id: true, slug: true, name: true },
    });
    return row?.slug ? { id: row.id, slug: row.slug, nome: row.name } : null;
  }

  async listarImoveis(
    tenantId: string,
    f: FiltrosImoveisPublicos,
  ): Promise<Paginado<ImovelPublicoResumo>> {
    const and: Prisma.ImovelWhereInput[] = [imovelVisivel(tenantId)];
    if (f.finalidade) and.push({ finalidade: { in: [f.finalidade, 'ambos'] } });
    if (f.tipo) and.push({ tipo: f.tipo });
    if (f.quartosMin !== undefined) and.push({ bedrooms: { gte: f.quartosMin } });
    if (f.precoMin !== undefined) and.push({ price: { gte: f.precoMin } });
    if (f.precoMax !== undefined) and.push({ price: { lte: f.precoMax } });
    if (f.cidade) and.push({ cidade: { equals: f.cidade, mode: 'insensitive' } });
    if (f.bairro) and.push({ bairro: { equals: f.bairro, mode: 'insensitive' } });
    if (f.empreendimentoId) {
      and.push({ empreendimentoId: f.empreendimentoId, empreendimento: { publicado: true } });
    }
    if (f.busca) {
      and.push({
        OR: [
          { title: { contains: f.busca, mode: 'insensitive' } },
          { bairro: { contains: f.busca, mode: 'insensitive' } },
          { cidade: { contains: f.busca, mode: 'insensitive' } },
          { empreendimento: { publicado: true, name: { contains: f.busca, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.ImovelWhereInput = { AND: and };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.imovel.count({ where }),
      this.prisma.imovel.findMany({
        where,
        select: IMOVEL_RESUMO_SELECT,
        orderBy: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
    ]);

    return { itens: rows.map(toImovelResumo), total, page: f.page, pageSize: f.pageSize };
  }

  async obterImovel(tenantId: string, id: string): Promise<ImovelPublicoDetalhe | null> {
    const row = await this.prisma.imovel.findFirst({
      where: { ...imovelVisivel(tenantId), id },
      select: {
        ...IMOVEL_RESUMO_SELECT,
        description: true,
        areaTotal: true,
        areaExterna: true,
        valorCondominio: true,
        iptu: true,
        aceitaFinanciamento: true,
        aceitaPermuta: true,
        latitude: true,
        longitude: true,
        linkTourVirtual: true,
        photos: { select: { url: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!row) return null;
    return {
      ...toImovelResumo(row),
      descricao: row.description,
      areaTotal: row.areaTotal,
      areaExterna: row.areaExterna,
      valorCondominio: num(row.valorCondominio),
      iptu: num(row.iptu),
      aceitaFinanciamento: row.aceitaFinanciamento,
      aceitaPermuta: row.aceitaPermuta,
      latitude: row.latitude,
      longitude: row.longitude,
      linkTourVirtual: row.linkTourVirtual,
      fotos: row.photos.map((p) => p.url),
    };
  }

  async listarEmpreendimentos(tenantId: string): Promise<EmpreendimentoPublicoResumo[]> {
    const rows = await this.prisma.empreendimento.findMany({
      where: { tenantId, publicado: true },
      select: {
        id: true,
        name: true,
        tipo: true,
        bairro: true,
        cidade: true,
        uf: true,
        precoMinimo: true,
        precoMaximo: true,
        statusObra: true,
        photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      nome: r.name,
      tipo: r.tipo,
      bairro: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      precoMinimo: r.precoMinimo,
      precoMaximo: r.precoMaximo,
      statusObra: r.statusObra,
      fotoCapa: r.photos[0]?.url ?? null,
    }));
  }

  async obterEmpreendimento(
    tenantId: string,
    id: string,
  ): Promise<EmpreendimentoPublicoDetalhe | null> {
    const r = await this.prisma.empreendimento.findFirst({
      where: { tenantId, id, publicado: true },
      select: {
        id: true,
        name: true,
        tipo: true,
        rua: true,
        numero: true,
        bairro: true,
        cidade: true,
        uf: true,
        precoMinimo: true,
        precoMaximo: true,
        statusObra: true,
        description: true,
        construtora: true,
        itensLazer: true,
        diferenciais: true,
        proximoMetro: true,
        totalUnidades: true,
        vagas: true,
        // Endereco e horario do plantao sao publicos (o cliente precisa
        // chegar la). Nome e WhatsApp do corretor NAO saem na vitrine.
        plantaoEndereco: true,
        plantaoHorarioFuncionamento: true,
        tipologias: {
          select: { nome: true, areaPrivativa: true, dormitorios: true },
          orderBy: { nome: 'asc' },
        },
        photos: { select: { url: true, categoria: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      nome: r.name,
      tipo: r.tipo,
      bairro: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      precoMinimo: r.precoMinimo,
      precoMaximo: r.precoMaximo,
      statusObra: r.statusObra,
      fotoCapa: r.photos[0]?.url ?? null,
      descricao: r.description,
      construtora: r.construtora,
      endereco: [r.rua, r.numero].filter(Boolean).join(', '),
      itensLazer: r.itensLazer,
      diferenciais: r.diferenciais,
      proximoMetro: r.proximoMetro,
      totalUnidades: r.totalUnidades,
      vagas: r.vagas,
      plantaoEndereco: r.plantaoEndereco,
      plantaoHorario: r.plantaoHorarioFuncionamento,
      tipologias: r.tipologias,
      fotos: r.photos,
    };
  }

  async findPipelinePrincipalId(tenantId: string): Promise<string | null> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId, name: { not: REMARKETING_PIPELINE_NOME } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return pipeline?.id ?? null;
  }
}
