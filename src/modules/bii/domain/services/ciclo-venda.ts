// src/modules/bii/domain/services/ciclo-venda.ts
// Ciclo de venda = dias entre a criacao do card e a ENTRADA em "Fechamento".
// Funcao PURA. Ciclo negativo (dado inconsistente, ex: card recriado/datas
// ajustadas) e descartado - nunca entra na media/mediana.
import { arredondar1, media, mediana } from './estatistica';

const MS_DIA = 24 * 60 * 60 * 1000;

export function cicloDias(criadoEm: Date, ganhoEm: Date): number | null {
  const diff = ganhoEm.getTime() - criadoEm.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / MS_DIA;
}

export function resumoCiclos(
  pares: { criadoEm: Date; ganhoEm: Date }[],
): { medio: number | null; mediano: number | null } {
  const ciclos = pares
    .map((p) => cicloDias(p.criadoEm, p.ganhoEm))
    .filter((c): c is number => c !== null);
  const m = media(ciclos);
  const md = mediana(ciclos);
  return { medio: m === null ? null : arredondar1(m), mediano: md === null ? null : arredondar1(md) };
}
