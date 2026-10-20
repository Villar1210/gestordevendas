// src/modules/bii/application/services/cobertura-itbi.cache.ts
// Cache em memoria (por processo) do GET /bii/itbi/cobertura: as contagens
// varrem a tabela global do ITBI (~1 milhao de linhas) e mudam so quando uma
// importacao ou geocodificacao termina - quem termina chama invalidar().
// Validade de 10 minutos de qualquer forma (outro processo pode ter mudado).
import { Injectable } from '@nestjs/common';

export const COBERTURA_CACHE_MS = 10 * 60 * 1000;

@Injectable()
export class CoberturaItbiCache {
  private valor: { dados: unknown; expira: number } | null = null;
  private versao = 0;
  agora: () => number = () => Date.now();

  async obter<T>(calcular: () => Promise<T>): Promise<T> {
    if (this.valor && this.valor.expira > this.agora()) return this.valor.dados as T;
    const versao = this.versao;
    const dados = await calcular();
    // invalidado enquanto calculava: devolve, mas nao guarda o valor velho
    if (versao === this.versao) this.valor = { dados, expira: this.agora() + COBERTURA_CACHE_MS };
    return dados;
  }

  invalidar(): void {
    this.versao++;
    this.valor = null;
  }
}
