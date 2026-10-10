// src/modules/pdf_tools/infra/http/batch-throttler.guard.ts
// Limite proprio das rotas que aceitam LOTE (ate 20 arquivos por envio):
// 6 requisicoes/min por USUARIO (nao por IP - varios usuarios atras do
// mesmo NAT nao se bloqueiam, e um usuario nao contorna trocando de IP).
// Complementa (nao substitui) o throttle global por IP. Roda DEPOIS do
// JwtAuthGuard (guard de metodo), entao req.user ja esta preenchido.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { PDF_TOOLS_LIMITS } from '../../domain/pdf-tools.limits';

export const BATCH_THROTTLER_NAME = 'pdf-tools-batch';

@Injectable()
export class PdfToolsBatchThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Nao depende de onModuleInit (guard de rota pode nao receber o hook).
    this.commonOptions ??= {};
    const ttl = PDF_TOOLS_LIMITS.batchThrottleTtlMs;
    const limit = PDF_TOOLS_LIMITS.batchThrottleLimit;
    return this.handleRequest({
      context,
      limit,
      ttl,
      blockDuration: ttl,
      throttler: { name: BATCH_THROTTLER_NAME, limit, ttl },
      getTracker: (req) => this.getTracker(req),
      generateKey: (ctx, tracker, name) => this.generateKey(ctx, tracker, name),
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip ?? 'desconhecido'}`;
  }

  /** Chave por usuario e ROTA (6/min em cada ferramenta de lote). */
  protected generateKey(context: ExecutionContext, tracker: string, name: string): string {
    return super.generateKey(context, tracker, name);
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      `Muitos envios em pouco tempo: são no máximo ${PDF_TOOLS_LIMITS.batchThrottleLimit} por minuto nesta ferramenta. Aguarde um minuto e tente novamente.`,
    );
  }
}
