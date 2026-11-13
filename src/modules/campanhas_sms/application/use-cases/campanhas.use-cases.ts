// src/modules/campanhas_sms/application/use-cases/campanhas.use-cases.ts
// Casos de uso da TELA (Administrador do tenant). Todo acesso por
// { tenantId, id }. Impersonacao do Super Usuario: leitura liberada, escrita
// 403 CAMPANHA_SOMENTE_LEITURA. Contrato: docs/campanhas/CONTRATO_CAMPANHA_SMS.md
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CAMPANHA_REPOSITORY,
  CampanhaRecord,
  Contagens,
  ContatoRecord,
  FiltroContatos,
  ICampanhaRepository,
  NovoContato,
} from '../../domain/repositories/campanha-repository.interface';
import {
  LIMITES,
  PADROES,
  STATUS_CONTATO,
  StatusContato,
  celulaCsvSegura,
  podeCancelar,
  podeEditar,
  podeIniciar,
  podePausar,
  validarConfig,
  validarLinkDestino,
} from '../../domain/services/campanha-regras';
import { analisarPiorCaso, analisarTexto, montarMensagem, validarModelo, AnaliseTexto } from '../../domain/services/sms-texto';
import { formatarCelular, mascararTelefone, normalizarCelularBR } from '../../domain/services/telefone';
import { CabecalhoInvalidoError, lerContatos } from '../../domain/services/importacao';
import { ArquivoInvalidoError, ILeitorPlanilhaContatos, LEITOR_PLANILHA } from '../../domain/services/leitor-planilha.interface';
import { ISmsProvider, SMS_PROVIDER, SmsProviderError } from '../../domain/services/sms-provider.interface';
import { CampanhaConfig } from '../services/campanha-config';
import { GeradorCodigoService } from '../services/gerador-codigo.service';

export const CODIGO_SOMENTE_LEITURA = 'CAMPANHA_SOMENTE_LEITURA';

export interface Requisitante {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  impersonadoPor?: string | null;
}

function garantirAdmin(role: string): void {
  if (role !== 'Administrador') throw new ForbiddenException('Somente o Administrador gerencia campanhas de SMS.');
}

function garantirEscrita(r: Requisitante): void {
  garantirAdmin(r.requesterRole);
  if (r.impersonadoPor) {
    throw new ForbiddenException({
      statusCode: 403,
      code: CODIGO_SOMENTE_LEITURA,
      message: 'Acesso de suporte é somente leitura: não é possível alterar ou disparar campanhas.',
    });
  }
}

function erro(status: 'conflito' | 'regra' | 'indisponivel', code: string, message: string): never {
  const corpo = { code, message };
  if (status === 'conflito') throw new ConflictException({ statusCode: 409, ...corpo });
  if (status === 'regra') throw new UnprocessableEntityException({ statusCode: 422, ...corpo });
  throw new ServiceUnavailableException({ statusCode: 503, ...corpo });
}

function contagemVazia(): Contagens {
  const base = Object.fromEntries(STATUS_CONTATO.map((s) => [s, 0])) as Record<StatusContato, number>;
  return { ...base, total: 0, comClique: 0, cliquesTotais: 0, comResposta: 0 };
}

export interface CampanhaResumo extends CampanhaRecord {
  contagens: Contagens;
}

export interface CampanhaDetalhe extends CampanhaResumo {
  linkBase: string;
  linkTeste: string;
  provedor: { nome: string; simulado: boolean; disponivel: boolean };
  // Analise do pior caso (maior primeiro nome dos pendentes + link real).
  mensagemAnalise: (AnaliseTexto & { exemplo: string; cabe: boolean; maiorPrimeiroNome: string }) | null;
}

abstract class BaseCampanha {
  constructor(protected readonly repo: ICampanhaRepository) {}

  protected async carregar(tenantId: string, id: string): Promise<CampanhaRecord> {
    const c = await this.repo.buscar(tenantId, id);
    if (!c) throw new NotFoundException('Campanha não encontrada.');
    return c;
  }
}

