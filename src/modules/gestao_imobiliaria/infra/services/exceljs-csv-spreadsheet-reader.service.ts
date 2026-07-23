// src/modules/gestao_imobiliaria/infra/services/exceljs-csv-spreadsheet-reader.service.ts
// Camada de INFRA: unico lugar do modulo que sabe que existe exceljs/csv-parse
// (mesmo padrao de LibreOfficeConverterService no modulo edoc). Decide o
// formato pela EXTENSAO do arquivo (mais confiavel que o mimetype enviado
// pelo navegador, que varia bastante entre browsers/SOs para CSV/XLSX).
import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { ISpreadsheetReaderService } from '../../domain/services/spreadsheet-reader.interface';

function celulaParaTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    // Formula: usa o resultado calculado, nao a formula em si.
    if ('result' in valor && valor.result !== undefined) {
      return celulaParaTexto(valor.result as ExcelJS.CellValue);
    }
    // Rich text: concatena os fragmentos.
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((fragmento) => fragmento.text).join('');
    }
    // Hyperlink: usa o texto exibido, nao a URL.
    if ('text' in valor) {
      return String((valor as { text: unknown }).text ?? '');
    }
    return '';
  }
  return String(valor);
}

@Injectable()
export class ExceljsCsvSpreadsheetReaderService implements ISpreadsheetReaderService {
  async read(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<Record<string, string>[]> {
    const nomeArquivo = file.originalname.toLowerCase();

    if (nomeArquivo.endsWith('.csv')) {
      return this.lerCsv(file.buffer);
    }
    if (nomeArquivo.endsWith('.xlsx') || nomeArquivo.endsWith('.xls')) {
      return this.lerXlsx(file.buffer);
    }
    throw new BadRequestException(
      'Formato de arquivo nao suportado. Envie um arquivo .csv ou .xlsx.',
    );
  }

  private lerCsv(buffer: Buffer): Record<string, string>[] {
    try {
      return parseCsvSync(buffer, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (error) {
      throw new BadRequestException(
        `Nao foi possivel ler o arquivo CSV: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
      );
    }
  }

  private async lerXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch (error) {
      throw new BadRequestException(
        `Nao foi possivel ler o arquivo XLSX: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
      );
    }

    const planilha = workbook.worksheets[0];
    if (!planilha) {
      throw new BadRequestException('O arquivo XLSX nao tem nenhuma planilha.');
    }

    const cabecalho: string[] = [];
    planilha.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      cabecalho[colNumber] = celulaParaTexto(cell.value).trim();
    });

    const linhas: Record<string, string>[] = [];
    planilha.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const objeto: Record<string, string> = {};
      let temAlgumValor = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const nomeColuna = cabecalho[colNumber];
        if (!nomeColuna) return;
        const texto = celulaParaTexto(cell.value).trim();
        if (texto) temAlgumValor = true;
        objeto[nomeColuna] = texto;
      });
      if (temAlgumValor) linhas.push(objeto);
    });

    return linhas;
  }
}
