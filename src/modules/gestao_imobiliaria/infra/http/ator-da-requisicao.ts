// src/modules/gestao_imobiliaria/infra/http/ator-da-requisicao.ts
// Monta o AtorImovel (quem executa a acao) a partir de req.user (JWT).
// cargo vem do token emitido no login - ver jwt.strategy.ts.
import { Request } from 'express';
import { AtorImovel } from '../../domain/services/permissao-imovel';

export function atorDaRequisicao(req: Request): AtorImovel {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    cargo: req.user!.cargo ?? null,
  };
}
