// src/modules/gestao_imobiliaria/application/use-cases/get-empreendimento-detail.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoPhotoRecord,
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import { ITipologiaRepository, TipologiaRecord } from '../../domain/repositories/tipologia-repository.interface';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';

export interface EmpreendimentoDetailOutput {
  empreendimento: EmpreendimentoRecord;
  tipologias: TipologiaRecord[];
  // Contagem REAL de Imovel cadastrados para este empreendimento -
  // deliberadamente separado de empreendimento.totalUnidades (Fatia 3c),
  // que e so o numero DECLARADO na ficha tecnica do PDF (pode nao bater com
  // o que ja foi de fato cadastrado via lote/planilha).
  unidadesCadastradas: number;
  // Fatia 5 - fotos de planta/area comum, ja ordenadas (order asc). O
  // frontend agrupa por categoria (ver EMPREENDIMENTO_PHOTO_CATEGORIAS).
  photos: EmpreendimentoPhotoRecord[];
}

@Injectable()
export class GetEmpreendimentoDetailUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('ITipologiaRepository')
    private readonly tipologiaRepository: ITipologiaRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    empreendimentoId: string;
  }): Promise<EmpreendimentoDetailOutput> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const [tipologias, unidades, photos] = await Promise.all([
      this.tipologiaRepository.findAllByEmpreendimento(input.tenantId, input.empreendimentoId),
      this.imovelRepository.findAllByTenant(input.tenantId, {
        empreendimentoId: input.empreendimentoId,
      }),
      this.empreendimentoRepository.findPhotosByEmpreendimento(input.empreendimentoId),
    ]);

    return { empreendimento, tipologias, unidadesCadastradas: unidades.length, photos };
  }
}
