// src/modules/bii/domain/services/estudo.ts
// Fatia 5 - Estudo de terreno: junta o snapshot da Analise por Endereco
// (ITBI + concorrentes no raio) com a viabilidade das tipologias. So FATOS,
// sem recomendacao. Funcoes PURAS. Contrato: docs/bii/fatia5/CONTRATO_ESTUDO.md
import { arredondar1, arredondar2 } from './estatistica';
import type { ResultadoTipologia, Situacao } from './viabilidade';

// faixa de "alinhado" ao R$/m2 mediano dos concorrentes (inclusiva)
export const FAIXA_ALINHADO_PERCENTUAL = 5;
export const AMOSTRA_ITBI_MINIMA = 30;
export const ANALISE_ANTIGA_DIAS = 90;
export const LIMITE_ESTUDOS_POR_TENANT = 500;

export type ClassePosicao = 'abaixo' | 'alinhado' | 'acima';

export interface Posicao {
  diferencaPercentual: number; // (R$/m2 tipologia / mediana concorrentes - 1) * 100, 1 casa
  classe: ClassePosicao;
}

// Partes do snapshot da analise que o estudo usa. Analise salva antes da
// Fatia 3 nao tem "concorrentes" (opcional aqui).
export interface AnaliseParaEstudo {
  parametros: { raioMetros: number; meses: number; de: string; ate: string };
  resumo: { transacoes: number; precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null };
  concorrentes?: { resumo: { quantidade: number; precoM2Mediano: number | null } } | null;
}

export interface PosicionamentoTipologia {
  descricao: string;
  precoM2: number;
  concorrentes: Posicao | null; // mesma base (tabela / area privativa)
  // ITBI so lado a lado (bases diferentes): nunca em %
  itbi: { precoM2Mediano: number | null; precoM2P25: number | null; precoM2P75: number | null };
}

export interface Alerta {
  codigo: 'AMOSTRA_PEQUENA' | 'SEM_CONCORRENTES' | 'ANALISE_SEM_CONCORRENTES' | 'ANALISE_ANTIGA';
  mensagem: string;
}

export interface ResumoExecutivo {
  itbi: {
    transacoes: number;
    precoM2Mediano: number | null;
    precoM2P25: number | null;
    precoM2P75: number | null;
    de: string;
    ate: string;
  };
  concorrentes: { quantidade: number; precoM2Mediano: number | null } | null; // null = analise sem concorrentes no snapshot
  viabilidade: { tipologias: number; ok: number; atencao: number; fora: number; enquadramMcmv: number };
  tipologias: { precoM2Medio: number; posicaoMedia: Posicao | null };
}

export interface MontagemEstudo {
  resumoExecutivo: ResumoExecutivo;
  posicionamento: PosicionamentoTipologia[];
  alertas: Alerta[];
  destaques: string[];
}

