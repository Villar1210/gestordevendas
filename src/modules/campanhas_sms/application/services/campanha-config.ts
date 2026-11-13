// src/modules/campanhas_sms/application/services/campanha-config.ts
// Configuracao lida do ambiente + utilitarios de tempo local.
import { Injectable } from '@nestjs/common';
import type { MomentoLocal } from '../../domain/services/janela-envio';

export const FUSO_CAMPANHAS = 'America/Sao_Paulo';

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function momentoLocal(data: Date, fuso = FUSO_CAMPANHAS): MomentoLocal {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(data);
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  return { diaSemana: DIAS[dia] ?? 1, hora: hora === 24 ? 0 : hora };
}

/** Base do link curto, sem barra no fim. So https (ou http em localhost). */
export function baseLinkCurto(env: NodeJS.ProcessEnv = process.env): string {
  const bruto = (env.SHORTLINK_BASE_URL || '').trim() || `${(env.FRONTEND_URL || 'http://localhost:3000').trim()}/api/r`;
  const semBarra = bruto.replace(/\/+$/, '');
  try {
    const url = new URL(semBarra);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return semBarra;
  } catch {
    // cai no padrao abaixo
  }
  return 'http://localhost:3000/api/r';
}

@Injectable()
export class CampanhaConfig {
  get baseLink(): string {
    return baseLinkCurto();
  }

  linkDoCodigo(codigo: string): string {
    return `${this.baseLink}/${codigo}`;
  }

  agora(): Date {
    return new Date();
  }
}
