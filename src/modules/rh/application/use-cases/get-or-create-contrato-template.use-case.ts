// src/modules/rh/application/use-cases/get-or-create-contrato-template.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IContratoTemplateRepository,
  ContratoTemplateRecord,
} from '../../domain/repositories/contrato-template-repository.interface';
import {
  DEFAULT_CONTRATO_TEMPLATE_NOME,
  DEFAULT_CONTRATO_TEMPLATE_CORPO,
} from '../../domain/services/contrato-template-padrao';

interface GetOrCreateContratoTemplateInput {
  tenantId: string;
}

// Evita depender de setup manual: a primeira vez que um tenant precisa de
// um contrato de prestacao de servico e ainda nao tem nenhum
// ContratoTemplate "padrao", cria um automaticamente com o modelo generico
// de teste (ver domain/services/contrato-template-padrao.ts - nao e
// assessoria juridica, revisar com advogado antes de usar de verdade).
// Mesmo padrao ja usado para as filas padrao do modulo Atendimento
// (GetOrCreateAtendimentoUseCase.ensureDefaultFilas).
@Injectable()
export class GetOrCreateContratoTemplateUseCase {
  constructor(
    @Inject('IContratoTemplateRepository')
    private readonly contratoTemplateRepository: IContratoTemplateRepository,
  ) {}

  async execute(input: GetOrCreateContratoTemplateInput): Promise<ContratoTemplateRecord> {
    const existente = await this.contratoTemplateRepository.findPadraoByTenant(input.tenantId);
    if (existente) {
      return existente;
    }

    return this.contratoTemplateRepository.create({
      tenantId: input.tenantId,
      nome: DEFAULT_CONTRATO_TEMPLATE_NOME,
      corpo: DEFAULT_CONTRATO_TEMPLATE_CORPO,
    });
  }
}
