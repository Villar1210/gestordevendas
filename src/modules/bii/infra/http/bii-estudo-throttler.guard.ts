// src/modules/bii/infra/http/bii-estudo-throttler.guard.ts
// POST/PATCH/DELETE /bii/estudos: 30 por minuto POR USUARIO SOMANDO as 3
// rotas (chave sem o handler; tracker
// req.user.id), complementando o throttle por IP da rota. Cada estudo grava um
// snapshot de dezenas de KB: o limite evita ciclos de criar/excluir por um
// usuario. Mesmo molde do BiiConcorrenteThrottlerGuard (Fatia 3).
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

export const BII_ESTUDO_THROTTLER_NAME = 'bii-estudo-usuario';
export const BII_ESTUDO_POR_MINUTO = 30;
const TTL_MS = 60_000;

@Injectable()
export class BiiEstudoThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.commonOptions ??= {};
    return this.handleRequest({
      context,
      limit: BII_ESTUDO_POR_MINUTO,
      ttl: TTL_MS,
      blockDuration: TTL_MS,
      throttler: { name: BII_ESTUDO_THROTTLER_NAME, limit: BII_ESTUDO_POR_MINUTO, ttl: TTL_MS },
      getTracker: (req) => this.getTracker(req),
      // chave UNICA para POST/PATCH/DELETE (o generateKey padrao inclui o
      // handler e daria 30 por rota): 30/min no total por usuario
      generateKey: (_ctx, tracker, name) => `${name}-${tracker}`,
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip ?? 'desconhecido'}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      `Muitas alterações em pouco tempo: são no máximo ${BII_ESTUDO_POR_MINUTO} por minuto. Aguarde um minuto e tente novamente.`,
    );
  }
}
