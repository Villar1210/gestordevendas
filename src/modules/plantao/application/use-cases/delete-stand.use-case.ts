// src/modules/plantao/application/use-cases/delete-stand.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IStandRepository } from '../../domain/repositories/stand-repository.interface';

interface DeleteStandInput {
  standId: string;
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class DeleteStandUseCase {
  constructor(@Inject('IStandRepository') private readonly standRepository: IStandRepository) {}

  async execute(input: DeleteStandInput): Promise<void> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode excluir stands.');
    }

    const stand = await this.standRepository.findByIdAndTenant(input.standId, input.tenantId);
    if (!stand) {
      throw new NotFoundException('Stand nao encontrado.');
    }

    // Bloqueia a exclusao se houver escala definida (perderia dado real) ou
    // Coordenador vinculado (seria desvinculado silenciosamente via
    // onDelete: SetNull) - mesmo principio ja usado em DeleteStageUseCase
    // (Kanban), que bloqueia excluir uma coluna com cards dentro.
    const [totalEscalas, totalCoordenadores] = await Promise.all([
      this.standRepository.countEscalasByStand(input.standId),
      this.standRepository.countCoordenadoresByStand(input.standId),
    ]);
    if (totalEscalas > 0) {
      throw new BadRequestException(
        'Este stand tem escala definida - remova todas as escalas antes de excluir.',
      );
    }
    if (totalCoordenadores > 0) {
      throw new BadRequestException(
        'Este stand tem um Coordenador vinculado - desvincule antes de excluir.',
      );
    }

    await this.standRepository.delete(input.standId);
  }
}