@Injectable()
export class ListarCampanhasUseCase extends BaseCampanha {
  constructor(@Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository) {
    super(repo);
  }

  async execute(r: Pick<Requisitante, 'tenantId' | 'requesterRole'>): Promise<CampanhaResumo[]> {
    garantirAdmin(r.requesterRole);
    const campanhas = await this.repo.listar(r.tenantId, 200);
    const contagens = await this.repo.contagens(campanhas.map((c) => c.id));
    return campanhas.map((c) => ({ ...c, contagens: contagens.get(c.id) ?? contagemVazia() }));
  }
}

@Injectable()
export class ObterCampanhaUseCase extends BaseCampanha {
  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    @Inject(SMS_PROVIDER) private readonly provider: ISmsProvider,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(r: Pick<Requisitante, 'tenantId' | 'requesterRole'> & { id: string }): Promise<CampanhaDetalhe> {
    garantirAdmin(r.requesterRole);
    const c = await this.carregar(r.tenantId, r.id);
    const contagens = (await this.repo.contagens([c.id])).get(c.id) ?? contagemVazia();
    return {
      ...c,
      contagens,
      linkBase: this.config.baseLink,
      linkTeste: this.config.linkDoCodigo(c.codigoTeste),
      provedor: { nome: this.provider.nome, simulado: this.provider.simulado, disponivel: this.provider.disponivel() },
      mensagemAnalise: await analisarMensagemDaCampanha(this.repo, c, this.config.baseLink),
    };
  }
}

export async function analisarMensagemDaCampanha(
  repo: ICampanhaRepository,
  c: CampanhaRecord,
  baseLink: string,
): Promise<CampanhaDetalhe['mensagemAnalise']> {
  if (!validarModelo(c.mensagem).ok) return null;
  const maior = await repo.maiorPrimeiroNome(c.id);
  // Sem contatos ainda: simula um nome comprido (12 letras) para nao surpreender depois.
  const nome = maior || 'Mmmmmmmmmmmm';
  const analise = analisarPiorCaso(c.mensagem, nome, baseLink);
  return { ...analise, cabe: analise.segmentos <= c.maxSegmentos, maiorPrimeiroNome: maior };
}

export interface DadosCampanha {
  nome?: string;
  mensagem?: string;
  linkDestino?: string;
  maxSegmentos?: number;
  taxaPorMinuto?: number;
  janelaInicio?: number;
  janelaFim?: number;
}

function validarDados(d: Required<DadosCampanha>): void {
  if (!d.nome.trim()) throw new BadRequestException('Dê um nome para a campanha.');
  const modelo = validarModelo(d.mensagem);
  if (!modelo.ok) throw new BadRequestException(modelo.erro);
  const link = validarLinkDestino(d.linkDestino);
  if (link) throw new BadRequestException(link);
  const cfg = validarConfig(d);
  if (cfg) throw new BadRequestException(cfg);
}

@Injectable()
export class CriarCampanhaUseCase extends BaseCampanha {
  private readonly logger = new Logger(CriarCampanhaUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    private readonly codigos: GeradorCodigoService,
  ) {
    super(repo);
  }

  async execute(r: Requisitante & DadosCampanha): Promise<CampanhaRecord> {
    garantirEscrita(r);
    const dados: Required<DadosCampanha> = {
      nome: (r.nome ?? '').trim(),
      mensagem: (r.mensagem ?? '').trim(),
      linkDestino: (r.linkDestino ?? '').trim(),
      maxSegmentos: r.maxSegmentos ?? PADROES.maxSegmentos,
      taxaPorMinuto: r.taxaPorMinuto ?? PADROES.taxaPorMinuto,
      janelaInicio: r.janelaInicio ?? PADROES.janelaInicio,
      janelaFim: r.janelaFim ?? PADROES.janelaFim,
    };
    validarDados(dados);
    if ((await this.repo.contarCampanhas(r.tenantId)) >= LIMITES.campanhasPorTenant) {
      erro('conflito', 'CAMPANHA_LIMITE', `Limite de ${LIMITES.campanhasPorTenant} campanhas por empresa atingido.`);
    }
    const [codigoTeste] = await this.codigos.gerar(1);
    const c = await this.repo.criar({ ...dados, tenantId: r.tenantId, codigoTeste, criadoPorUserId: r.requesterUserId });
    this.logger.log(`Campanha SMS criada: tenant=${r.tenantId} campanha=${c.id} usuario=${r.requesterUserId}`);
    return c;
  }
}

