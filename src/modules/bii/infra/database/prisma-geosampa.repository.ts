// src/modules/bii/infra/database/prisma-geosampa.repository.ts
// geo_quadras_fiscais / geo_lotes_fiscais (GLOBAIS, dado publico) e a
// aplicacao das coordenadas em itbi_transacoes. Mesma EXCECAO medida do
// ITBI (CLAUDE.md, Fatia 2): gravacao em lote e UPDATE ... FROM com
// $executeRaw em template tag (sempre parametrizado; nada de
// $queryRawUnsafe/Prisma.raw). Leituras por Prisma tipado.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  CoberturaPorPrecisao,
  ContagemGeoSampa,
  IGeoSampaRepository,
  QuadraFiscal,
  ResultadoLocalizacao,
} from '../../domain/repositories/geosampa-repository.interface';
import { LoteFiscal, precisoesPiores } from '../../domain/services/geosampa';

const LOTE_PIORES = precisoesPiores('lote');
const QUADRA_PIORES = precisoesPiores('quadra');
const PRECISOES_ENDERECO = ['rooftop', 'rua', 'cep', 'bairro'];

@Injectable()
export class PrismaGeoSampaRepository implements IGeoSampaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async gravarQuadras(q: QuadraFiscal[]): Promise<number> {
    if (q.length === 0) return 0;
    return this.prisma.$executeRaw`
      INSERT INTO "geo_quadras_fiscais" ("setor", "quadra", "latitude", "longitude", "atualizado_em")
      SELECT u.setor, u.quadra, u.lat, u.lng, (now() AT TIME ZONE 'UTC') FROM unnest(
        ${q.map((x) => x.setor)}::text[], ${q.map((x) => x.quadra)}::text[],
        ${q.map((x) => x.lat)}::float8[], ${q.map((x) => x.lng)}::float8[]
      ) AS u(setor, quadra, lat, lng)
      ON CONFLICT ("setor", "quadra") DO UPDATE
        SET "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude", "atualizado_em" = (now() AT TIME ZONE 'UTC')`;
  }

  async gravarLotes(l: LoteFiscal[]): Promise<number> {
    if (l.length === 0) return 0;
    return this.prisma.$executeRaw`
      INSERT INTO "geo_lotes_fiscais" ("setor", "quadra", "lote", "condominio", "ativo", "latitude", "longitude", "atualizado_em")
      SELECT u.setor, u.quadra, u.lote, u.condominio, u.ativo, u.lat, u.lng, (now() AT TIME ZONE 'UTC') FROM unnest(
        ${l.map((x) => x.setor)}::text[], ${l.map((x) => x.quadra)}::text[], ${l.map((x) => x.lote)}::text[],
        ${l.map((x) => x.condominio)}::text[], ${l.map((x) => x.ativo)}::bool[],
        ${l.map((x) => x.lat)}::float8[], ${l.map((x) => x.lng)}::float8[]
      ) AS u(setor, quadra, lote, condominio, ativo, lat, lng)
      ON CONFLICT ("setor", "quadra", "lote", "condominio") DO UPDATE
        SET "ativo" = EXCLUDED."ativo", "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude",
            "atualizado_em" = (now() AT TIME ZONE 'UTC')`;
  }

  async contar(): Promise<ContagemGeoSampa> {
    const [quadras, lotes, ultima] = await Promise.all([
      this.prisma.geoQuadraFiscal.count(),
      this.prisma.geoLoteFiscal.count(),
      this.prisma.geoQuadraFiscal.aggregate({ _max: { atualizadoEm: true } }),
    ]);
    return { quadras, lotes, atualizadoEm: ultima._max.atualizadoEm ?? null };
  }

  async setoresDoItbi(importacaoId?: string): Promise<string[]> {
    // setor = 3 primeiros digitos do SQL (sql_cadastro guarda so digitos,
    // padStart 11 - ver importador). Agrupa no banco, devolve ~300 valores.
    const grupos = importacaoId
      ? await this.prisma.$queryRaw<{ setor: string }[]>`
          SELECT DISTINCT substr("sql_cadastro", 1, 3) AS setor FROM "itbi_transacoes"
          WHERE "importacao_id" = ${importacaoId}::uuid AND "sql_cadastro" ~ '^[0-9]{11}$' ORDER BY 1`
      : await this.prisma.$queryRaw<{ setor: string }[]>`
          SELECT DISTINCT substr("sql_cadastro", 1, 3) AS setor FROM "itbi_transacoes"
          WHERE "sql_cadastro" ~ '^[0-9]{11}$' ORDER BY 1`;
    return grupos.map((g) => g.setor).filter((s) => /^\d{3}$/.test(s) && s !== '000');
  }

  async localizarSetor(setor: string, importacaoId?: string): Promise<ResultadoLocalizacao> {
    if (!/^\d{3}$/.test(setor)) return { porLote: 0, porQuadra: 0 };
    const imp = importacaoId ?? null;
    // faixa setor00000000..setor99999999 (SQL tem 11 digitos) usa o indice de sql_cadastro (substr varreria a
    // tabela inteira: ~1 s por setor x ~300 setores). So digitos: a ordem e a
    // mesma em qualquer collation; o regex abaixo continua filtrando.
    const de = `${setor}00000000`;
    const ate = `${setor}99999999`;
    // 1) lote exato (nao-condominio, ativo) - casas, terrenos, comerciais
    const porLote = await this.prisma.$executeRaw`
      UPDATE "itbi_transacoes" t
         SET "latitude" = g."latitude", "longitude" = g."longitude", "geo_precisao" = 'lote'
        FROM "geo_lotes_fiscais" g
       WHERE t."sql_cadastro" BETWEEN ${de} AND ${ate}
         AND t."sql_cadastro" ~ '^[0-9]{11}$'
         AND (${imp}::uuid IS NULL OR t."importacao_id" = ${imp}::uuid)
         AND g."setor" = ${setor}
         AND g."quadra" = substr(t."sql_cadastro", 4, 3)
         AND g."lote" = substr(t."sql_cadastro", 7, 4)
         AND g."condominio" = '00'
         AND g."ativo" = true
         -- fracao ideal < 1 = unidade de condominio: o "lote" do SQL e o
         -- numero da unidade e poderia casar por acaso com um lote vizinho
         AND (t."fracao_ideal" IS NULL OR t."fracao_ideal" >= 0.999)
         AND (t."geo_precisao" IS NULL OR t."latitude" IS NULL OR t."geo_precisao" = ANY(${LOTE_PIORES}::text[]))`;
    // 2) quadra (setor + quadra) - inclui apartamentos
    const porQuadra = await this.prisma.$executeRaw`
      UPDATE "itbi_transacoes" t
         SET "latitude" = g."latitude", "longitude" = g."longitude", "geo_precisao" = 'quadra'
        FROM "geo_quadras_fiscais" g
       WHERE t."sql_cadastro" BETWEEN ${de} AND ${ate}
         AND t."sql_cadastro" ~ '^[0-9]{11}$'
         AND (${imp}::uuid IS NULL OR t."importacao_id" = ${imp}::uuid)
         AND g."setor" = ${setor}
         AND g."quadra" = substr(t."sql_cadastro", 4, 3)
         AND (t."geo_precisao" IS NULL OR t."latitude" IS NULL OR t."geo_precisao" = ANY(${QUADRA_PIORES}::text[]))`;
    return { porLote, porQuadra };
  }

  async coberturaPorPrecisao(): Promise<CoberturaPorPrecisao> {
    const grupos = await this.prisma.itbiTransacao.groupBy({ by: ['geoPrecisao'], _count: { _all: true } });
    let total = 0;
    let lote = 0;
    let quadra = 0;
    let endereco = 0;
    let semLocal = 0;
    for (const g of grupos) {
      const n = g._count._all;
      total += n;
      if (g.geoPrecisao === 'lote') lote += n;
      else if (g.geoPrecisao === 'quadra') quadra += n;
      else if (g.geoPrecisao && PRECISOES_ENDERECO.includes(g.geoPrecisao)) endereco += n;
      else semLocal += n;
    }
    return { total, lote, quadra, endereco, semLocal };
  }
}
