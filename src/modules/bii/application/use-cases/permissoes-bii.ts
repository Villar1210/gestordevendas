// src/modules/bii/application/use-cases/permissoes-bii.ts
// Checagem de role repetida DENTRO dos use cases (defesa em profundidade: o
// guard da classe ja barra, mas o use case nao confia so nele).
import { ForbiddenException } from '@nestjs/common';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

export function exigirAdministrador(role: string): void {
  if (role !== 'Administrador') throw new ForbiddenException('Somente a administração acessa o BII.');
}

export function exigirSuperUsuario(role: string): void {
  if (role !== SUPER_USUARIO_ROLE_NAME) {
    throw new ForbiddenException('Somente o Super Usuário gerencia os dados públicos do BII.');
  }
}
