// src/modules/plantao/application/use-cases/set-escala.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IStandRepository } from '../../domain/repositories/stand-repository.interface';
import {
  IEscalaPlantaoRepository,
  EscalaPlantaoRecord,
} from '../../domain/repositories/escala-plantao-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';

interface SetEscalaInput {
  tenantId: string;
  requesterRole: string;
  standId: string;
  userId: string;
  diaSemana: number;
}

// "Definir" e idempotente de proposito - se a combinacao stand+usuario+dia
// ja existe, so devolve a linha existente em vez de dar erro de duplicata
// (a unique constraint do banco existe pra INTEGRIDADE, nao pra virar um
// erro visivel numa acao que o Administrador pode tentar repetir sem
// querer, ex: duplo clique).
@Injectable()
export class SetEscalaUseCase {
  constructor(
    @Inject('IStandRepository') private readonly standRepository: IStandRepository,
    @Inject('IEscalaPlantaoRepository')
    private readonly escalaPlantaoRepository: IEscalaPlantaoRepository,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: SetEscalaInput): Promise<EscalaPlantaoRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode definir a escala.');
    }
    if (!Number.isInteger(input.diaSemana) || input.diaSemana < 0 || input.diaSemana > 6) {
      throw new BadRequestException('Dia da semana invalido - use um numero de 0 (domingo) a 6 (sabado).');
    }

    const stand = await this.standRepository.findByIdAndTenant(input.standId, input.tenantId);
    if (!stand) {
      throw new NotFoundException('Stand nao encontrado.');
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user || user.tenantId !== input.tenantId) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const existente = await this.escalaPlantaoRepository.findByStandUserDia(
      input.standId,
      input.userId,
      input.diaSemana,
    );
    if (existente) {
      return existente;
    }

    return this.escalaPlantaoRepository.create({
      tenantId: input.tenantId,
      standId: input.standId,
      userId: input.userId,
      diaSemana: input.diaSemana,
    });
  }
}
