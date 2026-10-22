// src/modules/bii/application/use-cases/concorrentes.use-cases.ts
// Fatia 3 - CRUD de concorrentes (cadastro manual, POR TENANT). So
// Administrador (checado aqui tambem). Escrita bloqueada em impersonacao do
// Super Usuario (403 BII_SOMENTE_LEITURA). Geocodifica na criacao e quando o
// endereco muda; latitude+longitude informadas = pino ajustado a mao
// (precisao "manual", sem geocodificar). Contrato:
// docs/bii/fatia3/CONTRATO_CONCORRENTES.md
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GEOCODING_PROVIDER,
  GeocodingIndisponivelError,
  IGeocodingProvider,
} from '../../domain/ports/geocoding-provider.interface';
import {
  CONCORRENTE_REPOSITORY,
  ConcorrenteRegistro,
  DadosConcorrente,
  IConcorrenteRepository,
} from '../../domain/repositories/concorrente-repository.interface';
import {
  calcularConcorrente,
  calcularTipologia,
  ConcorrenteCalculado,
  FASES_CONCORRENTE,
  FaseConcorrente,
  limparTextoCurto,
  limparTextoLongo,
  MAX_CONCORRENTES_POR_TENANT,
  parseDataLancamento,
  TipologiaCalculada,
  TipologiaEntrada,
  validarFonteUrl,
  validarTipologias,
  validarVendas,
} from '../../domain/services/concorrente';
import { formatarDataUtc } from '../../domain/services/data-utc';
import { limparEnderecoDigitado } from '../../domain/services/endereco';
import { coordenadaValida, dentroDaGrandeSP } from '../../domain/services/geo';
import { MENSAGEM_ENDERECO_NAO_ENCONTRADO, MENSAGEM_MAPAS_INDISPONIVEL } from './mensagens-geo';
import { bloquearImpersonacao, exigirAdministrador, MENSAGEM_SOMENTE_LEITURA_CONCORRENTES } from './permissoes-bii';

export const MENSAGEM_CONCORRENTE_NAO_ENCONTRADO = 'Concorrente não encontrado.';
export const MENSAGEM_LIMITE_CONCORRENTES = `A empresa já tem ${MAX_CONCORRENTES_POR_TENANT} concorrentes cadastrados (o limite). Exclua os que não usa mais.`;
export const MENSAGEM_PONTO_FORA = 'A posição informada no mapa está fora da Grande São Paulo.';
export const CODIGO_COTA_GEOCODIFICACAO = 'BII_COTA_DIARIA';
export const GEOCODIFICACOES_CONCORRENTE_POR_DIA_PADRAO = 100;
export const MENSAGEM_COTA_GEOCODIFICACAO =
  'Limite diário de buscas de endereço de concorrentes da empresa atingido. Tente amanhã, ou ajuste a posição direto no mapa.';

// BII_CONCORRENTE_GEOCODIFICACOES_POR_DIA (opcional): inteiro >= 1; padrao 100.
export function geocodificacoesConcorrentePorDia(valor = process.env.BII_CONCORRENTE_GEOCODIFICACOES_POR_DIA): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : GEOCODIFICACOES_CONCORRENTE_POR_DIA_PADRAO;
}

export interface ConcorrenteResposta {
  id: string;
  nome: string;
  construtora: string | null;
  endereco: string;
  enderecoFormatado: string | null;
  lat: number;
  lng: number;
  precisao: string;
  fase: FaseConcorrente;
  dataLancamento: string | null;
  totalUnidades: number | null;
  unidadesVendidas: number | null;
  fonte: string | null;
  fonteUrl: string | null;
  observacoes: string | null;
  origem: string;
  tipologias: TipologiaCalculada[];
  calculado: ConcorrenteCalculado;
  criadoEm: string;
  atualizadoEm: string;
}

