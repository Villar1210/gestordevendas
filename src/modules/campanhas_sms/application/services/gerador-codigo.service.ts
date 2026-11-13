// src/modules/campanhas_sms/application/services/gerador-codigo.service.ts
// Codigos do link curto: 6 caracteres base62 (62^6 ~ 56 bilhoes), aleatorios
// (crypto), sem sequencia adivinhavel. Confere colisao no banco antes de usar;
// o UNIQUE da coluna e a garantia final.
import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { CAMPANHA_REPOSITORY, ICampanhaRepository } from '../../domain/repositories/campanha-repository.interface';
import { TAMANHO_CODIGO } from '../../domain/services/sms-texto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const REGEX_CODIGO = /^[A-Za-z0-9]{6}$/;

export function codigoAleatorio(tamanho = TAMANHO_CODIGO): string {
  let s = '';
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

@Injectable()
export class GeradorCodigoService {
  constructor(@Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository) {}

  async gerar(quantidade: number): Promise<string[]> {
    const resultado = new Set<string>();
    for (let rodada = 0; rodada < 10 && resultado.size < quantidade; rodada++) {
      const faltam = quantidade - resultado.size;
      const candidatos = new Set<string>();
      while (candidatos.size < faltam) {
        const c = codigoAleatorio();
        if (!resultado.has(c)) candidatos.add(c);
      }
      const emUso = await this.repo.codigosEmUso(Array.from(candidatos));
      for (const c of candidatos) if (!emUso.has(c)) resultado.add(c);
    }
    if (resultado.size < quantidade) throw new Error('Não foi possível gerar códigos únicos para os links.');
    return Array.from(resultado);
  }
}