@Injectable()
export class AtualizarCampanhaUseCase extends BaseCampanha {
  constructor(@Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository) {
    super(repo);
  }

  async execute(r: Requisitante & { id: string } & DadosCampanha): Promise<CampanhaRecord> {
    garantirEscrita(r);
    const atual = await this.carregar(r.tenantId, r.id);
    if (!podeEditar(atual.status)) {
      erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Só dá para editar uma campanha em rascunho ou pausada.');
    }
    const dados: Required<DadosCampanha> = {
      nome: r.nome !== undefined ? r.nome.trim() : atual.nome,
      mensagem: r.mensagem !== undefined ? r.mensagem.trim() : atual.mensagem,
      linkDestino: r.linkDestino !== undefined ? r.linkDestino.trim() : atual.linkDestino,
      maxSegmentos: r.maxSegmentos ?? atual.maxSegmentos,
      taxaPorMinuto: r.taxaPorMinuto ?? atual.taxaPorMinuto,
      janelaInicio: r.janelaInicio ?? atual.janelaInicio,
      janelaFim: r.janelaFim ?? atual.janelaFim,
    };
    validarDados(dados);
    const ok = await this.repo.atualizar(r.tenantId, r.id, dados, ['rascunho', 'pausada']);
    if (!ok) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'A campanha mudou de situação enquanto você editava. Recarregue a página.');
    return this.carregar(r.tenantId, r.id);
  }
}

export interface ResultadoImportacao {
  linhasLidas: number;
  importados: number;
  bloqueados: number;
  invalidos: number;
  duplicados: number;
  ignoradosPorLimite: number;
  totalNaCampanha: number;
}

@Injectable()
export class ImportarContatosUseCase extends BaseCampanha {
  private readonly logger = new Logger(ImportarContatosUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    @Inject(LEITOR_PLANILHA) private readonly leitor: ILeitorPlanilhaContatos,
    private readonly codigos: GeradorCodigoService,
  ) {
    super(repo);
  }