export function montarConcorrenteResposta(r: ConcorrenteRegistro, agora: Date): ConcorrenteResposta {
  const tipologias = r.tipologias.map(calcularTipologia);
  return {
    id: r.id,
    nome: r.nome,
    construtora: r.construtora,
    endereco: r.endereco,
    enderecoFormatado: r.enderecoFormatado,
    lat: r.lat,
    lng: r.lng,
    precisao: r.precisao,
    fase: r.fase,
    dataLancamento: r.dataLancamento ? formatarDataUtc(r.dataLancamento) : null,
    totalUnidades: r.totalUnidades,
    unidadesVendidas: r.unidadesVendidas,
    fonte: r.fonte,
    fonteUrl: r.fonteUrl,
    observacoes: r.observacoes,
    origem: r.origem,
    tipologias,
    calculado: calcularConcorrente(
      tipologias,
      { totalUnidades: r.totalUnidades, unidadesVendidas: r.unidadesVendidas, dataLancamento: r.dataLancamento },
      r.updatedAt,
      agora,
    ),
    criadoEm: r.createdAt.toISOString(),
    atualizadoEm: r.updatedAt.toISOString(),
  };
}

// Versao para o SNAPSHOT da analise (BiiAnalise.resultado): sem os campos de
// texto livre (observacoes, fonte, fonteUrl) - excluir o concorrente depois
// nao deixa esses textos guardados nas analises antigas (LGPD).
export type ConcorrenteNoSnapshot = Omit<ConcorrenteResposta, 'observacoes' | 'fonte' | 'fonteUrl'>;

export function paraSnapshot(c: ConcorrenteResposta): ConcorrenteNoSnapshot {
  const { observacoes: _o, fonte: _f, fonteUrl: _u, ...resto } = c;
  return resto;
}

export interface ConcorrenteEntrada {
  nome: string;
  construtora?: string | null;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  fase: string;
  dataLancamento?: string | null;
  totalUnidades?: number | null;
  unidadesVendidas?: number | null;
  fonte?: string | null;
  fonteUrl?: string | null;
  observacoes?: string | null;
  tipologias: TipologiaEntrada[];
}

interface Requisitante {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  impersonadoPor: string | null;
  agora?: Date;
}

function textoOuNull(v: string | null | undefined, limpar: (s: string) => string): string | null {
  if (v === null || v === undefined) return null;
  const s = limpar(v);
  return s.length ? s : null;
}

// Valida e normaliza tudo menos a localizacao. Erro -> 400.
function normalizar(e: ConcorrenteEntrada): Omit<DadosConcorrente, 'lat' | 'lng' | 'precisao' | 'enderecoFormatado'> {
  const nome = limparTextoCurto(e.nome ?? '');
  if (nome.length < 2 || nome.length > 150) throw new BadRequestException('Informe o nome do empreendimento (2 a 150 caracteres).');
  const endereco = limparEnderecoDigitado(e.endereco ?? '');
  if (endereco.length < 5 || endereco.length > 200) throw new BadRequestException('Informe um endereço entre 5 e 200 caracteres.');
  if (!(FASES_CONCORRENTE as readonly string[]).includes(e.fase)) throw new BadRequestException('Fase inválida.');

  let dataLancamento: Date | null = null;
  if (e.dataLancamento) {
    dataLancamento = parseDataLancamento(e.dataLancamento);
    if (!dataLancamento) throw new BadRequestException('Data de lançamento inválida.');
  }
  const totalUnidades = e.totalUnidades ?? null;
  const unidadesVendidas = e.unidadesVendidas ?? null;
  const erroVendas = validarVendas({ totalUnidades, unidadesVendidas });
  if (erroVendas) throw new BadRequestException(erroVendas);

  const tipologias: TipologiaEntrada[] = (e.tipologias ?? []).map((t) => ({
    descricao: limparTextoCurto(t.descricao ?? '').slice(0, 100),
    dormitorios: t.dormitorios ?? null,
    areaPrivativa: t.areaPrivativa,
    precoDe: t.precoDe,
    precoAte: t.precoAte ?? null,
  }));
  const erroTip = validarTipologias(tipologias);
  if (erroTip) throw new BadRequestException(erroTip);

  const fonteUrl = textoOuNull(e.fonteUrl, (s) => s.trim());
  if (fonteUrl) {
    const erroUrl = validarFonteUrl(fonteUrl);
    if (erroUrl) throw new BadRequestException(erroUrl);
  }

  return {
    nome,
    construtora: textoOuNull(e.construtora, limparTextoCurto)?.slice(0, 150) ?? null,
    endereco,
    fase: e.fase as FaseConcorrente,
    dataLancamento,
    totalUnidades,
    unidadesVendidas,
    fonte: textoOuNull(e.fonte, limparTextoCurto)?.slice(0, 120) ?? null,
    fonteUrl,
    observacoes: textoOuNull(e.observacoes, limparTextoLongo)?.slice(0, 1000) ?? null,
    tipologias,
  };
}

