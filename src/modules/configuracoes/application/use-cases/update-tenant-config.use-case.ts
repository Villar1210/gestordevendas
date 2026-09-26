// src/modules/configuracoes/application/use-cases/update-tenant-config.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  ITenantConfigRepository,
  TenantConfigRecord,
  UpdateTenantConfigInput,
} from '../../domain/repositories/tenant-config-repository.interface';

// Formatos aceitos para o site imobiliario publico.
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;
const DOMINIO_REGEX = /^(?=.{4,255}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const DOMINIOS_RESERVADOS = ['ivillar.com.br', 'gestordevendas.ivillar.com.br'];

// "https://WWW.Exemplo.com.br/" -> "exemplo.com.br"; "" -> null
function normalizarDominio(valor: string): string | null {
  const d = valor.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split('/')[0].split(':')[0].replace(/^www\./, '');
  return d === '' ? null : d;
}

interface UpdateTenantConfigUseCaseInput extends Omit<UpdateTenantConfigInput, 'slug' | 'dominio'> {
  siteSlug?: string;
  siteDominio?: string;
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

    let slug: string | null | undefined;
    if (input.siteSlug !== undefined) {
      slug = input.siteSlug.trim().toLowerCase() || null;
      if (slug !== null && !SLUG_REGEX.test(slug)) {
        throw new BadRequestException(
          'Endereço do site inválido: use de 2 a 60 letras minúsculas, números ou hífen, sem hífen no início ou no fim.',
        );
      }
    }

    let dominio: string | null | undefined;
    if (input.siteDominio !== undefined) {
      dominio = normalizarDominio(input.siteDominio);
      if (dominio !== null && !DOMINIO_REGEX.test(dominio)) {
        throw new BadRequestException('Domínio inválido. Exemplo: imoveis.suaempresa.com.br');
      }
      if (dominio !== null && DOMINIOS_RESERVADOS.some((r) => dominio === r || dominio!.endsWith(`.${r}`))) {
        throw new BadRequestException('Este domínio pertence à plataforma e não pode ser usado.');
      }
    }

    return this.tenantConfigRepository.update(input.tenantId, {
      slug,
      dominio,
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
