// src/modules/gestao_imobiliaria/application/use-cases/permissao-imovel.helper.ts
// Traduz as regras puras de domain/services/permissao-imovel.ts em 403
// (ForbiddenException) para os use cases da area Imoveis.
import { ForbiddenException } from '@nestjs/common';
import {
  CondicaoDonoImovel,
  EdicaoImovelBloqueadaError,
} from '../../domain/repositories/imovel-repository.interface';
import {
  AtorImovel,
  MENSAGENS_PERMISSAO_IMOVEL,
  ehAdministrador,
  mensagemBloqueioEdicao,
  podeAlterarStatusUnidade,
  verificarEdicaoCadastroImovel,
} from '../../domain/services/permissao-imovel';

export function garantirPodeAlterarStatus(ator: AtorImovel): void {
  if (!podeAlterarStatusUnidade(ator.role, ator.cargo)) {
    throw new ForbiddenException(MENSAGENS_PERMISSAO_IMOVEL.statusSomenteGestao);
  }
}

export function garantirPodeEditarCadastro(
  ator: AtorImovel,
  imovel: { criadoPorUserId: string | null; publicado: boolean },
): void {
  const bloqueio = verificarEdicaoCadastroImovel(ator, imovel);
  if (bloqueio) {
    throw new ForbiddenException(mensagemBloqueioEdicao(bloqueio));
  }
}

// Escrita condicional (revisao de seguranca): para nao-admin o repositorio
// so grava se o imovel AINDA for do usuario e nao publicado no instante da
// escrita. undefined = Administrador (escrita normal).
export function condicaoDonoPara(ator: AtorImovel, tenantId: string): CondicaoDonoImovel | undefined {
  return ehAdministrador(ator.role) ? undefined : { tenantId, userId: ator.userId };
}

// Converte EdicaoImovelBloqueadaError (corrida: publicaram ou trocou o dono
// entre a checagem e a escrita) no MESMO 403 da checagem normal.
export async function comBloqueioDeCorrida<T>(
  escrita: Promise<T>,
  ator: AtorImovel,
  recarregar: () => Promise<{ criadoPorUserId: string | null; publicado: boolean } | null>,
): Promise<T> {
  try {
    return await escrita;
  } catch (erro) {
    if (!(erro instanceof EdicaoImovelBloqueadaError)) throw erro;
    const atual = await recarregar();
    const bloqueio = atual ? verificarEdicaoCadastroImovel(ator, atual) : 'nao_e_dono';
    throw new ForbiddenException(mensagemBloqueioEdicao(bloqueio ?? 'ja_publicado'));
  }
}
