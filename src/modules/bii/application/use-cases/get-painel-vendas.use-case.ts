// src/modules/bii/application/use-cases/get-painel-vendas.use-case.ts
// GET /bii/painel - Painel de Vendas (so Administrador; checado aqui tambem,
// nao so no guard). Contrato: docs/bii/fatia1/CONTRATO_PAINEL.md.
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { formatDateOnly } from '../../../../shared/utils/date-only.util';
import {
  FiltroPainel,
  IdNome,
  IPainelVendasRepository,
} from '../../domain/repositories/painel-vendas-repository.interface';
import {
  calcularMotivosPerda,
  calcularPorOrigem,
  calcularRanking,
  calcularResumo,
  calcularVgvPorMes,
  LinhaRanking,
  ResumoVendas,
} from '../../domain/services/painel-vendas';
import { EtapaFunil, montarFunil } from '../../domain/services/funil';
import {
  inicioDoDia,
  limiteSuperiorExclusivo,
  MAX_MESES_PERIODO,
  mesesDoPeriodo,
  periodoAnterior,
  periodoPadrao,
  validarPeriodo,
} from '../../domain/services/periodo';

export interface GetPainelVendasInput {
  tenantId: string;
  requesterRole: string;
  de?: Date; // meia-noite local (parseDateOnly)
  ate?: Date;
  pipelineId?: string;
  corretorId?: string;
  origem?: string;
  agora?: Date; // so para teste (padrao: new Date())
}

export interface PainelVendasResponse {
  periodo: { de: string; ate: string };
  historicoDesde: string | null;
  pipelineId: string | null;
  pipelines: IdNome[];
  filtros: { corretores: IdNome[]; origens: string[] };
  resumo: ResumoVendas;
  comparativo: ResumoVendas;
  funil: EtapaFunil[];
  vgvPorMes: { mes: string; vgv: number; ganhos: number }[];
  ranking: LinhaRanking[];
  porOrigem: { origem: string; leads: number; ganhos: number; conversaoPct: number | null }[];
  motivosPerda: { motivo: string; rotulo: string; quantidade: number; pct: number }[];
}

@Injectable()
export class GetPainelVendasUseCase {
  constructor(
    @Inject('IPainelVendasRepository') private readonly repository: IPainelVendasRepository,
  ) {}

  async execute(input: GetPainelVendasInput): Promise<PainelVendasResponse> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode acessar o BII.');
    }

    const padrao = periodoPadrao(input.agora ?? new Date());
    const de = inicioDoDia(input.de ?? (input.ate ? new Date(input.ate.getFullYear(), input.ate.getMonth() - 5, 1) : padrao.de));
    const ate = inicioDoDia(input.ate ?? padrao.ate);
    const erro = validarPeriodo(de, ate);
    if (erro === 'de_maior_que_ate') {
      throw new BadRequestException('A data inicial não pode ser depois da data final.');
    }
    if (erro === 'periodo_maior_que_maximo') {
      throw new BadRequestException(`O período pode ter no máximo ${MAX_MESES_PERIODO} meses.`);
    }

    const [pipelines, inicioHistorico] = await Promise.all([
      this.repository.listarPipelines(input.tenantId),
      this.repository.buscarInicioHistorico(input.tenantId),
    ]);

    let pipelineId: string | null;
    if (input.pipelineId) {
      if (!pipelines.some((p) => p.id === input.pipelineId)) {
        throw new NotFoundException('Funil não encontrado.');
      }
      pipelineId = input.pipelineId;
    } else {
      pipelineId = pipelines[0]?.id ?? null;
    }

    const periodo = { de: formatDateOnly(de), ate: formatDateOnly(ate) };
    const historicoDesde = inicioHistorico ? inicioHistorico.toISOString() : null;
    const meses = mesesDoPeriodo(de, ate);

    if (!pipelineId) {
      const vazio = calcularResumo([], []);
      return {
        periodo,
        historicoDesde,
        pipelineId: null,
        pipelines,
        filtros: { corretores: [], origens: [] },
        resumo: vazio,
        comparativo: vazio,
        funil: [],
        vgvPorMes: calcularVgvPorMes([], meses),
        ranking: [],
        porOrigem: [],
        motivosPerda: [],
      };
    }

    const filtro: FiltroPainel = {
      tenantId: input.tenantId,
      pipelineId,
      inicio: de,
      fimExclusivo: limiteSuperiorExclusivo(ate),
      corretorId: input.corretorId ?? null,
      origem: input.origem ?? null,
    };
    const anterior = periodoAnterior(de, ate);
    const filtroAnterior: FiltroPainel = {
      ...filtro,
      inicio: anterior.de,
      fimExclusivo: limiteSuperiorExclusivo(anterior.ate),
    };

    const [etapas, corretores, origens, leads, eventos, leadsAnt, eventosAnt] = await Promise.all([
      this.repository.listarEtapas(input.tenantId, pipelineId),
      this.repository.listarCorretores(input.tenantId, pipelineId),
      this.repository.listarOrigens(input.tenantId, pipelineId),
      this.repository.listarCardsCriados(filtro),
      this.repository.listarEventosEntrada(filtro),
      this.repository.listarCardsCriados(filtroAnterior),
      this.repository.listarEventosEntrada(filtroAnterior),
    ]);

    const nomes = new Map(corretores.map((c) => [c.id, c.nome]));
    return {
      periodo,
      historicoDesde,
      pipelineId,
      pipelines,
      filtros: { corretores, origens },
      resumo: calcularResumo(leads, eventos),
      comparativo: calcularResumo(leadsAnt, eventosAnt),
      funil: montarFunil(etapas, eventos),
      vgvPorMes: calcularVgvPorMes(eventos, meses),
      ranking: calcularRanking(leads, eventos, nomes),
      porOrigem: calcularPorOrigem(leads, eventos),
      motivosPerda: calcularMotivosPerda(eventos),
    };
  }
}
