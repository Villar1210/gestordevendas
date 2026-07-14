// src/modules/rh/application/use-cases/list-cadastros-aprovados.use-case.ts
// Aba "Aprovados" da tela de Aprovacoes - rastreamento visivel do contrato
// de prestacao de servico gerado automaticamente na aprovacao (Fatia 1).
// So corretores/parceiros (roleName em ROLES_QUE_EXIGEM_CONTRATO) - nao
// lista Clientes, que nunca geram contrato.
import { Injectable, Inject } from '@nestjs/common';
import { ICadastroRepository } from '../../domain/repositories/cadastro-repository.interface';
import { ISignatureEnvelopeRepository } from '../../../edoc/domain/repositories/signature-envelope-repository.interface';
import { ROLES_QUE_EXIGEM_CONTRATO } from '../../domain/services/roles-com-contrato';

interface ListCadastrosAprovadosInput {
  tenantId: string;
}

export interface CadastroAprovadoComContrato {
  id: string;
  name: string;
  email: string;
  roleName: string;
  // "sem_contrato" nunca deveria acontecer (todo mundo nesta lista exige
  // contrato) exceto se a geracao falhou silenciosamente (ver try/catch em
  // AprovarCadastroUseCase) - vale a pena mostrar esse estado na UI em vez
  // de esconder o problema.
  statusContrato: 'sem_contrato' | 'aguardando_assinaturas' | 'concluido' | 'cancelado' | 'rascunho';
  envelopeId: string | null;
}

@Injectable()
export class ListCadastrosAprovadosUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('ISignatureEnvelopeRepository')
    private readonly signatureEnvelopeRepository: ISignatureEnvelopeRepository,
  ) {}

  async execute(input: ListCadastrosAprovadosInput): Promise<CadastroAprovadoComContrato[]> {
    const cadastros = await this.cadastroRepository.findAllAprovadosComContratoByTenant(
      input.tenantId,
      ROLES_QUE_EXIGEM_CONTRATO,
    );

    return Promise.all(
      cadastros.map(async (cadastro) => {
        if (!cadastro.contratoPrestacaoServicoEnvelopeId) {
          return {
            id: cadastro.id,
            name: cadastro.name,
            email: cadastro.email,
            roleName: cadastro.roleName,
            statusContrato: 'sem_contrato' as const,
            envelopeId: null,
          };
        }

        const envelope = await this.signatureEnvelopeRepository.findById(
          cadastro.contratoPrestacaoServicoEnvelopeId,
        );

        return {
          id: cadastro.id,
          name: cadastro.name,
          email: cadastro.email,
          roleName: cadastro.roleName,
          statusContrato: (envelope?.status ?? 'sem_contrato') as CadastroAprovadoComContrato['statusContrato'],
          envelopeId: cadastro.contratoPrestacaoServicoEnvelopeId,
        };
      }),
    );
  }
}
