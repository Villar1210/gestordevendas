// src/modules/bii/infra/providers/xlsx-inspetor.ts
import { Injectable } from '@nestjs/common';
import { IXlsxInspetor } from '../../application/use-cases/itbi-plataforma.use-cases';
import { inspecionarZip, temAssinaturaZip } from './xlsx-arquivo';

@Injectable()
export class XlsxInspetor implements IXlsxInspetor {
  temAssinaturaZip(caminho: string): Promise<boolean> {
    return temAssinaturaZip(caminho);
  }

  async inspecionar(caminho: string): Promise<void> {
    await inspecionarZip(caminho);
  }
}
