// src/modules/bii/infra/http/bii-analise-throttler.guard.ts
// POST /bii/analises/endereco: 10 por minuto POR USUARIO (tracker req.user.id;
// varios administradores atras do mesmo NAT nao se bloqueiam, e trocar de IP
// nao contorna). Molde: PdfToolsBatchThrottlerGuard. Complementa o throttle
// por IP da rota e a cota diaria por tenant (no use case). Guard de metodo:
// roda depois do JwtAuthGuard, req.user ja esta preenchido.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

export const BII_ANALISE_THROTTLER_NAME = 'bii-analise-usuario';
export const BII_ANALISE_POR_MINUTO = 10;
const TTL_MS = 60_000;

@Injectable()
export class BiiAnaliseThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.commonOptions ??= {};
    return this.handleRequest({
      context,
      limit: BII_ANALISE_POR_MINUTO,
      ttl: TTL_MS,
      blockDuration: TTL_MS,
      throttler: { name: BII_ANALISE_THROTTLER_NAME, limit: BII_ANALISE_POR_MINUTO, ttl: TTL_MS },
      getTracker: (req) => this.getTracker(req),
      generateKey: (ctx, tracker, name) => this.generateKey(ctx, tracker, name),
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip ?? 'desconhecido'}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      `Muitas análises em pouco tempo: são no máximo ${BII_ANALISE_POR_MINUTO} por minuto. Aguarde um minuto e tente novamente.`,
    );
  }
}
