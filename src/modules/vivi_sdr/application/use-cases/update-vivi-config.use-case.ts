// src/modules/vivi_sdr/application/use-cases/update-vivi-config.use-case.ts
// Aba "Configuracoes da VIVI" (Painel de Configuracao) - Administrador edita
// preco minimo, as faixas de renda (Faixa 1-4 + Sem Perfil) usadas tanto no
// prompt quanto na classificacao autoritativa (classificarRenda), e os
// detalhes de negocio por faixa (subsidio/juros/teto de financiamento/
// exemplo de parcela).
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IViviConfigRepository,
  ViviConfigRecord,
  UpdateViviConfigInput as RepositoryUpdateInput,
} from '../../domain/repositories/vivi-config-repository.interface';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';

interface UpdateViviConfigInput extends RepositoryUpdateInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class UpdateViviConfigUseCase {
  constructor(
    @Inject('IViviConfigRepository') private readonly viviConfigRepository: IViviConfigRepository,
    private readonly getOrCreateViviConfigUseCase: GetOrCreateViviConfigUseCase,
  ) {}

  async execute(input: UpdateViviConfigInput): Promise<ViviConfigRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar as configuracoes da VIVI.');
    }

    // As faixas precisam ser estritamente crescentes - caso contrario
    // classificarRenda() produziria resultados inconsistentes (ex: Faixa 1
    // maior que Faixa 2 faria toda renda cair sempre em Faixa 1).
    if (
      !(
        input.limiteSemPerfil < input.limiteFaixa1 &&
        input.limiteFaixa1 < input.limiteFaixa2 &&
        input.limiteFaixa2 < input.limiteFaixa3 &&
        input.limiteFaixa3 < input.limiteFaixa4
      )
    ) {
      throw new BadRequestException(
        'As faixas de renda precisam ser crescentes: Sem Perfil < Faixa 1 < Faixa 2 < Faixa 3 < Faixa 4.',
      );
    }
    if (input.precoMinimo <= 0) {
      throw new BadRequestException('O preco minimo precisa ser maior que zero.');
    }

    if (input.diasParaRotting !== undefined && input.diasParaRotting <= 0) {
      throw new BadRequestException('Os dias para rotting precisam ser maiores que zero.');
    }

    for (const [faixa, min, max] of [
      ['Faixa 1', input.faixa1JurosMin, input.faixa1JurosMax],
      ['Faixa 2', input.faixa2JurosMin, input.faixa2JurosMax],
      ['Faixa 3', input.faixa3JurosMin, input.faixa3JurosMax],
      ['Faixa 4', input.faixa4JurosMin, input.faixa4JurosMax],
    ] as const) {
      if (min !== null && max !== null && min > max) {
        throw new BadRequestException(`Na ${faixa}, os juros minimos nao podem ser maiores que os juros maximos.`);
      }
    }

    // Garante que existe uma linha para atualizar (mesmo padrao de
    // UpdateContratoTemplateUseCase).
    await this.getOrCreateViviConfigUseCase.execute({ tenantId: input.tenantId });

    const { tenantId, requesterRole, ...repositoryInput } = input;
    return this.viviConfigRepository.update(tenantId, repositoryInput);
  }
}
