// src/modules/bii/infra/database/prisma-itbi.repository.ts
// ItbiTransacao - tabela GLOBAL (dado publico): sem tenantId de proposito.
// Leitura so por Prisma tipado (findMany/groupBy/aggregate). EXCECAO medida:
// a insercao em lote usa UM $executeRaw com template tag (parametrizado) e
// INSERT ... SELECT FROM unnest(arrays) ON CONFLICT DO NOTHING - um array por
// coluna, ~32 parametros por lote em vez de 32 mil. Com createMany o arquivo
// de 2026 (156 mil linhas) levava 125 s e 1,6 GB de pico; ver CLAUDE.md
// (Fatia 2). Nada de $queryRawUnsafe/Prisma.raw: so valores vindos do
// dominio, sempre como parametro.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  CoberturaItbi,
  FiltroBbox,
  FiltroSemPonto,
  IItbiRepository,
  LinhaItbiParaGravar,
} from '../../domain/repositories/itbi-repository.interface';
import { TransacaoParaAnalise } from '../../domain/services/analise-endereco';
import { formatarDataUtc } from '../../domain/services/data-utc';

const num = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

@Injectable()
export class PrismaItbiRepository implements IItbiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async inserirLote(linhas: LinhaItbiParaGravar[]): Promise<number> {
    if (linhas.length === 0) return 0;
    const col = <K extends keyof LinhaItbiParaGravar>(k: K) => linhas.map((l) => l[k]);
    const datas = linhas.map((l) => formatarDataUtc(l.dataTransacao));
    return this.prisma.$executeRaw`
      INSERT INTO "itbi_transacoes" (
        "id", "hash_linha", "sql_cadastro", "logradouro", "numero", "complemento", "referencia",
        "bairro", "bairro_normalizado", "cep", "cep_prefixo", "endereco_chave", "natureza_codigo",
        "natureza_transacao", "valor_transacao", "data_transacao", "valor_venal_referencia",
        "proporcao_transmitida", "tipo_financiamento_codigo", "tipo_financiamento", "valor_financiado",
        "situacao_sql", "area_terreno", "fracao_ideal", "area_construida", "uso_iptu", "uso_descricao",
        "padrao_iptu", "padrao_descricao", "acc_iptu", "importacao_id", "arquivo_aba"
      )
      SELECT gen_random_uuid(), u.* FROM unnest(
        ${col('hashLinha')}::text[], ${col('sqlCadastro')}::text[], ${col('logradouro')}::text[],
        ${col('numero')}::text[], ${col('complemento')}::text[], ${col('referencia')}::text[],
        ${col('bairro')}::text[], ${col('bairroNormalizado')}::text[], ${col('cep')}::text[],
        ${col('cepPrefixo')}::text[], ${col('enderecoChave')}::text[], ${col('naturezaCodigo')}::int[],
        ${col('naturezaTransacao')}::text[], ${col('valorTransacao')}::numeric[], ${datas}::date[],
        ${col('valorVenalReferencia')}::numeric[], ${col('proporcaoTransmitida')}::numeric[],
        ${col('tipoFinanciamentoCodigo')}::int[], ${col('tipoFinanciamento')}::text[],
        ${col('valorFinanciado')}::numeric[], ${col('situacaoSql')}::text[], ${col('areaTerreno')}::numeric[],
        ${col('fracaoIdeal')}::numeric[], ${col('areaConstruida')}::numeric[], ${col('usoIptu')}::int[],
        ${col('usoDescricao')}::text[], ${col('padraoIptu')}::int[], ${col('padraoDescricao')}::text[],
        ${col('accIptu')}::int[], ${col('importacaoId')}::uuid[], ${col('arquivoAba')}::text[]
      ) AS u
      ON CONFLICT ("hash_linha") DO NOTHING`;
  }

  async buscarNoBbox(f: FiltroBbox): Promise<TransacaoParaAnalise[]> {
    const rows = await this.prisma.itbiTransacao.findMany({
      where: {
        latitude: { gte: f.bbox.sul, lte: f.bbox.norte },
        longitude: { gte: f.bbox.oeste, lte: f.bbox.leste },
        dataTransacao: { gte: f.de, lt: f.ateExclusivo },
        ...(f.naturezaCodigo !== null ? { naturezaCodigo: f.naturezaCodigo } : {}),
      },
      select: {
        dataTransacao: true,
        logradouro: true,
        numero: true,
        bairro: true,
        areaConstruida: true,
        valorTransacao: true,
        latitude: true,
        longitude: true,
        usoIptu: true,
        naturezaCodigo: true,
        tipoFinanciamentoCodigo: true,
        tipoFinanciamento: true,
      },
      orderBy: { dataTransacao: 'desc' },
      take: f.limite,
    });
    return rows.map((r) => ({
      dataTransacao: r.dataTransacao,
      logradouro: r.logradouro,
      numero: r.numero,
      bairro: r.bairro,
      areaConstruida: num(r.areaConstruida),
      valorTransacao: Number(r.valorTransacao),
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      usoIptu: r.usoIptu,
      naturezaCodigo: r.naturezaCodigo,
      tipoFinanciamentoCodigo: r.tipoFinanciamentoCodigo,
      tipoFinanciamento: r.tipoFinanciamento,
    }));
  }

  async contarSemLocalizacao(f: { cepPrefixo: string; de: Date; ateExclusivo: Date; naturezaCodigo: number | null }) {
    return this.prisma.itbiTransacao.count({
      where: {
        cepPrefixo: f.cepPrefixo,
        latitude: null,
        dataTransacao: { gte: f.de, lt: f.ateExclusivo },
        ...(f.naturezaCodigo !== null ? { naturezaCodigo: f.naturezaCodigo } : {}),
      },
    });
  }

  async cobertura(): Promise<CoberturaItbi> {
    const [totalTransacoes, geocodificadas, atualizadoAte] = await Promise.all([
      this.prisma.itbiTransacao.count(),
      this.prisma.itbiTransacao.count({ where: { latitude: { not: null } } }),
      this.maiorDataTransacao(),
    ]);
    return { totalTransacoes, geocodificadas, atualizadoAte };
  }

  async maiorDataTransacao(): Promise<Date | null> {
    const r = await this.prisma.itbiTransacao.aggregate({ _max: { dataTransacao: true } });
    return r._max.dataTransacao ?? null;
  }

  async listarChavesSemPonto(f: FiltroSemPonto): Promise<string[]> {
    const ou = [
      ...(f.cepPrefixos.length ? [{ cepPrefixo: { in: f.cepPrefixos } }] : []),
      ...(f.bairrosNormalizados.length ? [{ bairroNormalizado: { in: f.bairrosNormalizados } }] : []),
    ];
    if (ou.length === 0) return [];
    const grupos = await this.prisma.itbiTransacao.groupBy({
      by: ['enderecoChave'],
      where: { latitude: null, OR: ou },
      orderBy: { enderecoChave: 'asc' },
      take: f.limite,
    });
    return grupos.map((g) => g.enderecoChave);
  }

  async aplicarCoordenadas(enderecoChave: string, p: { lat: number; lng: number; precisao: string }): Promise<number> {
    const r = await this.prisma.itbiTransacao.updateMany({
      // so guias AINDA sem ponto: nunca troca a localizacao pelo SQL (lote/
      // quadra, Fatia 6) nem outra ja gravada
      where: { enderecoChave, latitude: null },
      data: { latitude: p.lat, longitude: p.lng, geoPrecisao: p.precisao },
    });
    return r.count;
  }
}
