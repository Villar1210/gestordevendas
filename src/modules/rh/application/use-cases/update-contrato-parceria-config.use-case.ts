// src/modules/rh/application/use-cases/update-contrato-parceria-config.use-case.ts
import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  ContratoParceriaConfigDados,
  IContratoParceriaConfigRepository,
} from '../../domain/repositories/contrato-parceria-config-repository.interface';
import { validarContratoParceriaConfig } from '../../domain/services/signatarios-contrato';

function limpar(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  return v ? v : null;
}

@Injectable()
export class UpdateContratoParceriaConfigUseCase {
  constructor(
    @Inject('IContratoParceriaConfigRepository')
    private readonly repository: IContratoParceriaConfigRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    requesterRole: string;
    dados: ContratoParceriaConfigDados;
  }): Promise<ContratoParceriaConfigDados> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode alterar as assinaturas do contrato.');
    }
    const d = input.dados;
    const dados: ContratoParceriaConfigDados = {
      assinaturaEmpresaAtiva: d.assinaturaEmpresaAtiva,
      representanteNome: limpar(d.representanteNome),
      representanteEmail: limpar(d.representanteEmail)?.toLowerCase() ?? null,
      representanteCargo: limpar(d.representanteCargo),
      quantidadeTestemunhas: d.quantidadeTestemunhas,
      testemunha1Nome: limpar(d.testemunha1Nome),
      testemunha1Email: limpar(d.testemunha1Email)?.toLowerCase() ?? null,
      testemunha2Nome: limpar(d.testemunha2Nome),
      testemunha2Email: limpar(d.testemunha2Email)?.toLowerCase() ?? null,
      bloquearAcessoAteAssinar: d.bloquearAcessoAteAssinar,
      lembretesAtivos: d.lembretesAtivos,
      lembreteDias: (d.lembreteDias ?? '2,5').replace(/\s+/g, ''),
    };
    const erro = validarContratoParceriaConfig(dados);
    if (erro) throw new BadRequestException(erro);
    return this.repository.upsert(input.tenantId, dados);
  }
}
