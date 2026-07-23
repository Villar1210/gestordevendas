// src/modules/gestao_imobiliaria/application/use-cases/confirmar-ficha-tecnica.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  EmpreendimentoRecord,
  IEmpreendimentoRepository,
} from '../../domain/repositories/empreendimento-repository.interface';
import {
  ITipologiaRepository,
  TipologiaRecord,
} from '../../domain/repositories/tipologia-repository.interface';

interface ConfirmarFichaTecnicaInput {
  tenantId: string;
  empreendimentoId: string;
  descricao?: string | null;
  areaTerreno?: number | null;
  totalUnidades?: number | null;
  numeroTorres?: number | null;
  unidadesPorAndar?: number | null;
  gabarito?: number | null;
  vagas?: number | null;
  itensLazer: string[];
  tipologias: { nome: string; areaPrivativa: number | null; dormitorios: number | null }[];
}

export interface ConfirmarFichaTecnicaOutput {
  empreendimento: EmpreendimentoRecord;
  tipologias: TipologiaRecord[];
}

// Persiste a ficha tecnica ja revisada/editada pelo usuario no preview
// (ver ImportarFichaTecnicaPdfUseCase). Marca origemImportacao="ia_pdf" e
// deliberadamente NAO mexe em publicado (continua false ate uma acao manual
// separada, fora do escopo desta fatia) nem em nome/endereco do
// Empreendimento (esses campos vieram no preview so para o usuario conferir
// visualmente que o PDF certo foi usado - a identidade do empreendimento ja
// cadastrado nao e alterada por este fluxo).
@Injectable()
export class ConfirmarFichaTecnicaUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('ITipologiaRepository')
    private readonly tipologiaRepository: ITipologiaRepository,
  ) {}

  async execute(input: ConfirmarFichaTecnicaInput): Promise<ConfirmarFichaTecnicaOutput> {
    const empreendimentoExistente = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimentoExistente) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const empreendimento = await this.empreendimentoRepository.updateFichaTecnica(
      input.empreendimentoId,
      {
        // '??' NAO seria correto aqui: descricao/areaTerreno etc podem vir
        // como null de proposito (usuario limpou o campo no preview antes
        // de confirmar) - so 'undefined' (campo ausente do input) deve ser
        // tratado como "nao mexer nesse campo" (ver updateFichaTecnica).
        description: input.descricao,
        areaTerreno: input.areaTerreno,
        totalUnidades: input.totalUnidades,
        numeroTorres: input.numeroTorres,
        unidadesPorAndar: input.unidadesPorAndar,
        gabarito: input.gabarito,
        vagas: input.vagas,
        itensLazer: input.itensLazer,
        origemImportacao: 'ia_pdf',
      },
    );

    const tipologias = await this.tipologiaRepository.replaceAllForEmpreendimento(
      input.tenantId,
      input.empreendimentoId,
      input.tipologias,
    );

    return { empreendimento, tipologias };
  }
}
