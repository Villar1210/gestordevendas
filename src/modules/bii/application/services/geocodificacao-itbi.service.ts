// src/modules/bii/application/services/geocodificacao-itbi.service.ts
// Job em SEGUNDO PLANO que geocodifica os enderecos do ITBI ainda sem ponto,
// so da regiao pedida (prefixos de CEP de 5 digitos e/ou bairros). Agrupa por
// enderecoChave (muitas guias do mesmo predio = 1 consulta), usa o
// GeocodeCache antes do Nominatim (1 req/s, fila global) e grava lat/lng em
// TODAS as ItbiTransacao daquela chave. Um job por vez (409). Progresso fica
// em memoria (GET /bii-plataforma/itbi/geocodificacao: job atual ou o ultimo
// deste processo). Desligamento do Nest cancela sem travar o processo.
import { ConflictException, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  chaveCacheItbi,
  GEOCODING_COM_CACHE,
  GeocodingIndisponivelError,
  IGeocodingComCache,
} from '../../domain/ports/geocoding-provider.interface';
import { IItbiRepository, ITBI_REPOSITORY } from '../../domain/repositories/itbi-repository.interface';
import { consultaGeocodeItbi, separarEnderecoChave } from '../../domain/services/endereco';
import { dentroDaGrandeSP } from '../../domain/services/geo';

export const GEOCODE_LOTE_MAX = 5000;
export const GEOCODE_LOTE_PADRAO = 2000;
// falhas seguidas do provedor (rede/429/5xx) que encerram o job
export const GEOCODE_MAX_FALHAS_SEGUIDAS = 5;

export const MENSAGEM_GEOCODIFICACAO_EM_ANDAMENTO = 'Já existe uma geocodificação em andamento. Aguarde terminar.';

export type StatusJobGeocode = 'processando' | 'concluida' | 'erro' | 'cancelada';

export interface ProgressoGeocodificacao {
  id: string;
  status: StatusJobGeocode;
  filtros: { ceps: string[]; bairros: string[]; max: number };
  enfileirados: number;
  processados: number;
  encontrados: number;
  naoEncontrados: number;
  doCache: number;
  consultasProvedor: number;
  falhas: number;
  transacoesAtualizadas: number;
  iniciadoEm: string;
  concluidoEm: string | null;
  mensagemErro: string | null;
}

@Injectable()
export class GeocodificacaoItbiService implements OnModuleDestroy {
  private readonly logger = new Logger(GeocodificacaoItbiService.name);
  private atual: ProgressoGeocodificacao | null = null;
  private controle: AbortController | null = null;
  private promessa: Promise<void> | null = null;
  private seq = 0;

  constructor(
    @Inject(ITBI_REPOSITORY) private readonly itbiRepo: IItbiRepository,
    @Inject(GEOCODING_COM_CACHE) private readonly geocoder: IGeocodingComCache,
  ) {}

  status(): ProgressoGeocodificacao | null {
    return this.atual ? { ...this.atual, filtros: { ...this.atual.filtros } } : null;
  }

  async aguardar(): Promise<void> {
    await this.promessa;
  }

  async iniciar(filtros: { ceps: string[]; bairros: string[]; max: number }): Promise<ProgressoGeocodificacao> {
    if (this.atual?.status === 'processando') throw new ConflictException(MENSAGEM_GEOCODIFICACAO_EM_ANDAMENTO);
    // reserva antes do await (duas requisicoes simultaneas nao passam)
    const progresso: ProgressoGeocodificacao = {
      id: `geo-${Date.now()}-${++this.seq}`,
      status: 'processando',
      filtros,
      enfileirados: 0,
      processados: 0,
      encontrados: 0,
      naoEncontrados: 0,
      doCache: 0,
      consultasProvedor: 0,
      falhas: 0,
      transacoesAtualizadas: 0,
      iniciadoEm: new Date().toISOString(),
      concluidoEm: null,
      mensagemErro: null,
    };
    this.atual = progresso;
    let chaves: string[];
    try {
      chaves = await this.itbiRepo.listarChavesSemPonto({
        cepPrefixos: filtros.ceps,
        bairrosNormalizados: filtros.bairros,
        limite: filtros.max,
      });
    } catch (erro) {
      progresso.status = 'erro';
      progresso.mensagemErro = 'Não foi possível listar os endereços.';
      progresso.concluidoEm = new Date().toISOString();
      throw erro;
    }
    progresso.enfileirados = chaves.length;
    this.controle = new AbortController();
    this.promessa = this.executar(progresso, chaves, this.controle.signal);
    return { ...progresso };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.atual?.status !== 'processando' || !this.controle) return;
    this.controle.abort(new Error('desligamento'));
    await Promise.race([this.promessa, new Promise((r) => setTimeout(r, 3000).unref())]);
  }

  private async executar(p: ProgressoGeocodificacao, chaves: string[], signal: AbortSignal): Promise<void> {
    let falhasSeguidas = 0;
    try {
      for (const chave of chaves) {
        if (signal.aborted) break;
        const consulta = consultaGeocodeItbi(chave);
        p.processados++;
        if (!consulta) {
          p.naoEncontrados++;
          continue;
        }
        let r;
        try {
          r = await this.geocoder.geocodificarComFonte(consulta, { chaveCache: chaveCacheItbi(chave), signal });
          falhasSeguidas = 0;
        } catch (erro) {
          if (signal.aborted) break;
          if (erro instanceof GeocodingIndisponivelError) {
            p.falhas++;
            falhasSeguidas++;
            if (falhasSeguidas >= GEOCODE_MAX_FALHAS_SEGUIDAS) {
              p.status = 'erro';
              p.mensagemErro = 'Serviço de geocodificação indisponível. Tente mais tarde.';
              return;
            }
            continue;
          }
          throw erro;
        }
        if (r.fonte === 'cache') p.doCache++;
        else p.consultasProvedor++;
        const ponto = r.resultado;
        if (!ponto || !dentroDaGrandeSP(ponto)) {
          p.naoEncontrados++;
          continue;
        }
        // sem numero (99999/0 no arquivo): no maximo precisao de rua
        const semNumero = separarEnderecoChave(chave).numero === null;
        const precisao = semNumero && ponto.precisao === 'rooftop' ? 'rua' : ponto.precisao;
        p.encontrados++;
        p.transacoesAtualizadas += await this.itbiRepo.aplicarCoordenadas(chave, { lat: ponto.lat, lng: ponto.lng, precisao });
      }
      if (signal.aborted) {
        p.status = 'cancelada';
        p.mensagemErro = 'Interrompida (servidor desligando).';
      } else {
        p.status = 'concluida';
      }
    } catch (erro) {
      p.status = 'erro';
      p.mensagemErro = 'Erro inesperado na geocodificação.';
      this.logger.warn(`Geocodificacao ITBI ${p.id} falhou: ${(erro as Error)?.name ?? 'erro'}`);
    } finally {
      p.concluidoEm = new Date().toISOString();
      this.logger.log(
        `Geocodificacao ITBI ${p.id} ${p.status}: processados=${p.processados}/${p.enfileirados} encontrados=${p.encontrados} cache=${p.doCache} consultas=${p.consultasProvedor} falhas=${p.falhas} transacoes=${p.transacoesAtualizadas}`,
      );
    }
  }
}
