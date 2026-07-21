// src/modules/social_media/application/use-cases/desconectar-conta-social.use-case.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ISocialAccountRepository } from '../../domain/repositories/social-account-repository.interface';

export interface DesconectarContaSocialInput {
  tenantId: string;
  id: string;
}

@Injectable()
export class DesconectarContaSocialUseCase {
  constructor(
    @Inject('ISocialAccountRepository')
    private readonly socialAccountRepository: ISocialAccountRepository,
  ) {}

  async execute(input: DesconectarContaSocialInput): Promise<void> {
    const conta = await this.socialAccountRepository.findById(input.id);

    if (!conta || conta.tenantId !== input.tenantId) {
      throw new NotFoundException('Conta social nao encontrada.');
    }

    // Zera o token junto com o status - uma conta desconectada nao deve
    // manter uma credencial valida e sem uso guardada no banco (mesmo
    // raciocinio de nao deixar segredo "morto" em repouso). Reconectar
    // pela mesma pagina/conta gera um token novo (ver
    // ProcessarCallbackOAuthUseCase.upsertConta).
    await this.socialAccountRepository.update(conta.id, {
      status: 'DISCONNECTED',
      accessToken: null,
      refreshToken: null,
    });
  }
}
