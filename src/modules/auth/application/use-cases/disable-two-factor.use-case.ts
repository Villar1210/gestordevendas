// src/modules/auth/application/use-cases/disable-two-factor.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Injectable()
export class DisableTwoFactorUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.userRepository.setTwoFactorEnabled(userId, false);
  }
}