  async execute(
    r: Requisitante & { id: string; arquivo: Buffer; nomeArquivo: string; substituir: boolean },
  ): Promise<ResultadoImportacao> {
    garantirEscrita(r);
    const c = await this.carregar(r.tenantId, r.id);
    if (!podeEditar(c.status)) {
      erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Só dá para importar contatos numa campanha em rascunho ou pausada.');
    }
    if (r.substituir && c.status !== 'rascunho') {
      erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Substituir a lista só é possível antes do primeiro envio (rascunho).');
    }
    if (!r.arquivo?.length) throw new BadRequestException('Envie o arquivo da planilha.');
    if (r.arquivo.length > LIMITES.arquivoBytes) throw new BadRequestException('Arquivo muito grande (máximo 5 MB).');

    let linhas: unknown[][];
    try {
      linhas = await this.leitor.ler(r.arquivo, r.nomeArquivo, LIMITES.linhasArquivo);
    } catch (e) {
      if (e instanceof ArquivoInvalidoError) throw new BadRequestException(e.message);
      throw e;
    }
    let leitura;
    try {
      leitura = lerContatos(linhas);
    } catch (e) {
      if (e instanceof CabecalhoInvalidoError) throw new BadRequestException(e.message);
      throw e;
    }

    if (r.substituir) await this.repo.apagarContatos(r.tenantId, c.id);
    const existentes = await this.repo.telefonesDaCampanha(c.id);
    const novos = leitura.contatos.filter((ct) => !existentes.has(ct.telefone));
    const duplicados = leitura.duplicadosNoArquivo + (leitura.contatos.length - novos.length);
    const vagas = Math.max(0, LIMITES.contatosPorCampanha - existentes.size);
    const aceitos = novos.slice(0, vagas);
    const ignoradosPorLimite = novos.length - aceitos.length;

    const bloqueados = await this.repo.telefonesEmOptout(r.tenantId, aceitos.map((a) => a.telefone));
    const codigos = await this.codigos.gerar(aceitos.length);
    const registros: NovoContato[] = aceitos.map((a, i) => ({
      ...a,
      codigo: codigos[i],
      status: bloqueados.has(a.telefone) ? 'bloqueado' : 'pendente',
    }));
    const inseridos = registros.length ? await this.repo.inserirContatos(r.tenantId, c.id, registros) : 0;
    const total = await this.repo.contarContatos(c.id);
    this.logger.log(
      `Importacao campanha=${c.id} tenant=${r.tenantId}: lidas=${leitura.linhasLidas} inseridos=${inseridos} bloqueados=${bloqueados.size} invalidos=${leitura.invalidos} duplicados=${duplicados}`,
    );
    return {
      linhasLidas: leitura.linhasLidas,
      importados: inseridos - registros.filter((x) => x.status === 'bloqueado').length,
      bloqueados: registros.filter((x) => x.status === 'bloqueado').length,
      invalidos: leitura.invalidos,
      duplicados: duplicados + (registros.length - inseridos),
      ignoradosPorLimite,
      totalNaCampanha: total,
    };
  }
}

export interface ContatoVisivel extends Omit<ContatoRecord, 'tenantId'> {
  telefoneFormatado: string;
  link: string;
}

function paraVisivel(c: ContatoRecord, config: CampanhaConfig): ContatoVisivel {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, ...resto } = c;
  return { ...resto, telefoneFormatado: formatarCelular(c.telefone), link: config.linkDoCodigo(c.codigo) };
}

@Injectable()
export class ListarContatosUseCase extends BaseCampanha {
  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(
    r: Pick<Requisitante, 'tenantId' | 'requesterRole'> & { id: string; status?: StatusContato; busca?: string; pagina?: number },
  ): Promise<{ itens: ContatoVisivel[]; total: number; pagina: number; porPagina: number }> {
    garantirAdmin(r.requesterRole);
    await this.carregar(r.tenantId, r.id);
    const porPagina = 50;
    const pagina = Math.max(1, Math.floor(r.pagina ?? 1));
    const busca = (r.busca ?? '').trim().slice(0, 60) || undefined;
    const { itens, total } = await this.repo.listarContatos(r.tenantId, r.id, { status: r.status, busca }, pagina, porPagina);
    return { itens: itens.map((c) => paraVisivel(c, this.config)), total, pagina, porPagina };
  }
}

export type FiltroExportacao = 'todos' | 'clicou' | 'respondeu' | 'optout' | 'falhou';