// Ponto manual: os dois juntos, numeros validos, dentro da Grande SP.
function pontoManual(e: ConcorrenteEntrada): { lat: number; lng: number } | null {
  const temLat = e.latitude !== null && e.latitude !== undefined;
  const temLng = e.longitude !== null && e.longitude !== undefined;
  if (!temLat && !temLng) return null;
  if (temLat !== temLng) throw new BadRequestException('Informe latitude e longitude juntas.');
  const p = { lat: e.latitude as number, lng: e.longitude as number };
  if (!coordenadaValida(p) || !dentroDaGrandeSP(p)) throw new BadRequestException(MENSAGEM_PONTO_FORA);
  return p;
}

// Cota DIARIA de geocodificacoes de concorrente por tenant (protege a fila
// global do Nominatim, compartilhada com a analise de todos os tenants).
// Contador em memoria por dia local e por processo (uma instancia no PM2;
// reiniciar zera - aceito, e anti-abuso). Conta toda tentativa (inclusive
// acerto de cache: conservador).
@Injectable()
export class ConcorrenteGeocodificador {
  limitePorDia: () => number = () => geocodificacoesConcorrentePorDia();
  agora: () => Date = () => new Date();
  private dia = '';
  private porTenant = new Map<string, number>();

  constructor(@Inject(GEOCODING_PROVIDER) private readonly geocoder: IGeocodingProvider) {}

  private consumirCota(tenantId: string): void {
    const d = this.agora();
    const hoje = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (hoje !== this.dia) {
      this.dia = hoje;
      this.porTenant.clear();
    }
    const usados = this.porTenant.get(tenantId) ?? 0;
    if (usados >= this.limitePorDia()) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: CODIGO_COTA_GEOCODIFICACAO, message: MENSAGEM_COTA_GEOCODIFICACAO },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.porTenant.set(tenantId, usados + 1);
  }

  async localizar(tenantId: string, endereco: string): Promise<{ lat: number; lng: number; precisao: string; enderecoFormatado: string | null }> {
    this.consumirCota(tenantId);
    let ponto;
    try {
      ponto = await this.geocoder.geocodificar(endereco);
    } catch (erro) {
      if (erro instanceof GeocodingIndisponivelError) throw new ServiceUnavailableException(MENSAGEM_MAPAS_INDISPONIVEL);
      throw erro;
    }
    if (!ponto || !dentroDaGrandeSP(ponto)) throw new UnprocessableEntityException(MENSAGEM_ENDERECO_NAO_ENCONTRADO);
    return {
      lat: ponto.lat,
      lng: ponto.lng,
      precisao: ponto.precisao,
      enderecoFormatado: ponto.enderecoFormatado ? ponto.enderecoFormatado.slice(0, 500) : null,
    };
  }
}

@Injectable()
export class ListConcorrentesUseCase {
  constructor(@Inject(CONCORRENTE_REPOSITORY) private readonly repo: IConcorrenteRepository) {}

  async execute(input: { tenantId: string; requesterRole: string; agora?: Date }): Promise<ConcorrenteResposta[]> {
    exigirAdministrador(input.requesterRole);
    const agora = input.agora ?? new Date();
    const rows = await this.repo.listarPorTenant(input.tenantId, MAX_CONCORRENTES_POR_TENANT);
    return rows.map((r) => montarConcorrenteResposta(r, agora));
  }
}

@Injectable()
export class GetConcorrenteUseCase {
  constructor(@Inject(CONCORRENTE_REPOSITORY) private readonly repo: IConcorrenteRepository) {}

  async execute(input: { tenantId: string; requesterRole: string; id: string; agora?: Date }): Promise<ConcorrenteResposta> {
    exigirAdministrador(input.requesterRole);
    const r = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!r) throw new NotFoundException(MENSAGEM_CONCORRENTE_NAO_ENCONTRADO);
    return montarConcorrenteResposta(r, input.agora ?? new Date());
  }
}

