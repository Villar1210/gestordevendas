// src/modules/configuracoes/application/use-cases/update-tenant-config.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  ITenantConfigRepository,
  TenantConfigRecord,
  UpdateTenantConfigInput,
} from '../../domain/repositories/tenant-config-repository.interface';

interface UpdateTenantConfigUseCaseInput extends UpdateTenantConfigInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class UpdateTenantConfigUseCase {
  constructor(
    @Inject('ITenantConfigRepository')
    private readonly tenantConfigRepository: ITenantConfigRepository,
  ) {}

  async execute(input: UpdateTenantConfigUseCaseInput): Promise<TenantConfigRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar os dados da empresa.');
    }

    if (input.limiteMensagensViviDia !== undefined && input.limiteMensagensViviDia <= 0) {
      throw new BadRequestException('O limite diario de mensagens da VIVI precisa ser maior que zero.');
    }

    // PAUSAR existe no enum (ver Tenant.acaoLimiteVivi/AcaoLimiteVivi em
    // schema.prisma) so para nao exigir uma migration nova quando o
    // bloqueio automatico for implementado no futuro - hoje NENHUMA logica
    // de bloqueio existe ainda (RegistrarUsoViviUseCase so alerta), entao a
    // escrita desse valor e rejeitada aqui com uma mensagem clara, em vez
    // de aceitar silenciosamente uma configuracao que ainda nao faz nada.
    if (input.acaoLimiteVivi === 'PAUSAR') {
      throw new BadRequestException(
        'A acao "PAUSAR" para o limite diario da VIVI ainda nao foi implementada - use "ALERTAR".',
      );
    }

    return this.tenantConfigRepository.update(input.tenantId, {
      name: input.name,
      cnpj: input.cnpj,
      endereco: input.endereco,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      limiteMensagensViviDia: input.limiteMensagensViviDia,
      acaoLimiteVivi: input.acaoLimiteVivi,
    });
  }
}
