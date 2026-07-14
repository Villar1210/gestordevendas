// src/modules/rh/application/use-cases/update-user-cargo.use-case.ts
// Aba "Permissoes/Cargos" do Painel Administrativo - reatribui cargo
// hierarquico e/ou superior de um usuario ja aprovado, a qualquer momento.
import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';
import { isValidCargoHierarquico, VALID_CARGOS_HIERARQUICOS } from '../../domain/services/cargos-hierarquicos';

interface UpdateUserCargoInput {
  userId: string;
  tenantId: string;
  requesterRole: string;
  cargoHierarquico: string | null;
  superiorId: string | null;
}

@Injectable()
export class UpdateUserCargoUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
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

    return this.cadastroRepository.updateCargoHierarquico(input.userId, {
      cargoHierarquico: input.cargoHierarquico,
      superiorId: input.superiorId,
    });
  }
}
