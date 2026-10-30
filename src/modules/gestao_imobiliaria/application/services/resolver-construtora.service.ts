// src/modules/gestao_imobiliaria/application/services/resolver-construtora.service.ts
// Decide qual construtora um empreendimento usa (Fatia A do cadastro de
// Construtoras), compartilhado por criar/editar empreendimento e pelo book:
// - construtoraId: tem de ser do PROPRIO tenant (senao 404);
// - construtoraId null: desvincula (so na edicao);
// - so o texto (compatibilidade, book): acha pelo nome normalizado ou CRIA.
// O texto legado Empreendimento.construtora passa a ser sempre o nome da
// construtora vinculada.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import {
  ConstrutoraRecord,
  IConstrutoraRepository,
} from '../../domain/repositories/construtora-repository.interface';
import {
  CONSTRUTORA_NOME_MAX,
  MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA,
  limparNomeConstrutora,
  normalizarNomeConstrutora,
} from '../../domain/services/construtora';

export interface ConstrutoraResolvida {
  construtoraId: string | null;
  construtora: string | null;
}

@Injectable()
export class ResolverConstrutoraService {
  constructor(
    @Inject('IConstrutoraRepository') private readonly construtoraRepository: IConstrutoraRepository,
  ) {}

  // undefined = nada informado (na edicao: nao mexe no vinculo).
  async resolver(input: {
    tenantId: string;
    construtoraId?: string | null;
    construtoraTexto?: string | null;
  }): Promise<ConstrutoraResolvida | undefined> {
    if (input.construtoraId !== undefined) {
      if (input.construtoraId === null) return { construtoraId: null, construtora: null };
      const construtora = await this.construtoraRepository.findByIdAndTenant(input.construtoraId, input.tenantId);
      if (!construtora) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
      return { construtoraId: construtora.id, construtora: construtora.nome };
    }
    if (input.construtoraTexto === undefined) return undefined;
    const nome = limparNomeConstrutora(input.construtoraTexto ?? '').slice(0, CONSTRUTORA_NOME_MAX);
    if (!nome) return { construtoraId: null, construtora: null };
    const construtora = await this.acharOuCriarPorNome(input.tenantId, nome);
    return { construtoraId: construtora.id, construtora: construtora.nome };
  }

  async acharOuCriarPorNome(tenantId: string, nome: string): Promise<ConstrutoraRecord> {
    const nomeNormalizado = normalizarNomeConstrutora(nome);
    const existente = await this.construtoraRepository.findByNomeNormalizado(tenantId, nomeNormalizado);
    if (existente) return existente;
    try {
      return await this.construtoraRepository.create({ tenantId, nome, nomeNormalizado });
    } catch (error) {
      // Corrida: outro pedido criou a mesma construtora entre o find e o create.
      if (error instanceof UniqueConstraintViolationError) {
        const criada = await this.construtoraRepository.findByNomeNormalizado(tenantId, nomeNormalizado);
        if (criada) return criada;
      }
      throw error;
    }
  }
}
