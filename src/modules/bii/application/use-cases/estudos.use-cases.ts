// src/modules/bii/application/use-cases/estudos.use-cases.ts
// Fatia 5 - Estudo de terreno (POR TENANT). So Administrador (checado aqui
// tambem). Parte de uma BiiAnalise do PROPRIO tenant (nunca geocodifica nem le
// ITBI) e grava um snapshot: copia da analise + viabilidade + posicionamento.
// Impersonacao do Super Usuario: leitura liberada; escrita -> 403
// BII_SOMENTE_LEITURA. Log sem endereco, nome ou conclusao.
// Contrato: docs/bii/fatia5/CONTRATO_ESTUDO.md
import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BII_ANALISE_REPOSITORY, IBiiAnaliseRepository } from '../../domain/repositories/bii-analise-repository.interface';
import { ESTUDO_REPOSITORY, EstudoCompleto, IEstudoRepository } from '../../domain/repositories/estudo-repository.interface';
import { limparTextoCurto, limparTextoLongo } from '../../domain/services/concorrente';
import { AnaliseParaEstudo, contarSituacoes, LIMITE_ESTUDOS_POR_TENANT, montarEstudo } from '../../domain/services/estudo';
import type { Premissas, TipologiaViabilidade } from '../../domain/services/viabilidade';
import { bloquearImpersonacao, exigirAdministrador } from './permissoes-bii';
import { calcularViabilidade } from './viabilidade.use-cases';

export const LIMITE_LISTA_ESTUDOS = 100;
export const VERSAO_ESTUDO = 1;
export const MENSAGEM_ESTUDO_NAO_ENCONTRADO = 'Estudo não encontrado.';
export const MENSAGEM_ANALISE_NAO_ENCONTRADA = 'Análise não encontrada.';
export const MENSAGEM_LIMITE_ESTUDOS = `A empresa já tem ${LIMITE_ESTUDOS_POR_TENANT} estudos salvos (o limite). Exclua os que não usa mais.`;
export const MENSAGEM_SOMENTE_LEITURA_ESTUDOS =
  'No modo de acesso do Super Usuário o BII é somente leitura. Entre com um Administrador da empresa para criar ou alterar estudos.';

interface Requisitante {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  impersonadoPor: string | null;
}

export interface CriarEstudoInput extends Requisitante {
  analiseId: string;
  nome: string;
  conclusao?: string | null;
  tipologias: TipologiaViabilidade[];
  premissas?: Partial<Premissas>;
  agora?: Date;
}

export interface EstudoListaItem {
  id: string;
  nome: string;
  endereco: string;
  raioMetros: number;
  meses: number;
  situacao: { ok: number; atencao: number; fora: number };
  criadoEm: string;
  atualizadoEm: string;
}

function limparNome(nome: string): string {
  const n = limparTextoCurto(nome);
  if (n.length < 3 || n.length > 120) throw new BadRequestException('O nome do estudo deve ter entre 3 e 120 caracteres.');
  return n;
}

function limparConclusao(c: string | null | undefined): string | null {
  if (c === null || c === undefined) return null;
  const t = limparTextoLongo(c);
  if (t.length > 5000) throw new BadRequestException('A conclusão pode ter no máximo 5.000 caracteres.');
  return t.length ? t : null;
}

// O snapshot da analise e Json: confere so o minimo que o estudo usa.
function lerAnalise(resultado: Record<string, unknown>): AnaliseParaEstudo & { endereco: { formatado: string } } {
  const r = resultado as Partial<AnaliseParaEstudo> & { endereco?: { formatado?: unknown } };
  const ok =
    r.parametros &&
    typeof r.parametros.raioMetros === 'number' &&
    typeof r.parametros.meses === 'number' &&
    r.resumo &&
    typeof r.resumo.transacoes === 'number' &&
    r.endereco &&
    typeof r.endereco.formatado === 'string';
  if (!ok) throw new BadRequestException('Esta análise está num formato que o estudo não lê. Faça uma análise nova.');
  // campos numericos opcionais ausentes viram null (nunca undefined no dominio)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const resumo = r.resumo!;
  return {
    ...(r as AnaliseParaEstudo & { endereco: { formatado: string } }),
    parametros: { ...r.parametros!, de: String(r.parametros!.de ?? ''), ate: String(r.parametros!.ate ?? '') },
    resumo: { transacoes: resumo.transacoes, precoM2Mediano: n(resumo.precoM2Mediano), precoM2P25: n(resumo.precoM2P25), precoM2P75: n(resumo.precoM2P75) },
  };
}

export function montarRespostaEstudo(e: EstudoCompleto) {
  // snapshot primeiro: as colunas reais sempre prevalecem sobre chaves do Json
  return {
    ...e.resultado,
    id: e.id,
    nome: e.nome,
    conclusao: e.conclusao,
    analiseId: e.analiseId,
    criadoEm: e.createdAt.toISOString(),
    atualizadoEm: e.updatedAt.toISOString(),
  };
}

@Injectable()
export class ListEstudosUseCase {
  constructor(@Inject(ESTUDO_REPOSITORY) private readonly repo: IEstudoRepository) {}

  async execute(input: { tenantId: string; requesterRole: string }): Promise<EstudoListaItem[]> {
    exigirAdministrador(input.requesterRole);
    const lista = await this.repo.listarPorTenant(input.tenantId, LIMITE_LISTA_ESTUDOS);
    return lista.map((e) => ({
      id: e.id,
      nome: e.nome,
      endereco: e.enderecoFormatado,
      raioMetros: e.raioMetros,
      meses: e.meses,
      situacao: e.situacaoResumo,
      criadoEm: e.createdAt.toISOString(),
      atualizadoEm: e.updatedAt.toISOString(),
    }));
  }
}

