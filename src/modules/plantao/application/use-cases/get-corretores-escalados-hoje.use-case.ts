// src/modules/plantao/application/use-cases/get-corretores-escalados-hoje.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { IEscalaPlantaoRepository } from '../../domain/repositories/escala-plantao-repository.interface';

interface GetCorretoresEscaladosHojeInput {
  // null quando o Coordenador ainda nao tem stand fixo atribuido - resolve
  // para lista vazia, sem fallback nenhum (ver cargo-escopo.ts, escopo
  // 'plantao').
  standId: string | null;
}

@Injectable()
export class GetCorretoresEscaladosHojeUseCase {
  constructor(
    @Inject('IEscalaPlantaoRepository')
    private readonly escalaPlantaoRepository: IEscalaPlantaoRepository,
  ) {}

  async execute(input: GetCorretoresEscaladosHojeInput): Promise<string[]> {
    if (!input.standId) return [];

    // getDay(): 0=domingo...6=sabado, mesma convencao de EscalaPlantao.diaSemana.
    const diaSemanaHoje = new Date().getDay();
    const escalas = await this.escalaPlantaoRepository.findAllByStandAndDia(
      input.standId,
      diaSemanaHoje,
    );
    return escalas.map((e) => e.userId);
  }
}
