// src/modules/gestao_imobiliaria/application/use-cases/update-imovel.use-case.ts
// Permissoes (R2): Administrador edita tudo. Os demais so editam o cadastro
// de imovel que ELES criaram e enquanto nao publicado, e nunca mudam status
// (vai pelo PATCH /imoveis/:id/status, R1) nem publicado. Mandar o MESMO
// valor atual de status/publicado e aceito (o formulario reenvia tudo) e
// simplesmente ignorado. Idem empreendimentoId/tipoItem/codigoInterno
// (vinculo com empreendimento e da administracao). A escrita de nao-admin e
// CONDICIONAL no banco (ainda dono e nao publicado no instante da escrita).
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  IImovelRepository,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';
import {
  AtorImovel,
  MENSAGENS_PERMISSAO_IMOVEL,
  ehAdministrador,
} from '../../domain/services/permissao-imovel';
import {
  comBloqueioDeCorrida,
  condicaoDonoPara,
  garantirPodeEditarCadastro,
} from './permissao-imovel.helper';

interface UpdateImovelInput extends ImovelWritableFields {
  imovelId: string;
  tenantId: string;
  ator: AtorImovel;
}

@Injectable()
export class UpdateImovelUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: UpdateImovelInput): Promise<ImovelRecord> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    const { imovelId, tenantId, ator, ...writableFields } = input;

    if (!ehAdministrador(ator.role)) {
      garantirPodeEditarCadastro(ator, imovel);
      if (writableFields.status !== undefined && writableFields.status !== imovel.status) {
        throw new ForbiddenException(MENSAGENS_PERMISSAO_IMOVEL.statusPeloSeletor);
      }
      if (writableFields.publicado !== undefined && writableFields.publicado !== imovel.publicado) {
        throw new ForbiddenException(MENSAGENS_PERMISSAO_IMOVEL.publicadoSomenteAdmin);
      }
      for (const campo of ['empreendimentoId', 'tipoItem', 'codigoInterno'] as const) {
        const valor = writableFields[campo];
        if (valor !== undefined && (valor ?? null) !== (imovel[campo] ?? null)) {
          throw new ForbiddenException(MENSAGENS_PERMISSAO_IMOVEL.vinculoSomenteAdmin);
        }
      }
      delete writableFields.status;
      delete writableFields.publicado;
      delete writableFields.empreendimentoId;
      delete writableFields.tipoItem;
      delete writableFields.codigoInterno;
    }

    if (writableFields.empreendimentoId) {
      const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
        writableFields.empreendimentoId,
        tenantId,
      );
      if (!empreendimento) {
        throw new NotFoundException('Empreendimento nao encontrado.');
      }
    }

    return comBloqueioDeCorrida(
      this.imovelRepository.update(imovel.id, writableFields, condicaoDonoPara(ator, tenantId)),
      ator,
      () => this.imovelRepository.findByIdAndTenant(imovel.id, tenantId),
    );
  }
}
