// src/modules/social_media/application/use-cases/list-social-accounts.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { ISocialAccountRepository } from '../../domain/repositories/social-account-repository.interface';

export interface ListSocialAccountsInput {
  tenantId: string;
}

export interface SocialAccountListItem {
  id: string;
  canal: string;
  accountName: string;
  status: string;
  tokenExpiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ListSocialAccountsUseCase {
  constructor(
    @Inject('ISocialAccountRepository')
    private readonly socialAccountRepository: ISocialAccountRepository,
  ) {}

  async execute(input: ListSocialAccountsInput): Promise<SocialAccountListItem[]> {
    const contas = await this.socialAccountRepository.findAllByTenant(input.tenantId);

    // accessToken/refreshToken NUNCA saem daqui - o frontend so precisa
    // saber que a conta esta conectada, nao o token em si.
    return contas.map((conta) => ({
      id: conta.id,
      canal: conta.canal,
      accountName: conta.accountName,
      status: conta.status,
      tokenExpiresAt: conta.tokenExpiresAt,
      createdAt: conta.createdAt,
    }));
  }
}
