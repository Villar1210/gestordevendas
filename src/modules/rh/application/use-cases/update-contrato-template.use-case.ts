// src/modules/rh/application/use-cases/update-contrato-template.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IContratoTemplateRepository,
  ContratoTemplateRecord,
} from '../../domain/repositories/contrato-template-repository.interface';
import { GetOrCreateContratoTemplateUseCase } from './get-or-create-contrato-template.use-case';

interface UpdateContratoTemplateInput {
  tenantId: string;
  requesterRole: string;
  nome: string;
  corpo: string;
}

@Injectable()
export class UpdateContratoTemplateUseCase {
  constructor(
    @Inject('IContratoTemplateRepository')
    private readonly contratoTemplateRepository: IContratoTemplateRepository,
    private readonly getOrCreateContratoTemplateUseCase: GetOrCreateContratoTemplateUseCase,
  ) {}

  async execute(input: UpdateContratoTemplateInput): Promise<ContratoTemplateRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar o template de contrato.');
    }
    if (!input.corpo.trim()) {
      throw new BadRequestException('O corpo do contrato nao pode ficar vazio.');
    }

    // Garante que existe uma linha para atualizar - mesmo template padrao
    // que GET /rh/contrato-template ja usa (cria automaticamente na
    // primeira vez, se ainda nao existir).
    const existente = await this.getOrCreateContratoTemplateUseCase.execute({
      tenantId: input.tenantId,
    });

    return this.contratoTemplateRepository.update(existente.id, {
      nome: input.nome,
      corpo: input.corpo,
    });
  }
}
