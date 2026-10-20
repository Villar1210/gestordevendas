// src/modules/bii/application/use-cases/analisar-endereco.use-case.ts
// POST /bii/analises/endereco - so Administrador (checado aqui tambem).
// Contrato: docs/bii/fatia2/CONTRATO_ANALISE_ENDERECO.md.
// Fluxo: geocodifica (cache -> Nominatim) -> confere Grande SP -> periodo ->
// bounding box -> ITBI do bbox (limite defensivo 20 mil) -> raio/estatistica
// (dominio puro) -> grava BiiAnalise (snapshot) -> resposta.
// Super Usuario impersonando -> 403 BII_SOMENTE_LEITURA; cota diaria por
// tenant -> 429 BII_COTA_DIARIA. Log de auditoria sem o endereco.
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GEOCODING_PROVIDER,
  GeocodingIndisponivelError,
  IGeocodingProvider,
} from '../../domain/ports/geocoding-provider.interface';
import { BII_ANALISE_REPOSITORY, IBiiAnaliseRepository } from '../../domain/repositories/bii-analise-repository.interface';
import { IItbiRepository, ITBI_REPOSITORY } from '../../domain/repositories/itbi-repository.interface';
import { calcularAnaliseEndereco, ResultadoCalculo } from '../../domain/services/analise-endereco';
import { formatarDataUtc, hojeUtc, periodoDeMeses, somarDiasUtc } from '../../domain/services/data-utc';
import { limparEnderecoDigitado, prefixoCep } from '../../domain/services/endereco';
import { boundingBox, dentroDaGrandeSP } from '../../domain/services/geo';
import { NATUREZA_COMPRA_E_VENDA, TipoImovelAnalise } from '../../domain/services/itbi-classificacao';
import { exigirAdministrador } from './permissoes-bii';

export const ANALISE_LIMITE_LINHAS = 20_000;
export const RAIOS_PERMITIDOS = [500, 1000, 2000] as const;
export const MESES_PERMITIDOS = [6, 12, 24, 36] as const;
export const MENSAGEM_ENDERECO_NAO_ENCONTRADO = 'Não encontramos esse endereço. Inclua número, bairro e cidade.';
export const MENSAGEM_MAPAS_INDISPONIVEL = 'O serviço de mapas está indisponível agora. Tente em instantes.';
export const FONTE_ITBI = 'ITBI — Prefeitura de São Paulo' as const;
export const CODIGO_COTA_DIARIA = 'BII_COTA_DIARIA';
export const MENSAGEM_COTA_DIARIA = 'Limite diário de análises da empresa atingido. Tente amanhã.';
export const CODIGO_SOMENTE_LEITURA = 'BII_SOMENTE_LEITURA';
export const MENSAGEM_SOMENTE_LEITURA =
  'No modo de acesso do Super Usuário o BII é somente leitura. Entre com um Administrador da empresa para criar análises.';
export const ANALISES_POR_DIA_PADRAO = 200;

// BII_ANALISES_POR_DIA (opcional): inteiro >= 1; invalido/ausente -> 200.
export function analisesPorDia(valor = process.env.BII_ANALISES_POR_DIA): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : ANALISES_POR_DIA_PADRAO;
}

export const OBSERVACAO_FONTE =
  'Área construída do IPTU inclui a parte das áreas comuns; o R$/m² fica abaixo do de área privativa.';

export interface AnalisarEnderecoInput {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  impersonadoPor: string | null;
  endereco: string;
  raioMetros?: number;
  meses?: number;
  areaMin?: number | null;
  areaMax?: number | null;
  tipo?: TipoImovelAnalise;
  somenteCompraVenda?: boolean;
  agora?: Date; // so para teste
}

export interface AnaliseEnderecoResponse {
  id: string;
  endereco: { digitado: string; formatado: string; lat: number; lng: number; precisao: 'rooftop' | 'rua' | 'cep' | 'bairro' };
  parametros: {
    raioMetros: number;
    meses: number;
    areaMin: number | null;
    areaMax: number | null;
    tipo: TipoImovelAnalise;
    somenteCompraVenda: boolean;
    de: string;
    ate: string;
  };
  cobertura: { transacoesNoPeriodoNaRegiao: number; semLocalizacao: number };
  resumo: ResultadoCalculo['resumo'];
  porMes: ResultadoCalculo['porMes'];
  amostra: ResultadoCalculo['amostra'];
  planta: ResultadoCalculo['planta'];
  financiamento: ResultadoCalculo['financiamento'];
  fonte: { nome: typeof FONTE_ITBI; atualizadoAte: string | null; observacao: string };
  criadoEm: string;
}

@Injectable()
export class AnalisarEnderecoUseCase {
  private readonly logger = new Logger(AnalisarEnderecoUseCase.name);
  // lido a cada chamada (env pode mudar com pm2 --update-env); substituivel em teste
  limitePorDia: () => number = () => analisesPorDia();

  constructor(
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: IGeocodingProvider,
    @Inject(ITBI_REPOSITORY) private readonly itbiRepo: IItbiRepository,
    @Inject(BII_ANALISE_REPOSITORY) private readonly analiseRepo: IBiiAnaliseRepository,
  ) {}

