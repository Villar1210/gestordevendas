// src/modules/auth/application/use-cases/get-subordinados-recursivos.use-case.ts
// Sistema de permissoes por cargo hierarquico (RBAC) - "equipe" de um
// Gerente/Coordenador e a arvore INTEIRA de subordinados (nao so os
// diretos), ver User.superiorId/subordinados no schema. Prisma nao suporta
// CTE recursiva via query builder - percorre nivel por nivel em memoria
// (BFS), 1 query por nivel (nao 1 por pessoa, ver
// findAllByTenantAndSuperiorIds). Teto de 10 niveis: defesa contra ciclo
// de dados, que a principio nao deveria existir (onDelete: SetNull em
// superiorId), mas nao custa evitar um loop infinito por seguranca.
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

const MAX_NIVEIS = 10;

interface GetSubordinadosRecursivosInput {
  tenantId: string;
  userId: string;
}

@Injectable()
export class GetSubordinadosRecursivosUseCase {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(input: GetSubordinadosRecursivosInput): Promise<string[]> {
    const visitados = new Set<string>();
    let fronteira = [input.userId];

    for (let nivel = 0; nivel < MAX_NIVEIS && fronteira.length > 0; nivel++) {
      const diretos = await this.userRepository.findAllByTenantAndSuperiorIds(
        input.tenantId,
        fronteira,
      );
      const novos = diretos.filter((d) => !visitados.has(d.id));
      novos.forEach((d) => visitados.add(d.id));
      fronteira = novos.map((d) => d.id);
    }

    return Array.from(visitados);
  }
}
