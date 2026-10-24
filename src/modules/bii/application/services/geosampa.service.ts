// src/modules/bii/application/services/geosampa.service.ts
// Job em SEGUNDO PLANO da Fatia 6 (docs/bii/fatia6/CONTRATO_LOCALIZACAO_SQL.md):
//  - "atualizar": baixa quadras e lotes do GeoSampa (pagina a pagina, 1 pedido
//    por vez), guarda so o centroide; depois localiza as guias do ITBI.
//  - "localizar": so aplica a base ja baixada nas guias (rapido).
// Um job por vez (409). Progresso em memoria, como a geocodificacao.
// Importacao nova do ITBI chama localizarImportacao() ao terminar.
import { ConflictException, Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { CoberturaItbiCache } from './cobertura-itbi.cache';
import {
  CamadaGeoSampa,
  GEOSAMPA_WFS,
  GeoSampaIndisponivelError,
  IGeoSampaWfs,
} from '../../domain/ports/geosampa-wfs.interface';
import {
  GEOSAMPA_REPOSITORY,
  IGeoSampaRepository,
  QuadraFiscal,
} from '../../domain/repositories/geosampa-repository.interface';
import { CentroideArea, combinarCentroides, interpretarLote, interpretarQuadra, LoteFiscal } from '../../domain/services/geosampa';

export const GEOSAMPA_PAGINA = 10_000;
export const GEOSAMPA_TENTATIVAS = 3;
export const GEOSAMPA_LOTE_GRAVACAO = 1_000;
// teto defensivo (a camada de lotes tem ~1,7 mi): evita laco sem fim se a
// contagem vier errada
export const GEOSAMPA_MAX_FEICOES = 3_000_000;
export const MENSAGEM_GEOSAMPA_EM_ANDAMENTO = 'Já existe uma atualização do GeoSampa em andamento. Aguarde terminar.';
export const MENSAGEM_SEM_BASE = 'A base do GeoSampa ainda não foi baixada. Use "Atualizar base do GeoSampa" primeiro.';

export type EtapaGeoSampa = 'quadras' | 'lotes' | 'localizando';
export type StatusJobGeoSampa = 'processando' | 'concluida' | 'erro' | 'cancelada';

export interface ProgressoGeoSampa {
  id: string;
  modo: 'atualizar' | 'localizar';
  status: StatusJobGeoSampa;
  etapa: EtapaGeoSampa;
  quadras: { total: number; lidas: number; gravadas: number };
  lotes: { total: number; lidos: number; gravados: number };
  localizacao: { setores: number; setoresFeitos: number; porLote: number; porQuadra: number };
  iniciadoEm: string;
  concluidoEm: string | null;
  mensagemErro: string | null;
}

const espera = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

@Injectable()
export class GeoSampaService implements OnModuleDestroy {
  private readonly logger = new Logger(GeoSampaService.name);
  private atual: ProgressoGeoSampa | null = null;
  private controle: AbortController | null = null;
  private promessa: Promise<void> | null = null;
  private seq = 0;
  // substituivel em teste (sem esperar de verdade)
  esperaEntreTentativasMs = 5_000;

  constructor(
    @Inject(GEOSAMPA_WFS) private readonly wfs: IGeoSampaWfs,
    @Inject(GEOSAMPA_REPOSITORY) private readonly repo: IGeoSampaRepository,
    @Optional() private readonly cobertura?: CoberturaItbiCache,
  ) {}

  status(): ProgressoGeoSampa | null {
    return this.atual ? JSON.parse(JSON.stringify(this.atual)) : null;
  }

  async aguardar(): Promise<void> {
    await this.promessa;
  }

  async iniciar(modo: 'atualizar' | 'localizar'): Promise<ProgressoGeoSampa> {
    if (this.atual?.status === 'processando') throw new ConflictException(MENSAGEM_GEOSAMPA_EM_ANDAMENTO);
    const p: ProgressoGeoSampa = {
      id: `geosampa-${Date.now()}-${++this.seq}`,
      modo,
      status: 'processando',
      etapa: modo === 'atualizar' ? 'quadras' : 'localizando',
      quadras: { total: 0, lidas: 0, gravadas: 0 },
      lotes: { total: 0, lidos: 0, gravados: 0 },
      localizacao: { setores: 0, setoresFeitos: 0, porLote: 0, porQuadra: 0 },
      iniciadoEm: new Date().toISOString(),
      concluidoEm: null,
      mensagemErro: null,
    };
    this.atual = p; // reservado antes de qualquer await
    if (modo === 'localizar') {
      try {
        const c = await this.repo.contar();
        if (c.quadras === 0) {
          this.atual = null;
          throw new ConflictException(MENSAGEM_SEM_BASE);
        }
      } catch (erro) {
        if (this.atual === p) this.atual = null;
        throw erro;
      }
    }
    this.controle = new AbortController();
    this.promessa = this.executar(p, this.controle.signal);
    return this.status()!;
  }

  // chamado pelo importador do ITBI ao concluir (so as guias daquela
  // importacao). Silencioso: sem base ainda ou job rodando = nao faz nada.
  async localizarImportacao(importacaoId: string): Promise<void> {
    if (this.atual?.status === 'processando') return;
    try {
      const c = await this.repo.contar();
      if (c.quadras === 0) return;
      const setores = await this.repo.setoresDoItbi(importacaoId);
      let porLote = 0;
      let porQuadra = 0;
      for (const s of setores) {
        const r = await this.repo.localizarSetor(s, importacaoId);
        porLote += r.porLote;
        porQuadra += r.porQuadra;
      }
      this.cobertura?.invalidar();
      this.logger.log(`GeoSampa: importacao ${importacaoId} localizada (lote=${porLote}, quadra=${porQuadra})`);
    } catch (erro) {
      this.logger.warn(`GeoSampa: falha ao localizar importacao ${importacaoId}: ${(erro as Error)?.name ?? 'erro'}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.atual?.status !== 'processando' || !this.controle) return;
    this.controle.abort(new Error('desligamento'));
    await Promise.race([this.promessa, new Promise((r) => setTimeout(r, 5000).unref())]);
  }

  private async paginaComRetentativa(camada: CamadaGeoSampa, inicio: number, signal: AbortSignal) {
    let ultimo: unknown;
    for (let t = 1; t <= GEOSAMPA_TENTATIVAS; t++) {
      try {
        return await this.wfs.pagina(camada, inicio, GEOSAMPA_PAGINA, signal);
      } catch (erro) {
        if (signal.aborted) throw erro;
        if (!(erro instanceof GeoSampaIndisponivelError)) throw erro;
        ultimo = erro;
        if (t < GEOSAMPA_TENTATIVAS) await espera(this.esperaEntreTentativasMs * t, signal);
      }
    }
    throw ultimo;
  }

  private async baixarQuadras(p: ProgressoGeoSampa, signal: AbortSignal): Promise<void> {
    p.etapa = 'quadras';
    p.quadras.total = await this.wfs.contar('quadra_fiscal', signal);
    // subquadras da MESMA quadra chegam em feicoes separadas: junta em memoria
    // (~64 mil quadras) e grava no fim, ponderando pela area
    const partes = new Map<string, CentroideArea[]>();
    const total = Math.min(p.quadras.total, GEOSAMPA_MAX_FEICOES);
    for (let inicio = 0; inicio < total; inicio += GEOSAMPA_PAGINA) {
      if (signal.aborted) return;
      const feicoes = await this.paginaComRetentativa('quadra_fiscal', inicio, signal);
      p.quadras.lidas += feicoes.length;
      for (const f of feicoes) {
        const q = interpretarQuadra(f);
        if (!q) continue;
        const k = `${q.setor}${q.quadra}`;
        const lista = partes.get(k);
        if (lista) lista.push(q.centroide);
        else partes.set(k, [q.centroide]);
      }
      if (feicoes.length < GEOSAMPA_PAGINA) break;
    }
    const lote: QuadraFiscal[] = [];
    for (const [k, lista] of partes) {
      if (signal.aborted) return;
      const c = combinarCentroides(lista);
      if (!c) continue;
      lote.push({ setor: k.slice(0, 3), quadra: k.slice(3, 6), lat: c.lat, lng: c.lng });
      if (lote.length >= GEOSAMPA_LOTE_GRAVACAO) p.quadras.gravadas += await this.repo.gravarQuadras(lote.splice(0));
    }
    p.quadras.gravadas += await this.repo.gravarQuadras(lote);
  }

  private async baixarLotes(p: ProgressoGeoSampa, signal: AbortSignal): Promise<void> {
    p.etapa = 'lotes';
    p.lotes.total = await this.wfs.contar('lote_cidadao', signal);
    const total = Math.min(p.lotes.total, GEOSAMPA_MAX_FEICOES);
    for (let inicio = 0; inicio < total; inicio += GEOSAMPA_PAGINA) {
      if (signal.aborted) return;
      const feicoes = await this.paginaComRetentativa('lote_cidadao', inicio, signal);
      p.lotes.lidos += feicoes.length;
      const lotes: LoteFiscal[] = [];
      for (const f of feicoes) {
        const l = interpretarLote(f);
        if (l) lotes.push(l);
      }
      // a mesma chave pode vir 2x na pagina: ON CONFLICT no mesmo comando
      // falharia - fica a ultima
      const unicos = new Map(lotes.map((l) => [`${l.setor}${l.quadra}${l.lote}${l.condominio}`, l]));
      const lista = [...unicos.values()];
      for (let i = 0; i < lista.length; i += GEOSAMPA_LOTE_GRAVACAO) {
        p.lotes.gravados += await this.repo.gravarLotes(lista.slice(i, i + GEOSAMPA_LOTE_GRAVACAO));
      }
      if (feicoes.length < GEOSAMPA_PAGINA) break;
    }
  }

  private async localizarTudo(p: ProgressoGeoSampa, signal: AbortSignal): Promise<void> {
    p.etapa = 'localizando';
    const setores = await this.repo.setoresDoItbi();
    p.localizacao.setores = setores.length;
    for (const s of setores) {
      if (signal.aborted) return;
      const r = await this.repo.localizarSetor(s);
      p.localizacao.porLote += r.porLote;
      p.localizacao.porQuadra += r.porQuadra;
      p.localizacao.setoresFeitos++;
    }
  }

  private async executar(p: ProgressoGeoSampa, signal: AbortSignal): Promise<void> {
    try {
      if (p.modo === 'atualizar') {
        await this.baixarQuadras(p, signal);
        if (!signal.aborted) await this.baixarLotes(p, signal);
      }
      if (!signal.aborted) await this.localizarTudo(p, signal);
      if (signal.aborted) {
        p.status = 'cancelada';
        p.mensagemErro = 'Interrompida (servidor desligando). Rode de novo: o que já foi gravado fica.';
      } else {
        p.status = 'concluida';
      }
    } catch (erro) {
      p.status = 'erro';
      p.mensagemErro =
        erro instanceof GeoSampaIndisponivelError
          ? 'O GeoSampa não respondeu. Tente mais tarde: o que já foi gravado fica.'
          : 'Erro inesperado ao atualizar a base do GeoSampa.';
      this.logger.warn(`GeoSampa ${p.id} falhou na etapa ${p.etapa}: ${(erro as Error)?.message ?? 'erro'}`);
    } finally {
      p.concluidoEm = new Date().toISOString();
      this.cobertura?.invalidar();
      this.logger.log(
        `GeoSampa ${p.id} ${p.status}: quadras=${p.quadras.gravadas}/${p.quadras.lidas} lotes=${p.lotes.gravados}/${p.lotes.lidos} guias lote=${p.localizacao.porLote} quadra=${p.localizacao.porQuadra}`,
      );
    }
  }
}
