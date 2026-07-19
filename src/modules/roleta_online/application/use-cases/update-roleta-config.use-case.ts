// src/modules/roleta_online/application/use-cases/update-roleta-config.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IRoletaConfigRepository,
  RoletaConfigRecord,
} from '../../domain/repositories/roleta-config-repository.interface';

const VALID_ALGORITMOS = ['round_robin', 'menor_fila'];
const VALID_MODOS = ['automatico', 'semi_automatico'];

interface UpdateRoletaConfigInput {
  tenantId: string;
  requesterRole: string;
  algoritmo?: string;
  modo?: string;
  ativa?: boolean;
  timeoutAceiteMinutos?: number;
}

@Injectable()
export class UpdateRoletaConfigUseCase {
  constructor(
    @Inject('IRoletaConfigRepository')
    private readonly roletaConfigRepository: IRoletaConfigRepository,
  ) {}

  async execute(input: UpdateRoletaConfigInput): Promise<RoletaConfigRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode configurar a Roleta Online.');
    }

    if (input.algoritmo && !VALID_ALGORITMOS.includes(input.algoritmo)) {
      throw new BadRequestException(
        `Algoritmo invalido. Use um destes: ${VALID_ALGORITMOS.join(', ')}.`,
      );
    }

    if (input.modo && !VALID_MODOS.includes(input.modo)) {
      throw new BadRequestException(`Modo invalido. Use um destes: ${VALID_MODOS.join(', ')}.`);
    }

    if (
      input.timeoutAceiteMinutos !== undefined &&
      (!Number.isInteger(input.timeoutAceiteMinutos) ||
        input.timeoutAceiteMinutos < 1 ||
        input.timeoutAceiteMinutos > 120)
    ) {
      throw new BadRequestException('Tempo para aceite precisa ser um numero inteiro entre 1 e 120 minutos.');
    }

    return this.roletaConfigRepository.upsert({
      tenantId: input.tenantId,
      algoritmo: input.algoritmo,
      modo: input.modo,
      ativa: input.ativa,
      timeoutAceiteMinutos: input.timeoutAceiteMinutos,
    });
  }
}