@Injectable()
export class GetEstudoUseCase {
  constructor(@Inject(ESTUDO_REPOSITORY) private readonly repo: IEstudoRepository) {}

  async execute(input: { tenantId: string; requesterRole: string; id: string }) {
    exigirAdministrador(input.requesterRole);
    const e = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!e) throw new NotFoundException(MENSAGEM_ESTUDO_NAO_ENCONTRADO);
    return montarRespostaEstudo(e);
  }
}

@Injectable()
export class CriarEstudoUseCase {
  private readonly logger = new Logger(CriarEstudoUseCase.name);

  constructor(
    @Inject(ESTUDO_REPOSITORY) private readonly repo: IEstudoRepository,
    @Inject(BII_ANALISE_REPOSITORY) private readonly analiseRepo: IBiiAnaliseRepository,
  ) {}

  async execute(input: CriarEstudoInput) {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_ESTUDOS);
    const nome = limparNome(input.nome);
    const conclusao = limparConclusao(input.conclusao);
    if (!input.tipologias.length || input.tipologias.length > 20) {
      throw new BadRequestException('Informe de 1 a 20 tipologias.');
    }
    // Duas criacoes simultaneas podem passar 1 acima - aceito (anti-abuso).
    if ((await this.repo.contarPorTenant(input.tenantId)) >= LIMITE_ESTUDOS_POR_TENANT) {
      throw new ConflictException(MENSAGEM_LIMITE_ESTUDOS);
    }
    // sempre { id, tenantId }: de outro tenant = inexistente (mesmo 404)
    const analise = await this.analiseRepo.buscarPorIdETenant(input.analiseId, input.tenantId);
    if (!analise) throw new NotFoundException(MENSAGEM_ANALISE_NAO_ENCONTRADA);
    const snapshot = lerAnalise(analise.resultado);

    const agora = input.agora ?? new Date();
    const viabilidade = calcularViabilidade(input.tipologias, input.premissas, agora);
    const montagem = montarEstudo({ analise: snapshot, analiseCriadaEm: analise.createdAt, viabilidade: viabilidade.resultados, agora });
    const situacaoResumo = contarSituacoes(viabilidade.resultados);

    const resultado = {
      versao: VERSAO_ESTUDO,
      analise: { id: analise.id, ...analise.resultado, criadoEm: analise.createdAt.toISOString() },
      viabilidade,
      ...montagem,
    };

    const salvo = await this.repo.criar({
      tenantId: input.tenantId,
      userId: input.requesterUserId,
      analiseId: analise.id,
      nome,
      enderecoFormatado: snapshot.endereco.formatado,
      raioMetros: snapshot.parametros.raioMetros,
      meses: snapshot.parametros.meses,
      tipologias: viabilidade.resultados.map((r) => ({ descricao: r.descricao, areaPrivativa: r.areaPrivativa, preco: r.preco })),
      premissas: viabilidade.premissas as unknown as Record<string, unknown>,
      conclusao,
      situacaoResumo,
      resultado,
    });
    this.logger.log(
      `BII estudo criado ${salvo.id} tenant=${input.tenantId} user=${input.requesterUserId} analise=${analise.id} tipologias=${input.tipologias.length}`,
    );
    return montarRespostaEstudo(salvo);
  }
}

@Injectable()
export class AtualizarEstudoUseCase {
  private readonly logger = new Logger(AtualizarEstudoUseCase.name);

  constructor(@Inject(ESTUDO_REPOSITORY) private readonly repo: IEstudoRepository) {}

  // So nome e conclusao: o snapshot nunca e recalculado.
  async execute(input: Requisitante & { id: string; nome?: string; conclusao?: string | null }) {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_ESTUDOS);
    const dados: { nome?: string; conclusao?: string | null } = {};
    if (input.nome !== undefined) {
      if (typeof input.nome !== 'string') throw new BadRequestException('Dê um nome ao estudo.');
      dados.nome = limparNome(input.nome);
    }
    if (input.conclusao !== undefined) dados.conclusao = limparConclusao(input.conclusao);
    if (!Object.keys(dados).length) throw new BadRequestException('Informe o nome ou a conclusão.');
    const ok = await this.repo.atualizarTextos(input.id, input.tenantId, input.requesterUserId, dados);
    if (!ok) throw new NotFoundException(MENSAGEM_ESTUDO_NAO_ENCONTRADO);
    this.logger.log(`BII estudo alterado ${input.id} tenant=${input.tenantId} user=${input.requesterUserId}`);
    const e = await this.repo.buscarPorIdETenant(input.id, input.tenantId);
    if (!e) throw new NotFoundException(MENSAGEM_ESTUDO_NAO_ENCONTRADO);
    return montarRespostaEstudo(e);
  }
}

@Injectable()
export class ExcluirEstudoUseCase {
  private readonly logger = new Logger(ExcluirEstudoUseCase.name);

  constructor(@Inject(ESTUDO_REPOSITORY) private readonly repo: IEstudoRepository) {}

  async execute(input: Requisitante & { id: string }): Promise<void> {
    exigirAdministrador(input.requesterRole);
    bloquearImpersonacao(input.impersonadoPor, MENSAGEM_SOMENTE_LEITURA_ESTUDOS);
    if (!(await this.repo.excluir(input.id, input.tenantId))) throw new NotFoundException(MENSAGEM_ESTUDO_NAO_ENCONTRADO);
    this.logger.log(`BII estudo excluido ${input.id} tenant=${input.tenantId} user=${input.requesterUserId}`);
  }
}