@Injectable()
export class ExportarContatosUseCase extends BaseCampanha {
  private readonly logger = new Logger(ExportarContatosUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(r: Pick<Requisitante, 'tenantId' | 'requesterRole' | 'requesterUserId'> & { id: string; filtro: FiltroExportacao }) {
    garantirAdmin(r.requesterRole);
    const c = await this.carregar(r.tenantId, r.id);
    const filtro: FiltroContatos =
      r.filtro === 'clicou'
        ? { somenteClicou: true }
        : r.filtro === 'respondeu'
          ? { somenteRespondeu: true }
          : r.filtro === 'optout'
            ? { status: 'optout' }
            : r.filtro === 'falhou'
              ? { status: 'falhou' }
              : {};
    const contatos = await this.repo.contatosParaExportar(r.tenantId, c.id, filtro, LIMITES.contatosPorCampanha);
    const fmt = (d: Date | null) =>
      d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d) : '';
    const cabecalho = ['nome', 'primeiro_nome', 'telefone', 'corretor', 'referencia', 'status', 'enviado_em', 'entregue_em', 'cliques', 'primeiro_clique_em', 'resposta', 'respondido_em', 'link'];
    const linhas = contatos.map((ct) =>
      [
        ct.nome,
        ct.primeiroNome,
        ct.telefone,
        ct.corretor,
        ct.referencia,
        ct.status,
        fmt(ct.enviadoEm),
        fmt(ct.entregueEm),
        ct.cliques,
        fmt(ct.primeiroCliqueEm),
        ct.respostaTexto,
        fmt(ct.respondidoEm),
        this.config.linkDoCodigo(ct.codigo),
      ]
        .map(celulaCsvSegura)
        .join(';'),
    );
    this.logger.log(`Exportacao campanha=${c.id} tenant=${r.tenantId} usuario=${r.requesterUserId} filtro=${r.filtro} linhas=${contatos.length}`);
    const nome = c.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'campanha';
    return {
      nomeArquivo: `${nome}_${r.filtro}.csv`,
      conteudo: `﻿${cabecalho.map(celulaCsvSegura).join(';')}\r\n${linhas.join('\r\n')}${linhas.length ? '\r\n' : ''}`,
    };
  }
}

@Injectable()
export class EnviarTesteUseCase extends BaseCampanha {
  private readonly logger = new Logger(EnviarTesteUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    @Inject(SMS_PROVIDER) private readonly provider: ISmsProvider,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(r: Requisitante & { id: string; telefone: string; primeiroNome?: string }) {
    garantirEscrita(r);
    const c = await this.carregar(r.tenantId, r.id);
    const telefone = normalizarCelularBR(r.telefone);
    if (!telefone) throw new BadRequestException('Informe um celular válido com DDD, ex.: (11) 99999-1234.');
    const modelo = validarModelo(c.mensagem);
    if (!modelo.ok) throw new BadRequestException(modelo.erro);
    if (!this.provider.disponivel()) {
      erro('indisponivel', 'SMS_PROVEDOR_INDISPONIVEL', 'O provedor de SMS não está configurado no servidor (Zenvia).');
    }
    const texto = montarMensagem(c.mensagem, {
      primeiroNome: (r.primeiroNome ?? 'Teste').slice(0, 12),
      link: this.config.linkDoCodigo(c.codigoTeste),
    });
    try {
      const res = await this.provider.enviar({ para: telefone, texto, idExterno: `teste-${c.id}` });
      this.logger.log(`SMS de teste campanha=${c.id} para=${mascararTelefone(telefone)} provedor=${this.provider.nome}`);
      return { enviado: true, simulado: this.provider.simulado, provedorMensagemId: res.provedorMensagemId, texto, analise: analisarTexto(texto) };
    } catch (e) {
      const msg = e instanceof SmsProviderError ? e.message : 'Falha ao falar com o provedor de SMS.';
      this.logger.warn(`Falha no SMS de teste campanha=${c.id}: ${msg}`);
      throw new ServiceUnavailableException({ statusCode: 503, code: 'SMS_FALHA_PROVEDOR', message: `O provedor recusou o envio: ${msg}` });
    }
  }
}

@Injectable()
export class IniciarCampanhaUseCase extends BaseCampanha {
  private readonly logger = new Logger(IniciarCampanhaUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    @Inject(SMS_PROVIDER) private readonly provider: ISmsProvider,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(r: Requisitante & { id: string }) {
    garantirEscrita(r);
    const c = await this.carregar(r.tenantId, r.id);
    if (!podeIniciar(c.status)) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Esta campanha não pode ser iniciada na situação atual.');
    if (!this.provider.disponivel()) {
      erro('indisponivel', 'SMS_PROVEDOR_INDISPONIVEL', 'O provedor de SMS não está configurado no servidor (Zenvia).');
    }
    const contagens = (await this.repo.contagens([c.id])).get(c.id) ?? contagemVazia();
    if (contagens.pendente === 0) erro('regra', 'CAMPANHA_SEM_CONTATOS', 'Não há contatos pendentes para enviar. Importe a planilha primeiro.');
    const analise = await analisarMensagemDaCampanha(this.repo, c, this.config.baseLink);
    if (!analise) throw new BadRequestException(validarModelo(c.mensagem).erro);
    if (!analise.cabe) {
      erro(
        'regra',
        'CAMPANHA_MENSAGEM_LONGA',
        `A mensagem mais longa da lista tem ${analise.tamanho} caracteres (${analise.codificacao === 'UCS2' ? 'com acento/emoji: 70 por SMS' : '160 por SMS'}) e ocupa ${analise.segmentos} SMS. O limite desta campanha é ${c.maxSegmentos}. Encurte o texto ou aumente o limite.`,
      );
    }
    const ok = await this.repo.mudarStatus(r.tenantId, c.id, ['rascunho', 'pausada'], 'enviando', c.iniciadaEm ? {} : { iniciadaEm: this.config.agora() });
    if (!ok) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'A campanha mudou de situação. Recarregue a página.');
    this.logger.log(`Campanha iniciada campanha=${c.id} tenant=${r.tenantId} usuario=${r.requesterUserId} pendentes=${contagens.pendente} simulado=${this.provider.simulado}`);
    return { status: 'enviando' as const, pendentes: contagens.pendente, simulado: this.provider.simulado };
  }
}

@Injectable()
export class PausarCampanhaUseCase extends BaseCampanha {
  constructor(@Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository) {
    super(repo);
  }

