// src/shared/infra/http/limite-concorrencia.ts
// Limite SIMPLES de requisicoes simultaneas por processo (cada worker do
// cluster tem o seu). Para rotas pesadas em memoria/CPU (ex: analisar book,
// baixar ZIP do book): passou do limite -> 503 na hora, sem enfileirar.
// Uso: @UseGuards(LimiteConcorrenciaGuard('book-zip', 2)). Como e um GUARD,
// roda ANTES dos interceptors - no upload multipart, antes do multer ler o
// corpo. A vaga e liberada quando a resposta termina OU a conexao cai
// (evento "close" do response), inclusive se um guard/handler seguinte
// lancar erro.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  Type,
  mixin,
} from '@nestjs/common';
import { Response } from 'express';

export const MENSAGEM_SERVIDOR_OCUPADO = 'Servidor ocupado. Tente em instantes.';

export class LimiteConcorrencia {
  private emUso = 0;

  constructor(readonly maximo: number) {}

  get ativos(): number {
    return this.emUso;
  }

  // Devolve a funcao de liberar (idempotente) ou null se nao ha vaga.
  tentarOcupar(): (() => void) | null {
    if (this.emUso >= this.maximo) return null;
    this.emUso++;
    let liberado = false;
    return () => {
      if (liberado) return;
      liberado = true;
      this.emUso--;
    };
  }
}

// Um contador por nome, compartilhado entre todas as rotas que usam o mesmo nome.
const limites = new Map<string, LimiteConcorrencia>();

export function limitePorNome(nome: string, maximo: number): LimiteConcorrencia {
  let limite = limites.get(nome);
  if (!limite) {
    limite = new LimiteConcorrencia(maximo);
    limites.set(nome, limite);
  }
  return limite;
}

export function LimiteConcorrenciaGuard(nome: string, maximo: number): Type<CanActivate> {
  @Injectable()
  class LimiteConcorrenciaGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const res = context.switchToHttp().getResponse<Response>();
      const liberar = limitePorNome(nome, maximo).tentarOcupar();
      if (!liberar) throw new ServiceUnavailableException(MENSAGEM_SERVIDOR_OCUPADO);
      res.once('close', liberar);
      return true;
    }
  }
  return mixin(LimiteConcorrenciaGuardMixin);
}
