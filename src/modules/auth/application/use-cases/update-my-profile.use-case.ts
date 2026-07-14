// src/modules/auth/application/use-cases/update-my-profile.use-case.ts
import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

interface UpdateMyProfileInput {
  userId: string;
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

// Aba "Meu Perfil" do Painel Administrativo - qualquer usuario logado
// edita os proprios dados (nao exige role especifica, so o token valido -
// mesmo padrao de "/auth/me" GET, que tambem e aberto a qualquer role).
@Injectable()
export class UpdateMyProfileUseCase {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateMyProfileInput): Promise<void> {
    if (!input.name?.trim() && !input.newPassword) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    // Valida a senha atual ANTES de aplicar qualquer mutacao - evita um
    // estado parcial onde o nome e salvo mas a troca de senha falha.
    // BadRequestException (nao UnauthorizedException) de proposito: esta
    // rota ja esta atras do JwtAuthGuard (token valido) - um 401 aqui
    // seria interpretado pelo apiRequest do frontend como "sessao
    // expirada" e forcaria logout, quando na verdade e so a senha atual
    // digitada errada (erro de validacao, nao de autenticacao).
    if (input.newPassword) {
      if (!input.currentPassword) {
        throw new BadRequestException('Informe a senha atual para definir uma nova senha.');
      }
      const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Senha atual incorreta.');
      }
    }

    if (input.name?.trim()) {
      await this.userRepository.updateName(input.userId, input.name.trim());
    }

    if (input.newPassword) {
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      await this.userRepository.updatePassword(input.userId, hashedPassword);
    }
  }
}
