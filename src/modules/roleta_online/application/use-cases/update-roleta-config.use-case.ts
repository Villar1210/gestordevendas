// src/modules/roleta_online/application/use-cases/update-roleta-config.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IRoletaConfigRepository,
  RoletaConfigRecord,
} from '../../domain/repositories/roleta-config-repository.interface';

// 'sorteio' = Fatia 2 (Sorteio da vez): ordem sorteada das roletas por Stand/Produto.
const VALID_ALGORITMOS = ['round_robin', 'menor_fila', 'sorteio'];
const VALID_MODOS = ['automatico', 'semi_automatico'];

interface UpdateRoletaConfigInput {
  tenantId: string;
  requesterRole: string;
  algoritmo?: string;
  modo?: string;
  ativa?: boolean;
  timeoutAceiteMinutos?: number;
  minutosInatividadeOffline?: number;
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

    if (
      input.minutosInatividadeOffline !== undefined &&
      (!Number.isInteger(input.minutosInatividadeOffline) ||
        input.minutosInatividadeOffline < 0 ||
        input.minutosInatividadeOffline > 240)
    ) {
      throw new BadRequestException('Offline automatico precisa ser um numero inteiro entre 0 e 240 minutos (0 = desligado).');
    }

    return this.roletaConfigRepository.upsert({
      tenantId: input.tenantId,
      algoritmo: input.algoritmo,
      modo: input.modo,
      ativa: input.ativa,
      timeoutAceiteMinutos: input.timeoutAceiteMinutos,
      minutosInatividadeOffline: input.minutosInatividadeOffline,
    });
  }
}
