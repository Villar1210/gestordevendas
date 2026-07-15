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
      // Sistema de permissoes por cargo hierarquico (RBAC) - frontend usa
      // isso pra decidir o que esconder (ver core/constants/cargoEscopo.ts,
      // mirror de shared/domain/services/cargo-escopo.ts do backend).
      cargoHierarquico: user.cargoHierarquico,
      // Modulo Plantao/Stand: stand fixo do Coordenador (null para outros
      // cargos) - frontend usa isso so pra decidir SE busca o status do dia
      // (GET /stands/meu-status-hoje), sem precisar de outra consulta so
      // pra saber se o usuario e Coordenador com stand.
      standId: user.standId,
    };
  }
}
