// src/modules/rh/application/use-cases/update-user-cargo.use-case.ts
// Aba "Permissoes/Cargos" do Painel Administrativo - reatribui cargo
// hierarquico e/ou superior de um usuario ja aprovado, a qualquer momento.
import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';
import { isValidCargoHierarquico, VALID_CARGOS_HIERARQUICOS } from '../../domain/services/cargos-hierarquicos';
import { IStandRepository } from '../../../plantao/domain/repositories/stand-repository.interface';

const CARGO_COORDENADOR = 'coordenador';

interface UpdateUserCargoInput {
  userId: string;
  tenantId: string;
  requesterRole: string;
  cargoHierarquico: string | null;
  superiorId: string | null;
  // Modulo Plantao/Stand - so se aplica quando cargoHierarquico e
  // "coordenador" (o stand FIXO que ele coordena, ver Stand.coordenadores).
  standId: string | null;
}

@Injectable()
export class UpdateUserCargoUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IStandRepository') private readonly standRepository: IStandRepository,
  ) {}

  async execute(input: UpdateUserCargoInput): Promise<CadastroRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar cargos.');
    }

    if (input.cargoHierarquico && !isValidCargoHierarquico(input.cargoHierarquico)) {
      throw new BadRequestException(
        `Cargo hierarquico invalido. Use um destes: ${VALID_CARGOS_HIERARQUICOS.join(', ')}.`,
      );
    }

    const usuario = await this.cadastroRepository.findByIdAndTenant(input.userId, input.tenantId);
    if (!usuario) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    if (input.superiorId) {
      if (input.superiorId === input.userId) {
        throw new BadRequestException('Um usuario nao pode ser superior de si mesmo.');
      }
      const superior = await this.cadastroRepository.findByIdAndTenant(input.superiorId, input.tenantId);
      if (!superior) {
        throw new BadRequestException('Superior informado nao pertence a este tenant.');
      }
    }

    // "standId" so se aplica ao cargo Coordenador - falha de forma visivel
    // em vez de corrigir as escondidas (mesmo principio ja usado no E-doc:
    // um formulario mal formado nao deve ser "consertado" silenciosamente).
    if (input.standId && input.cargoHierarquico !== CARGO_COORDENADOR) {
      throw new BadRequestException('O campo "stand" so se aplica ao cargo Coordenador.');
    }
    if (input.standId) {
      const stand = await this.standRepository.findByIdAndTenant(input.standId, input.tenantId);
      if (!stand) {
        throw new BadRequestException('Stand informado nao pertence a este tenant.');
      }
    }

    return this.cadastroRepository.updateCargoHierarquico(input.userId, {
      cargoHierarquico: input.cargoHierarquico,
      superiorId: input.superiorId,
      standId: input.standId,
    });
  }
}
