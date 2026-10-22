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

// Super Usuario impersonando: BII SOMENTE LEITURA (decisao do Villar, Fase 1).
// Corpo com code estavel para o frontend nao depender do texto.
export const CODIGO_SOMENTE_LEITURA = 'BII_SOMENTE_LEITURA';
export const MENSAGEM_SOMENTE_LEITURA =
  'No modo de acesso do Super Usuário o BII é somente leitura. Entre com um Administrador da empresa para criar análises.';
export const MENSAGEM_SOMENTE_LEITURA_CONCORRENTES =
  'No modo de acesso do Super Usuário o BII é somente leitura. Entre com um Administrador da empresa para cadastrar ou alterar concorrentes.';

export function bloquearImpersonacao(impersonadoPor: string | null | undefined, mensagem = MENSAGEM_SOMENTE_LEITURA): void {
  if (impersonadoPor) {
    throw new ForbiddenException({ statusCode: 403, code: CODIGO_SOMENTE_LEITURA, message: mensagem });
  }
}