@Injectable()
export class CreateConcorrenteUseCase {
  private readonly logger = new Logger(CreateConcorrenteUseCase.name);

  constructor(
    @Inject(CONCORRENTE_REPOSITORY) private readonly repo: IConcorrenteRepository,
    private readonly geocodificador: ConcorrenteGeocodificador,
  ) {}

  async execute(input: Requisitante & { dados: ConcorrenteEntrada }): Promise<ConcorrenteResposta> {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_CONCORRENTES);
    const base = normalizar(input.dados);
    const manual = pontoManual(input.dados);
    // limite antes de gastar geocodificacao. Duas criacoes simultaneas podem
    // passar 1 acima - aceito (limite e anti-abuso, nao regra de negocio).
    if ((await this.repo.contarPorTenant(input.tenantId)) >= MAX_CONCORRENTES_POR_TENANT) {
      throw new ConflictException(MENSAGEM_LIMITE_CONCORRENTES);
    }
    const local = manual
      ? { ...manual, precisao: 'manual', enderecoFormatado: null }
      : await this.geocodificador.localizar(input.tenantId, base.endereco);
    const salvo = await this.repo.criar(input.tenantId, input.requesterUserId, { ...base, ...local });
    this.logger.log(`BII concorrente criado ${salvo.id} tenant=${input.tenantId} user=${input.requesterUserId}`);
    return montarConcorrenteResposta(salvo, input.agora ?? new Date());
  }
}

@Injectable()
export class UpdateConcorrenteUseCase {
  private readonly logger = new Logger(UpdateConcorrenteUseCase.name);

  constructor(
    @Inject(CONCORRENTE_REPOSITORY) private readonly repo: IConcorrenteRepository,
    private readonly geocodificador: ConcorrenteGeocodificador,
  ) {}

  async execute(input: Requisitante & { id: string; dados: ConcorrenteEntrada }): Promise<ConcorrenteResposta> {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_CONCORRENTES);
    const base = normalizar(input.dados);
    const manual = pontoManual(input.dados);
    const atual = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!atual) throw new NotFoundException(MENSAGEM_CONCORRENTE_NAO_ENCONTRADO);

    let local: { lat: number; lng: number; precisao: string; enderecoFormatado: string | null };
    if (manual) {
      // endereco novo + pino manual: o formatado antigo nao vale mais
      local = { ...manual, precisao: 'manual', enderecoFormatado: base.endereco === atual.endereco ? atual.enderecoFormatado : null };
    } else if (base.endereco === atual.endereco) {
      // endereco igual: mantem o ponto (inclusive um ajuste manual anterior)
      local = { lat: atual.lat, lng: atual.lng, precisao: atual.precisao, enderecoFormatado: atual.enderecoFormatado };
    } else {
      local = await this.geocodificador.localizar(input.tenantId, base.endereco);
    }

    const ok = await this.repo.atualizar(input.id, input.tenantId, input.requesterUserId, { ...base, ...local });
    if (!ok) throw new NotFoundException(MENSAGEM_CONCORRENTE_NAO_ENCONTRADO);
    const salvo = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!salvo) throw new NotFoundException(MENSAGEM_CONCORRENTE_NAO_ENCONTRADO);
    this.logger.log(`BII concorrente atualizado ${input.id} tenant=${input.tenantId} user=${input.requesterUserId}`);
    return montarConcorrenteResposta(salvo, input.agora ?? new Date());
  }
}

@Injectable()
export class DeleteConcorrenteUseCase {
  private readonly logger = new Logger(DeleteConcorrenteUseCase.name);

  constructor(@Inject(CONCORRENTE_REPOSITORY) private readonly repo: IConcorrenteRepository) {}

  async execute(input: Requisitante & { id: string }): Promise<void> {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_CONCORRENTES);
    const ok = await this.repo.excluir(input.id, input.tenantId);
    if (!ok) throw new NotFoundException(MENSAGEM_CONCORRENTE_NAO_ENCONTRADO);
    this.logger.log(`BII concorrente excluido ${input.id} tenant=${input.tenantId} user=${input.requesterUserId}`);
  }
}
