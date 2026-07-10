// src/modules/auth/application/use-cases/get-me.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Injectable()
export class GetMeUseCase {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      tipoCliente: user.tipoCliente,
    };
  }
}