const m2 = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/m²`;
const pct = (v: number) => `${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function classificarPosicao(precoM2: number, medianaConcorrentes: number | null): Posicao | null {
  if (medianaConcorrentes === null || !(medianaConcorrentes > 0) || !(precoM2 > 0)) return null;
  const diferencaPercentual = arredondar1((precoM2 / medianaConcorrentes - 1) * 100);
  const classe: ClassePosicao =
    diferencaPercentual < -FAIXA_ALINHADO_PERCENTUAL ? 'abaixo' : diferencaPercentual > FAIXA_ALINHADO_PERCENTUAL ? 'acima' : 'alinhado';
  return { diferencaPercentual, classe };
}

export function contarSituacoes(resultados: Pick<ResultadoTipologia, 'situacao'>[]): Record<Situacao, number> {
  const c: Record<Situacao, number> = { ok: 0, atencao: 0, fora: 0 };
  for (const r of resultados) c[r.situacao] += 1;
  return c;
}

function diasEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function montarEstudo(input: {
  analise: AnaliseParaEstudo;
  analiseCriadaEm: Date;
  viabilidade: ResultadoTipologia[];
  agora: Date;
}): MontagemEstudo {
  const { analise, viabilidade } = input;
  const conc = analise.concorrentes?.resumo ?? null;
  const medianaConc = conc?.precoM2Mediano ?? null;
  const itbi = {
    precoM2Mediano: analise.resumo.precoM2Mediano,
    precoM2P25: analise.resumo.precoM2P25,
    precoM2P75: analise.resumo.precoM2P75,
  };

  const posicionamento: PosicionamentoTipologia[] = viabilidade.map((r) => ({
    descricao: r.descricao,
    precoM2: r.precoM2,
    concorrentes: classificarPosicao(r.precoM2, medianaConc),
    itbi,
  }));

  const situacoes = contarSituacoes(viabilidade);
  const enquadramMcmv = viabilidade.filter((r) => r.mcmv.enquadra).length;
  const precoM2Medio = viabilidade.length ? arredondar2(viabilidade.reduce((s, r) => s + r.precoM2, 0) / viabilidade.length) : 0;
  const posicaoMedia = classificarPosicao(precoM2Medio, medianaConc);

  const resumoExecutivo: ResumoExecutivo = {
    itbi: { transacoes: analise.resumo.transacoes, ...itbi, de: analise.parametros.de, ate: analise.parametros.ate },
    concorrentes: conc ? { quantidade: conc.quantidade, precoM2Mediano: conc.precoM2Mediano } : null,
    viabilidade: { tipologias: viabilidade.length, ...situacoes, enquadramMcmv },
    tipologias: { precoM2Medio, posicaoMedia },
  };

  const alertas: Alerta[] = [];
  if (analise.resumo.transacoes < AMOSTRA_ITBI_MINIMA) {
    alertas.push({
      codigo: 'AMOSTRA_PEQUENA',
      mensagem: `Só ${analise.resumo.transacoes} transação(ões) do ITBI no raio e período: a mediana de R$/m² pode não representar o mercado. Considere um raio ou período maior.`,
    });
  }
  if (!analise.concorrentes) {
    alertas.push({
      codigo: 'ANALISE_SEM_CONCORRENTES',
      mensagem: 'A análise usada é anterior ao cadastro de concorrentes: faça uma análise nova para incluir a concorrência no estudo.',
    });
  } else if (analise.concorrentes.resumo.quantidade === 0) {
    alertas.push({
      codigo: 'SEM_CONCORRENTES',
      mensagem: 'Nenhum concorrente cadastrado no raio: cadastre os lançamentos da região para comparar preços.',
    });
  }
  const idade = diasEntre(input.analiseCriadaEm, input.agora);
  if (idade > ANALISE_ANTIGA_DIAS) {
    alertas.push({
      codigo: 'ANALISE_ANTIGA',
      mensagem: `A análise de mercado usada tem ${idade} dias: os dados do ITBI e dos concorrentes podem ter mudado.`,
    });
  }

  const destaques: string[] = [];
  destaques.push(
    itbi.precoM2Mediano !== null
      ? `ITBI: ${analise.resumo.transacoes} transação(ões) no raio de ${analise.parametros.raioMetros} m em ${analise.parametros.meses} meses, R$/m² mediano de ${m2(itbi.precoM2Mediano)}${itbi.precoM2P25 !== null && itbi.precoM2P75 !== null ? ` (metade entre ${m2(itbi.precoM2P25)} e ${m2(itbi.precoM2P75)})` : ''}.`
      : `ITBI: ${analise.resumo.transacoes} transação(ões) no raio de ${analise.parametros.raioMetros} m em ${analise.parametros.meses} meses, sem R$/m² calculável.`,
  );
  if (conc && conc.quantidade > 0) {
    destaques.push(
      `Concorrência: ${conc.quantidade} empreendimento(s) cadastrado(s) no raio${medianaConc !== null ? `, R$/m² mediano de tabela de ${m2(medianaConc)}` : ''}.`,
    );
  }
  destaques.push(
    `Viabilidade: ${situacoes.ok} de ${viabilidade.length} tipologia(s) sem ressalvas, ${situacoes.atencao} com atenção e ${situacoes.fora} fora; ${enquadramMcmv} enquadra(m) no MCMV.`,
  );
  if (posicaoMedia) {
    destaques.push(
      posicaoMedia.classe === 'alinhado'
        ? `Preço: R$/m² médio das tipologias (${m2(precoM2Medio)}) alinhado à concorrência (${posicaoMedia.diferencaPercentual >= 0 ? '+' : '−'}${pct(posicaoMedia.diferencaPercentual)}).`
        : `Preço: R$/m² médio das tipologias (${m2(precoM2Medio)}) ${pct(posicaoMedia.diferencaPercentual)} ${posicaoMedia.classe === 'acima' ? 'acima' : 'abaixo'} da mediana da concorrência.`,
    );
  }

  return { resumoExecutivo, posicionamento, alertas, destaques };
}
