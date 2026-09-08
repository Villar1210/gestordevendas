// src/modules/auth/application/use-cases/logout.use-case.ts
// Encerra a sessao do usuario atual invalidando todos os tokens JWT emitidos
// ate este momento (incrementa tokenVersion no banco). O frontend deve
// remover o token do localStorage apos chamar este endpoint.
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.userRepository.incrementTokenVersion(userId);
  }
}
