// src/modules/plantao/application/use-cases/update-stand.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IStandRepository, StandRecord } from '../../domain/repositories/stand-repository.interface';

interface UpdateStandInput {
  standId: string;
  tenantId: string;
  requesterRole: string;
  nome: string;
  endereco?: string | null;
  ativo: boolean;
}

@Injectable()
export class UpdateStandUseCase {
  constructor(@Inject('IStandRepository') private readonly standRepository: IStandRepository) {}

  async execute(input: UpdateStandInput): Promise<StandRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar stands.');
    }
    if (!input.nome.trim()) {
      throw new BadRequestException('Informe o nome do stand.');
    }

    const stand = await this.standRepository.findByIdAndTenant(input.standId, input.tenantId);
    if (!stand) {
      throw new NotFoundException('Stand nao encontrado.');
    }

    return this.standRepository.update(input.standId, {
      nome: input.nome.trim(),
      endereco: input.endereco,
      ativo: input.ativo,
    });
  }
}
