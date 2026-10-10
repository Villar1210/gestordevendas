// src/modules/pdf_tools/application/use-cases/get-capabilities.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { IToolAvailability, PdfToolsCapabilities } from '../../domain/services/tool-availability.interface';

@Injectable()
export class GetCapabilitiesUseCase {
  constructor(@Inject('IToolAvailability') private readonly availability: IToolAvailability) {}

  execute(): Promise<PdfToolsCapabilities> {
    return this.availability.getCapabilities();
  }
}
