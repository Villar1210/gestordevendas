// src/modules/bii/domain/services/funil.ts
// Funil por etapa (funcao PURA): etapas do pipeline em ordem de position,
// SEM "Repique" (perda nao e degrau do funil). entradas = cards distintos que
// entraram na etapa no periodo; conversaoProximaPct = entradas da proxima /
// entradas desta (ultima = null; desta = 0 -> null).
import { percentual } from './estatistica';
import { ehEtapaPerda } from './normalizar';

export interface EtapaFunil {
  stageId: string;
  nome: string;
  entradas: number;
  conversaoProximaPct: number | null;
}

export function montarFunil(
  etapasOrdenadas: { id: string; nome: string }[],
  eventos: { cardId: string; toStageId: string }[],
): EtapaFunil[] {
  const cardsPorEtapa = new Map<string, Set<string>>();
  for (const e of eventos) {
    let set = cardsPorEtapa.get(e.toStageId);
    if (!set) {
      set = new Set();
      cardsPorEtapa.set(e.toStageId, set);
    }
    set.add(e.cardId);
  }

  const etapas = etapasOrdenadas.filter((e) => !ehEtapaPerda(e.nome));
  return etapas.map((etapa, i) => {
    const entradas = cardsPorEtapa.get(etapa.id)?.size ?? 0;
    const proxima = etapas[i + 1];
    const conversaoProximaPct = proxima
      ? percentual(cardsPorEtapa.get(proxima.id)?.size ?? 0, entradas)
      : null;
    return { stageId: etapa.id, nome: etapa.nome, entradas, conversaoProximaPct };
  });
}
