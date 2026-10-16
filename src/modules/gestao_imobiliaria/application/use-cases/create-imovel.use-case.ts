// src/modules/gestao_imobiliaria/application/use-cases/create-imovel.use-case.ts
// Permissoes (R2): qualquer perfil do dashboard cadastra imovel, mas para
// quem nao e Administrador o servidor FORCA status=disponivel e
// publicado=false (o que o corretor mandar nesses campos e ignorado). Grava
// sempre criadoPorUserId (dono do cadastro - ver permissao-imovel.ts).
// Revisao de seguranca: nao-admin cadastra so imovel AVULSO (empreendimentoId
// null, tipoItem "unidade", sem codigoInterno) - vincular a empreendimento e
// codigo de unidade sao da administracao.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  IImovelRepository,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';
import { AtorImovel, ehAdministrador } from '../../domain/services/permissao-imovel';

interface CreateImovelInput extends ImovelWritableFields {
  tenantId: string;
  title: string;
  tipo: string;
  finalidade: string;
  ator: AtorImovel;
}

@Injectable()
export class CreateImovelUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: CreateImovelInput): Promise<ImovelRecord> {
    const { ator, ...dados } = input;
    const restricoes = ehAdministrador(ator.role)
      ? {}
      : {
          status: 'disponivel',
          publicado: false,
          empreendimentoId: null,
          tipoItem: 'unidade',
          codigoInterno: null,
        };
    Object.assign(dados, restricoes);

    if (dados.empreendimentoId) {
      const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
        dados.empreendimentoId,
        dados.tenantId,
      );
      if (!empreendimento) {
        throw new NotFoundException('Empreendimento nao encontrado.');
      }
    }

    return this.imovelRepository.create({
      ...dados,
      criadoPorUserId: ator.userId,
    });
  }
}
