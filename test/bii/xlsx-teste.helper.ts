// Helpers de TESTE: ZIP minimo (STORE + CRC32) e planilha sintetica do ITBI.
// Nao e usado em producao.
import { crc32, deflateRawSync } from 'zlib';
import * as ExcelJS from 'exceljs';

// deflate: grava comprimido (metodo 8). declararDescompactado: MENTE o
// tamanho descompactado no diretorio central e no cabecalho local (forja).
// lixoAntes: bytes soltos antes da 1a entrada (dado fora do diretorio).
export function zipMinimo(
  entradas: { nome: string; dados: Buffer; deflate?: boolean; declararDescompactado?: number }[],
  opcoes: { lixoAntes?: Buffer } = {},
): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  if (opcoes.lixoAntes) {
    locais.push(opcoes.lixoAntes);
    offset += opcoes.lixoAntes.length;
  }
  for (const original of entradas) {
    const dadosComp = original.deflate ? deflateRawSync(original.dados) : original.dados;
    const metodo = original.deflate ? 8 : 0;
    const desc = original.declararDescompactado ?? original.dados.length;
    const e = { nome: original.nome, dados: dadosComp };
    const nome = Buffer.from(e.nome);
    const crc = crc32(original.dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.dados.length, 18);
    local.writeUInt32LE(desc, 22);
    local.writeUInt16LE(nome.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(e.dados.length, 20);
    central.writeUInt32LE(desc, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(offset, 42);
    locais.push(local, nome, e.dados);
    centrais.push(central, nome);
    offset += 30 + nome.length + e.dados.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, dir, fim]);
}

export async function escreverPlanilha(caminho: string, abas: { nome: string; linhas: unknown[][] }[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome);
    for (const linha of aba.linhas) ws.addRow(linha as ExcelJS.CellValue[]);
  }
  await wb.xlsx.writeFile(caminho);
}

// Cabecalho real (28 colunas, ordem do arquivo da Prefeitura)
export const CABECALHO_REAL = [
  'N° do Cadastro (SQL)',
  'Nome do Logradouro',
  'Número',
  'Complemento',
  'Bairro',
  'Referência',
  'CEP',
  'Natureza de Transação',
  'Valor de Transação (declarado pelo contribuinte)',
  'Data de Transação',
  'Valor Venal de Referência',
  'Proporção Transmitida (%)',
  'Valor Venal de Referência (proporcional)',
  'Base de Cálculo adotada',
  'Tipo de Financiamento',
  'Valor Financiado',
  'Cartório de Registro',
  'Matrícula do Imóvel',
  'Situação do SQL',
  'Área do Terreno (m2)',
  'Testada (m)',
  'Fração Ideal',
  'Área Construída (m2)',
  'Uso (IPTU)',
  'Descrição do uso (IPTU)',
  'Padrão (IPTU)',
  'Descrição do padrão (IPTU)',
  'ACC (IPTU)',
];
