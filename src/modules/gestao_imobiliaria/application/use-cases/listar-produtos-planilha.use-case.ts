// src/modules/gestao_imobiliaria/application/use-cases/listar-produtos-planilha.use-case.ts
// Fatia 3b: passo 1 do fluxo de importacao no frontend - o usuario escolhe
// o arquivo antes de saber qual valor da coluna PRODUTO filtrar, entao esse
// use case so le o arquivo e devolve os valores distintos encontrados, sem
// rodar o parser linha a linha (isso fica para ImportarPlanilhaImoveisUseCase,
// so depois que o usuario escolhe o produto).
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { ISpreadsheetReaderService } from '../../domain/services/spreadsheet-reader.interface';
import { extrairProdutosDistintos, mapearCabecalho } from '../../domain/services/parse-planilha-imoveis';

interface ListarProdutosPlanilhaInput {
  tenantId: string;
  empreendimentoId: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

export interface ListarProdutosPlanilhaOutput {
  produtos: string[];
}

@Injectable()
export class ListarProdutosPlanilhaUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('ISpreadsheetReaderService')
    private readonly spreadsheetReader: ISpreadsheetReaderService,
  ) {}

  async execute(input: ListarProdutosPlanilhaInput): Promise<ListarProdutosPlanilhaOutput> {
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
    if (!mapeamento.produto) {
      throw new BadRequestException('A planilha precisa ter a coluna PRODUTO.');
    }

    return { produtos: extrairProdutosDistintos(linhasBrutas, mapeamento) };
  }
}
