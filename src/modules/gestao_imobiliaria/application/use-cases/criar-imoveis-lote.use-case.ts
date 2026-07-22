// src/modules/gestao_imobiliaria/application/use-cases/criar-imoveis-lote.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import {
  IImovelRepository,
  ImovelRecord,
  ImovelWritableFields,
} from '../../domain/repositories/imovel-repository.interface';

interface ImovelLoteItemInput extends ImovelWritableFields {
  title: string;
  tipo: string;
  finalidade: string;
}

interface CriarImoveisLoteInput {
  tenantId: string;
  empreendimentoId: string;
  imoveis: ImovelLoteItemInput[];
}

@Injectable()
export class CriarImoveisLoteUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: CriarImoveisLoteInput): Promise<ImovelRecord[]> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const identificadoresInformados = input.imoveis
      .map((imovel) => imovel.identificadorExterno)
      .filter((identificador): identificador is string => !!identificador);

    // Duplicado DENTRO do proprio payload (ex: o usuario editou 2 linhas do
    // grid e deixou o mesmo identificador nas duas) - falharia de qualquer
    // forma na transacao (constraint @@unique([tenantId, identificadorExterno])),
    // mas checar antes devolve uma mensagem clara em vez de um erro cru do
    // Postgres.
    const duplicadosNoPayload = identificadoresInformados.filter(
      (identificador, index) => identificadoresInformados.indexOf(identificador) !== index,
    );

    const duplicadosNoBanco = await this.imovelRepository.findExistingIdentificadoresExternos(
      input.tenantId,
      identificadoresInformados,
    );

    const identificadoresColidindo = Array.from(
      new Set([...duplicadosNoPayload, ...duplicadosNoBanco]),
    );

    if (identificadoresColidindo.length > 0) {
      throw new ConflictException({
        message: 'Ja existem imoveis com os identificadores informados. Nada foi salvo.',
        identificadoresColidindo,
      });
    }

    return this.imovelRepository.createMany(
      input.imoveis.map((imovel) => ({
        ...imovel,
        tenantId: input.tenantId,
        // Autoritativo pela URL, independente do que vier em cada item.
        empreendimentoId: input.empreendimentoId,
      })),
    );
  }
}