  async execute(input: AnalisarEnderecoInput): Promise<AnaliseEnderecoResponse> {
    exigirAdministrador(input.requesterRole);
    // Super Usuario impersonando: BII so leitura (decisao do Villar, Fase 1).
    // Corpo com code estavel para o frontend nao depender do texto.
    if (input.impersonadoPor) {
      throw new ForbiddenException({ statusCode: 403, code: CODIGO_SOMENTE_LEITURA, message: MENSAGEM_SOMENTE_LEITURA });
    }

    const raioMetros = input.raioMetros ?? 1000;
    const meses = input.meses ?? 12;
    const tipo = input.tipo ?? 'residencial';
    const somenteCompraVenda = input.somenteCompraVenda ?? true;
    const areaMin = input.areaMin ?? null;
    const areaMax = input.areaMax ?? null;
    if (!(RAIOS_PERMITIDOS as readonly number[]).includes(raioMetros)) throw new BadRequestException('Raio inválido.');
    if (!(MESES_PERMITIDOS as readonly number[]).includes(meses)) throw new BadRequestException('Período inválido.');
    if (areaMin !== null && areaMax !== null && areaMin > areaMax) {
      throw new BadRequestException('A área mínima não pode ser maior que a área máxima.');
    }
    const digitado = limparEnderecoDigitado(input.endereco);
    if (digitado.length < 5 || digitado.length > 200) {
      throw new BadRequestException('Informe um endereço entre 5 e 200 caracteres.');
    }

    // Cota diaria por tenant (antes de gastar geocodificacao). Dia = calendario
    // local do servidor. Duas analises simultaneas podem passar 1 acima do
    // limite (no maximo 2 por processo) - aceito.
    const agora = input.agora ?? new Date();
    const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const limiteDia = this.limitePorDia();
    if ((await this.analiseRepo.contarDesde(input.tenantId, inicioDoDia)) >= limiteDia) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: CODIGO_COTA_DIARIA, message: MENSAGEM_COTA_DIARIA },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let ponto;
    try {
      ponto = await this.geocoder.geocodificar(digitado);
    } catch (erro) {
      if (erro instanceof GeocodingIndisponivelError) throw new ServiceUnavailableException(MENSAGEM_MAPAS_INDISPONIVEL);
      throw erro;
    }
    if (!ponto || !dentroDaGrandeSP(ponto)) throw new UnprocessableEntityException(MENSAGEM_ENDERECO_NAO_ENCONTRADO);

    // Periodo termina no ultimo dia com dado do ITBI (a Prefeitura publica com
    // atraso) - senao "ultimos 12 meses" ficaria vazio no fim.
    const hoje = hojeUtc(agora);
    const atualizadoAte = await this.itbiRepo.maiorDataTransacao();
    const ate = atualizadoAte && atualizadoAte.getTime() < hoje.getTime() ? atualizadoAte : hoje;
    const { de } = periodoDeMeses(ate, meses);
    const ateExclusivo = somarDiasUtc(ate, 1);
    const naturezaCodigo = somenteCompraVenda ? NATUREZA_COMPRA_E_VENDA : null;

    const centro = { lat: ponto.lat, lng: ponto.lng };
    const linhas = await this.itbiRepo.buscarNoBbox({
      bbox: boundingBox(centro, raioMetros),
      de,
      ateExclusivo,
      naturezaCodigo,
      limite: ANALISE_LIMITE_LINHAS,
    });
    if (linhas.length >= ANALISE_LIMITE_LINHAS) {
      this.logger.warn(`BII analise: limite de ${ANALISE_LIMITE_LINHAS} linhas atingido (tenant=${input.tenantId})`);
    }
    const calc = calcularAnaliseEndereco(linhas, {
      centro,
      raioMetros,
      de,
      ate,
      tipo,
      somenteCompraVenda,
      areaMin,
      areaMax,
    });

    // ITBI da regiao (mesmo prefixo de CEP) ainda sem ponto - so se o
    // geocodificador devolveu CEP (nunca inventado).
    const cepPrefixo = prefixoCep(ponto.cep);
    const semLocalizacao = cepPrefixo
      ? await this.itbiRepo.contarSemLocalizacao({ cepPrefixo, de, ateExclusivo, naturezaCodigo })
      : 0;

    // cache de texto digitado nao guarda endereco por extenso (B2): num acerto
    // de cache o formatado vem vazio e vale o texto digitado
    const formatado = ponto.enderecoFormatado || digitado;
    const corpo: Omit<AnaliseEnderecoResponse, 'id' | 'criadoEm'> = {
      endereco: { digitado, formatado, lat: ponto.lat, lng: ponto.lng, precisao: ponto.precisao },
      parametros: { raioMetros, meses, areaMin, areaMax, tipo, somenteCompraVenda, de: formatarDataUtc(de), ate: formatarDataUtc(ate) },
      cobertura: { transacoesNoPeriodoNaRegiao: calc.noRaio + semLocalizacao, semLocalizacao },
      resumo: calc.resumo,
      porMes: calc.porMes,
      amostra: calc.amostra,
      planta: calc.planta,
      financiamento: calc.financiamento,
      fonte: { nome: FONTE_ITBI, atualizadoAte: atualizadoAte ? formatarDataUtc(atualizadoAte) : null, observacao: OBSERVACAO_FONTE },
    };

    const salvo = await this.analiseRepo.criar({
      tenantId: input.tenantId,
      createdById: input.requesterUserId,
      impersonadoPor: input.impersonadoPor,
      enderecoDigitado: digitado,
      enderecoFormatado: formatado.slice(0, 500),
      lat: ponto.lat,
      lng: ponto.lng,
      precisao: ponto.precisao,
      raioMetros,
      meses,
      areaMin,
      areaMax,
      transacoes: calc.resumo.transacoes,
      precoM2Mediano: calc.resumo.precoM2Mediano,
      resultado: corpo as unknown as Record<string, unknown>,
    });

    this.logger.log(
      `BII analise ${salvo.id} tenant=${input.tenantId} user=${input.requesterUserId} impersonadoPor=${input.impersonadoPor ?? '-'} raio=${raioMetros} meses=${meses} transacoes=${calc.resumo.transacoes}`,
    );

    return { id: salvo.id, ...corpo, criadoEm: salvo.createdAt.toISOString() };
  }
}
