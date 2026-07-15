// src/modules/vivi_sdr/application/use-cases/update-vivi-config.use-case.ts
// Aba "Configuracoes da VIVI" do Painel Administrativo - Administrador edita
// preco minimo e as 4 faixas de renda usadas tanto no prompt quanto na
// classificacao autoritativa (classificarRenda).
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IViviConfigRepository,
  ViviConfigRecord,
} from '../../domain/repositories/vivi-config-repository.interface';
import { GetOrCreateViviConfigUseCase } from './get-or-create-vivi-config.use-case';

interface UpdateViviConfigInput {
  tenantId: string;
  requesterRole: string;
  precoMinimo: number;
  limiteSemPerfil: number;
  limiteHis1: number;
  limiteHis2: number;
  limiteHmp: number;
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
    // classificarRenda() produziria resultados inconsistentes (ex: HIS1
    // maior que HIS2 faria toda renda cair sempre em HIS1).
    if (
      !(
        input.limiteSemPerfil < input.limiteHis1 &&
        input.limiteHis1 < input.limiteHis2 &&
        input.limiteHis2 < input.limiteHmp
      )
    ) {
      throw new BadRequestException(
        'As faixas de renda precisam ser crescentes: Sem Perfil < HIS1 < HIS2 < HMP.',
      );
    }
    if (input.precoMinimo <= 0) {
      throw new BadRequestException('O preco minimo precisa ser maior que zero.');
    }

    // Garante que existe uma linha para atualizar (mesmo padrao de
    // UpdateContratoTemplateUseCase).
    await this.getOrCreateViviConfigUseCase.execute({ tenantId: input.tenantId });

    return this.viviConfigRepository.update(input.tenantId, {
      precoMinimo: input.precoMinimo,
      limiteSemPerfil: input.limiteSemPerfil,
      limiteHis1: input.limiteHis1,
      limiteHis2: input.limiteHis2,
      limiteHmp: input.limiteHmp,
    });
  }
}