  async execute(r: Requisitante & { id: string }) {
    garantirEscrita(r);
    const c = await this.carregar(r.tenantId, r.id);
    if (!podePausar(c.status)) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Só dá para pausar uma campanha que está enviando.');
    const ok = await this.repo.mudarStatus(r.tenantId, c.id, ['enviando'], 'pausada');
    if (!ok) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'A campanha mudou de situação. Recarregue a página.');
    return { status: 'pausada' as const };
  }
}

@Injectable()
export class CancelarCampanhaUseCase extends BaseCampanha {
  constructor(
    @Inject(CAMPANHA_REPOSITORY) repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {
    super(repo);
  }

  async execute(r: Requisitante & { id: string }) {
    garantirEscrita(r);
    const c = await this.carregar(r.tenantId, r.id);
    if (!podeCancelar(c.status)) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'Esta campanha já terminou.');
    const ok = await this.repo.mudarStatus(r.tenantId, c.id, ['rascunho', 'enviando', 'pausada'], 'cancelada', { concluidaEm: this.config.agora() });
    if (!ok) erro('conflito', 'CAMPANHA_NAO_EDITAVEL', 'A campanha mudou de situação. Recarregue a página.');
    const cancelados = await this.repo.cancelarPendentes(c.id);
    return { status: 'cancelada' as const, cancelados };
  }
}

@Injectable()
export class ListarOptoutsUseCase {
  constructor(@Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository) {}

  async execute(r: Pick<Requisitante, 'tenantId' | 'requesterRole'>) {
    garantirAdmin(r.requesterRole);
    const itens = await this.repo.listarOptouts(r.tenantId, 1000);
    return itens.map((i) => ({ ...i, telefoneFormatado: formatarCelular(i.telefone) }));
  }
}

@Injectable()
export class RegistrarOptoutManualUseCase {
  constructor(
    @Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {}

  async execute(r: Requisitante & { telefone: string }) {
    garantirEscrita(r);
    const telefone = normalizarCelularBR(r.telefone);
    if (!telefone) throw new BadRequestException('Informe um celular válido com DDD.');
    await this.repo.registrarOptout(r.tenantId, telefone, 'manual');
    const marcados = await this.repo.marcarOptoutPendentes(r.tenantId, telefone, this.config.agora());
    return { telefone, telefoneFormatado: formatarCelular(telefone), contatosPendentesMarcados: marcados };
  }
}
