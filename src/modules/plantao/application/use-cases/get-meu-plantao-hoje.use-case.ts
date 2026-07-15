// src/modules/plantao/application/use-cases/get-meu-plantao-hoje.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { IStandRepository } from '../../domain/repositories/stand-repository.interface';
import { GetCorretoresEscaladosHojeUseCase } from './get-corretores-escalados-hoje.use-case';

interface GetMeuPlantaoHojeInput {
  tenantId: string;
  // Stand fixo do Coordenador (req.user!.standId, vindo do JWT) - null se
  // ele ainda nao tiver stand atribuido.
  standId: string | null;
}

export interface MeuPlantaoHojeResult {
  standId: string | null;
  standNome: string | null;
  corretoresHojeCount: number;
}

// Usado pela Fatia 3 (frontend) do modulo Plantao/Stand para exibir
// "Stand: X - N corretores hoje" na tela do Coordenador (Kanban e
// Atendimento) - so agrega dados que ja existem, sem logica de RBAC nova
// (a filtragem de visibilidade real ja acontece em GetBoardUseCase/
// ListAtendimentosUseCase, ver cargo-escopo.ts).
@Injectable()
export class GetMeuPlantaoHojeUseCase {
  constructor(
    @Inject('IStandRepository') private readonly standRepository: IStandRepository,
    private readonly getCorretoresEscaladosHojeUseCase: GetCorretoresEscaladosHojeUseCase,
  ) {}

  async execute(input: GetMeuPlantaoHojeInput): Promise<MeuPlantaoHojeResult> {
    if (!input.standId) {
      return { standId: null, standNome: null, corretoresHojeCount: 0 };
    }

    const [stand, corretoresHoje] = await Promise.all([
      this.standRepository.findByIdAndTenant(input.standId, input.tenantId),
      this.getCorretoresEscaladosHojeUseCase.execute({ standId: input.standId }),
    ]);

    return {
      standId: input.standId,
      standNome: stand?.nome ?? null,
      corretoresHojeCount: corretoresHoje.length,
    };
  }
}
