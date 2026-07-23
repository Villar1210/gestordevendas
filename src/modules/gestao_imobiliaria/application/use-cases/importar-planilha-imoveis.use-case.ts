// src/modules/gestao_imobiliaria/application/use-cases/importar-planilha-imoveis.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';
import { ISpreadsheetReaderService } from '../../domain/services/spreadsheet-reader.interface';
import {
  LinhaPlanilhaErro,
  converterLinhaBruta,
  mapearCabecalho,
  parseLinhaPlanilha,
} from '../../domain/services/parse-planilha-imoveis';
import { UnidadeGeradaComAviso } from './gerar-lote-imoveis.use-case';

interface ImportarPlanilhaImoveisInput {
  tenantId: string;
  empreendimentoId: string;
  produto: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

export interface ImportarPlanilhaImoveisOutput {
  unidades: UnidadeGeradaComAviso[];
  identificadoresDuplicados: string[];
  erros: LinhaPlanilhaErro[];
}

@Injectable()
export class ImportarPlanilhaImoveisUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
    @Inject('ISpreadsheetReaderService')
    private readonly spreadsheetReader: ISpreadsheetReaderService,
  ) {}

  async execute(input: ImportarPlanilhaImoveisInput): Promise<ImportarPlanilhaImoveisOutput> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const linhasBrutas = await this.spreadsheetReader.read(input.file);
    if (linhasBrutas.length === 0) {
      throw new BadRequestException('A planilha esta vazia ou nao tem linhas de dados.');
    }

    const mapeamento = mapearCabecalho(Object.keys(linhasBrutas[0]));
    if (!mapeamento.produto || !mapeamento.identificador) {
      throw new BadRequestException(
        'A planilha precisa ter as colunas PRODUTO e IDENTIFICADOR.',
      );
    }

    const unidades: UnidadeGeradaComAviso[] = [];
    const erros: LinhaPlanilhaErro[] = [];

    linhasBrutas.forEach((row, index) => {
      // +1 pelo cabecalho (linha 1) + 1 porque index e 0-based -> a 1a linha
      // de dados e a linha 2 do arquivo original.
      const numeroLinha = index + 2;
      const linhaBruta = converterLinhaBruta(row, mapeamento, numeroLinha);
      const resultado = parseLinhaPlanilha(linhaBruta, input.produto);

      if (resultado.tipo === 'erro') {
        erros.push(resultado.erro);
      } else if (resultado.tipo === 'unidade') {
        unidades.push({ ...resultado.unidade, identificadorJaExiste: false });
      }
      // 'ignorada' (outro produto) -> descartada silenciosamente, de proposito.
    });

    const identificadores = unidades.map((unidade) => unidade.identificadorExterno);
    const identificadoresDuplicados = await this.imovelRepository.findExistingIdentificadoresExternos(
      input.tenantId,
      identificadores,
    );
    const duplicadosSet = new Set(identificadoresDuplicados);
    for (const unidade of unidades) {
      unidade.identificadorJaExiste = duplicadosSet.has(unidade.identificadorExterno);
    }

    return { unidades, identificadoresDuplicados, erros };
  }
}
