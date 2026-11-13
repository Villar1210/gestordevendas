// src/modules/campanhas_sms/infra/http/campanha-sms-throttler.guard.ts
// Limites POR USUARIO (tracker req.user.id), somando as rotas de cada grupo,
// alem do throttle por IP da rota. Mesmo molde do BiiEstudoThrottlerGuard.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

const TTL_MS = 60_000;

abstract class PorUsuarioThrottlerGuard extends ThrottlerGuard {
  protected abstract readonly nomeLimite: string;
  protected abstract readonly porMinuto: number;
  protected abstract readonly mensagem: string;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.commonOptions ??= {};
    return this.handleRequest({
      context,
      limit: this.porMinuto,
      ttl: TTL_MS,
      blockDuration: TTL_MS,
      throttler: { name: this.nomeLimite, limit: this.porMinuto, ttl: TTL_MS },
      getTracker: (req) => this.getTracker(req),
      generateKey: (_ctx, tracker, name) => `${name}-${tracker}`,
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip ?? 'desconhecido'}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(this.mensagem);
  }
}

/** Criar/editar/importar/iniciar/pausar/cancelar/opt-out: 30 por minuto no total. */
@Injectable()
export class CampanhaEscritaThrottlerGuard extends PorUsuarioThrottlerGuard {
  protected readonly nomeLimite = 'campanha-sms-escrita';
  protected readonly porMinuto = 30;
  protected readonly mensagem = 'Muitas alterações em pouco tempo (máximo 30 por minuto). Aguarde um minuto.';
}

/** SMS de teste: 5 por minuto (cada um custa um SMS de verdade). */
@Injectable()
export class CampanhaTesteThrottlerGuard extends PorUsuarioThrottlerGuard {
  protected readonly nomeLimite = 'campanha-sms-teste';
  protected readonly porMinuto = 5;
  protected readonly mensagem = 'No máximo 5 SMS de teste por minuto. Aguarde um pouco.';
}
