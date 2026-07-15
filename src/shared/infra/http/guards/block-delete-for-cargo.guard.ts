// src/shared/infra/http/guards/block-delete-for-cargo.guard.ts
// Sistema de permissoes por cargo hierarquico (RBAC) - bloqueia DELETE de
// registros de negocio para quem o cargo nao permite excluir (Diretor/
// Gerente/Coordenador - ver CARGO_ESCOPO em cargo-escopo.ts). Diferente de
// RolesGuard (que le Role.name e precisa de metadata @Roles por rota),
// esta guard nao aceita parametro - a regra e sempre a mesma onde for
// aplicada, entao e so anexar @UseGuards(..., BlockDeleteForCargoGuard)
// diretamente nas rotas que bloqueiam exclusao (hoje: DELETE /cards/:id e
// DELETE /stages/:id). Sempre usada DEPOIS de JwtAuthGuard (precisa de
// req.user ja preenchido).
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { podeExcluirRegistroDeNegocio } from '../../../domain/services/cargo-escopo';

@Injectable()
export class BlockDeleteForCargoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const role = request.user?.role;
    const cargo = request.user?.cargo ?? null;

    if (!role || !podeExcluirRegistroDeNegocio(role, cargo)) {
      throw new ForbiddenException('Seu cargo nao tem permissao para excluir este registro.');
    }

    return true;
  }
}
