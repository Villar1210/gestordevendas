// src/modules/gestao_imobiliaria/application/use-cases/alterar-status-imovel.use-case.ts
// PATCH /imoveis/:id/status (Espelho de Vendas / seletor de status). R1: so
// Administrador ou cargo de gestao (coordenador para cima) - a rota e liberada
// a todo o dashboard no guard, a regra fica aqui (ver permissao-imovel.ts).
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IImovelRepository,
  ImovelRecord,
} from '../../domain/repositories/imovel-repository.interface';
import { AtorImovel } from '../../domain/services/permissao-imovel';
import { garantirPodeAlterarStatus } from './permissao-imovel.helper';

@Injectable()
export class AlterarStatusImovelUseCase {
  constructor(@Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository) {}

  async execute(input: {
    imovelId: string;
    tenantId: string;
    status: string;
    ator: AtorImovel;
  }): Promise<ImovelRecord> {
    garantirPodeAlterarStatus(input.ator);

    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    return this.imovelRepository.update(imovel.id, { status: input.status });
  }
}
