// src/shared/infra/http/guards/app-throttler.guard.ts
// Mesmo ThrottlerGuard do @nestjs/throttler, so troca a mensagem padrao em
// ingles ("ThrottlerException: Too Many Requests") por uma em portugues.
import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.');
  }
}
