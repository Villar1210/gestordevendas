// src/modules/auth/application/use-cases/get-me.use-case.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Injectable()
export class GetMeUseCase {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  // impersonadoPor vem do JWT (req.user), nao do banco - GetMeUseCase so
  // repassa pro frontend saber se a sessao atual e uma impersonacao do
  // Super Usuario (ver ImpersonarTenantUseCase/modulo super_usuario), pra
  // decidir se mostra a barra de "modo simulacao".
  async execute(userId: string, impersonadoPor: string | null = null) {
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
      impersonadoPor,
      // Sistema de permissoes por cargo hierarquico (RBAC) - frontend usa
      // isso pra decidir o que esconder (ver core/constants/cargoEscopo.ts,
      // mirror de shared/domain/services/cargo-escopo.ts do backend).
      cargoHierarquico: user.cargoHierarquico,
      // Modulo Plantao/Stand: stand fixo do Coordenador (null para outros
      // cargos) - frontend usa isso so pra decidir SE busca o status do dia
      // (GET /stands/meu-status-hoje), sem precisar de outra consulta so
      // pra saber se o usuario e Coordenador com stand.
      standId: user.standId,
      // Onboarding do Corretor: frontend usa isso pra continuar exibindo a
      // tela de troca obrigatoria mesmo apos um reload (nao so no momento
      // do login) - ver AuthenticateUserUseCase/VerifyTwoFactorCodeUseCase.
      mustChangePassword: user.mustChangePassword,
    };
  }
}
