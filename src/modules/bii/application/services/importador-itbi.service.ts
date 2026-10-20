// src/modules/bii/application/services/importador-itbi.service.ts
// Importacao do ITBI em SEGUNDO PLANO (a requisicao responde 202 na hora).
// Fluxo: leitor em streaming -> por aba: aba de apoio e ignorada; procura o
// cabecalho nas primeiras linhas nao vazias (mapa de colunas) -> cada linha
// vira transacao ou descarte -> sha256 -> createMany skipDuplicates em lotes de
// 1000 -> progresso em ItbiImportacao. Uma importacao por vez (409). O arquivo
// temporario e SEMPRE apagado no finally. Desligamento do Nest aborta a
// leitura (status "erro", sem travar o processo).
import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { ConflictException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { CoberturaItbiCache } from './cobertura-itbi.cache';
import {
  IItbiPlanilhaReader,
  ITBI_PLANILHA_READER,
  PlanilhaLimiteExcedidoError,
} from '../../domain/ports/itbi-planilha-reader.interface';
import {
  AbaImportacao,
  IItbiImportacaoRepository,
  ITBI_IMPORTACAO_REPOSITORY,
  ProgressoImportacao,
} from '../../domain/repositories/itbi-importacao-repository.interface';
import { IItbiRepository, ITBI_REPOSITORY, LinhaItbiParaGravar } from '../../domain/repositories/itbi-repository.interface';
import {
  detectarColunas,
  ehAbaDeApoio,
  ehAbaMensal,
  linhaPareceDado,
  linhaVazia,
  MAPA_PADRAO,
  MapaColunas,
  MAX_LINHAS_PROCURANDO_CABECALHO,
} from '../../domain/services/itbi-colunas';
import { montarTransacaoItbi, textoParaHash } from '../../domain/services/itbi-linha';

export const ITBI_TAMANHO_LOTE = 1000;
export const ITBI_MAX_LINHAS = 1_500_000;
export const ITBI_MAX_BYTES_LIDOS = 300 * 1024 * 1024;
// "processando" sem atualizar ha mais que isso = processo caiu no meio.
export const ITBI_IMPORTACAO_ABANDONADA_MS = 30 * 60 * 1000;

export const MENSAGEM_INTERROMPIDA_REINICIO = 'Interrompida por reinício do servidor';

export const MENSAGEM_IMPORTACAO_EM_ANDAMENTO = 'Já existe uma importação do ITBI em andamento. Aguarde terminar.';

export interface IniciarImportacaoInput {
  caminho: string; // arquivo temporario (o servico passa a ser dono dele)
  nomeArquivo: string; // ja sanitizado
  ano: number;
  userId: string;
}

@Injectable()
export class ImportadorItbiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportadorItbiService.name);
  private emAndamento: { id: string; controle: AbortController; promessa: Promise<void> } | null = null;
  // relogio substituivel em teste
  agora: () => Date = () => new Date();

  constructor(
    @Inject(ITBI_PLANILHA_READER) private readonly reader: IItbiPlanilhaReader,
    @Inject(ITBI_REPOSITORY) private readonly itbiRepo: IItbiRepository,
    @Inject(ITBI_IMPORTACAO_REPOSITORY) private readonly importacaoRepo: IItbiImportacaoRepository,
    @Optional() private readonly cobertura?: CoberturaItbiCache,
  ) {}

  // B4: ao subir, nenhuma importacao pode estar rodando neste processo - as
  // que ficaram "processando" no banco morreram com o processo anterior.
  // (Uma instancia so no PM2; com cluster, trocar por trava no banco.)
  async onModuleInit(): Promise<void> {
    try {
      const n = await this.importacaoRepo.marcarTodasProcessandoComoErro(MENSAGEM_INTERROMPIDA_REINICIO);
      if (n > 0) this.logger.warn(`ITBI: ${n} importacao(oes) interrompida(s) pelo reinicio marcada(s) como erro`);
    } catch {
      this.logger.warn('ITBI: nao foi possivel conferir importacoes interrompidas no inicio');
    }
  }

  get ocupado(): boolean {
    return this.emAndamento !== null;
  }

  // Sobe a importacao em segundo plano e devolve o id. Erro antes de subir
  // (409) -> apaga o arquivo antes de lancar.
  async iniciar(input: IniciarImportacaoInput): Promise<{ importacaoId: string }> {
    try {
      await this.garantirLivre();
    } catch (erro) {
      await apagarSilencioso(input.caminho);
      throw erro;
    }
    const registro = await this.importacaoRepo.criar({
      nomeArquivo: input.nomeArquivo,
      ano: input.ano,
      importadoPorUserId: input.userId,
    });
    const controle = new AbortController();
    const promessa = this.executar(registro.id, input.caminho, controle.signal).finally(() => {
      if (this.emAndamento?.id === registro.id) this.emAndamento = null;
    });
    this.emAndamento = { id: registro.id, controle, promessa };
    return { importacaoId: registro.id };
  }

  // Espera a importacao atual (usado em teste).
  async aguardar(): Promise<void> {
    await this.emAndamento?.promessa;
  }

  async onModuleDestroy(): Promise<void> {
    const atual = this.emAndamento;
    if (!atual) return;
    atual.controle.abort(new Error('desligamento'));
    // no maximo 5 s esperando o finally (apagar arquivo, gravar status)
    await Promise.race([atual.promessa, new Promise((r) => setTimeout(r, 5000).unref())]);
  }

  private async garantirLivre(): Promise<void> {
    if (this.emAndamento) throw new ConflictException(MENSAGEM_IMPORTACAO_EM_ANDAMENTO);
    for (const p of await this.importacaoRepo.listarProcessando()) {
      if (this.agora().getTime() - p.atualizadoEm.getTime() > ITBI_IMPORTACAO_ABANDONADA_MS) {
        await this.importacaoRepo.marcarAbandonada(p.id, 'Importação interrompida (servidor reiniciado). Envie de novo.');
      } else {
        throw new ConflictException(MENSAGEM_IMPORTACAO_EM_ANDAMENTO);
      }
    }
  }

  async executar(importacaoId: string, caminho: string, signal: AbortSignal): Promise<void> {
    const inicio = Date.now();
    const progresso: ProgressoImportacao = {
      linhasLidas: 0,
      linhasInseridas: 0,
      linhasDuplicadas: 0,
      linhasDescartadas: 0,
      abas: [],
    };
    let lote: LinhaItbiParaGravar[] = [];
    let aba: AbaImportacao | null = null;
    let mapa: MapaColunas | null = null;
    let procurando = 0;
    let apoio = false;
    // so quantidades por motivo (nunca o conteudo da linha) para o log
    const descartes: Record<string, number> = {};

    const gravarLote = async () => {
      if (lote.length === 0) return;
      const inseridas = await this.itbiRepo.inserirLote(lote);
      progresso.linhasInseridas += inseridas;
      progresso.linhasDuplicadas += lote.length - inseridas;
      lote = [];
      await this.importacaoRepo.atualizarProgresso(importacaoId, progresso);
    };
    const fecharAba = () => {
      if (aba && !mapa && aba.status === 'importada') {
        aba.status = 'ignorada';
        aba.motivo = aba.motivo ?? 'cabeçalho não reconhecido';
      }
    };

    try {
      for await (const evento of this.reader.ler(
        caminho,
        { maxLinhas: ITBI_MAX_LINHAS, maxBytes: ITBI_MAX_BYTES_LIDOS },
        signal,
      )) {
        if (evento.tipo === 'aba') {
          fecharAba();
          apoio = ehAbaDeApoio(evento.nome);
          aba = { nome: evento.nome, status: apoio ? 'ignorada' : 'importada', linhas: 0 };
          if (apoio) aba.motivo = 'aba de apoio (não é transação)';
          progresso.abas.push(aba);
          mapa = null;
          procurando = 0;
          continue;
        }
        if (!aba || apoio || linhaVazia(evento.valores)) continue;
        if (!mapa) {
          if (procurando >= MAX_LINHAS_PROCURANDO_CABECALHO) continue;
          procurando++;
          const deteccao = detectarColunas(evento.valores);
          if (deteccao.faltandoObrigatorios.length === 0) {
            mapa = deteccao.mapa;
            continue;
          }
          // aba mensal sem cabecalho (2024): 1a linha ja e dado -> ordem padrao
          if (procurando === 1 && ehAbaMensal(aba.nome) && linhaPareceDado(evento.valores)) {
            mapa = MAPA_PADRAO;
            aba.motivo = 'sem cabeçalho: ordem padrão das colunas';
          } else {
            continue;
          }
        }
        progresso.linhasLidas++;
        aba.linhas++;
        const r = montarTransacaoItbi(evento.valores, mapa);
        if (!r.ok) {
          progresso.linhasDescartadas++;
          descartes[r.motivo] = (descartes[r.motivo] ?? 0) + 1;
          continue;
        }
        lote.push({
          ...r.transacao,
          hashLinha: createHash('sha256').update(textoParaHash(r.transacao)).digest('hex'),
          importacaoId,
          arquivoAba: aba.nome,
        });
        if (lote.length >= ITBI_TAMANHO_LOTE) await gravarLote();
      }
      fecharAba();
      await gravarLote();
      const nenhumaAba = !progresso.abas.some((a) => a.status === 'importada');
      await this.importacaoRepo.finalizar(
        importacaoId,
        nenhumaAba ? 'erro' : 'concluida',
        progresso,
        nenhumaAba ? 'Nenhuma aba com o cabeçalho do ITBI (logradouro, valor e data da transação).' : null,
      );
      this.logger.log(
        `ITBI importacao ${importacaoId} ${nenhumaAba ? 'sem abas validas' : 'concluida'}: lidas=${progresso.linhasLidas} inseridas=${progresso.linhasInseridas} duplicadas=${progresso.linhasDuplicadas} descartadas=${progresso.linhasDescartadas} ${JSON.stringify(descartes)} ms=${Date.now() - inicio}`,
      );
    } catch (erro) {
      let mensagem = 'Não foi possível ler a planilha. Confira se é o arquivo .xlsx do ITBI.';
      if (erro instanceof PlanilhaLimiteExcedidoError) mensagem = erro.message;
      else if (signal.aborted) mensagem = 'Importação interrompida (servidor desligando). Envie de novo.';
      // so o tipo do erro no log (nunca conteudo do arquivo)
      this.logger.warn(`ITBI importacao ${importacaoId} falhou: ${(erro as Error)?.name ?? 'erro'}`);
      try {
        await this.importacaoRepo.finalizar(importacaoId, 'erro', progresso, mensagem.slice(0, 300));
      } catch {
        this.logger.warn(`ITBI importacao ${importacaoId}: nao foi possivel gravar o status de erro`);
      }
    } finally {
      await apagarSilencioso(caminho);
      this.cobertura?.invalidar();
    }
  }
}

async function apagarSilencioso(caminho: string): Promise<void> {
  try {
    await unlink(caminho);
  } catch {
    // ja nao existe
  }
}
