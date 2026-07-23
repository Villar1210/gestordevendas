// src/modules/gestao_imobiliaria/application/use-cases/importar-ficha-tecnica-pdf.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IPdfReaderService } from '../../domain/services/pdf-reader.interface';
import {
  FichaTecnicaExtraidaIA,
  IAiConversationService,
} from '../../../../shared/domain/services/ai-conversation.interface';

interface ImportarFichaTecnicaPdfInput {
  tenantId: string;
  empreendimentoId: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

// So gera um PREVIEW (nao persiste nada) - o usuario revisa/edita o
// resultado no frontend antes de confirmar via ConfirmarFichaTecnicaUseCase.
@Injectable()
export class ImportarFichaTecnicaPdfUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IPdfReaderService') private readonly pdfReader: IPdfReaderService,
    @Inject('IAiConversationService')
    private readonly aiConversationService: IAiConversationService,
  ) {}

  async execute(input: ImportarFichaTecnicaPdfInput): Promise<FichaTecnicaExtraidaIA> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) {
      throw new NotFoundException('Empreendimento nao encontrado.');
    }

    const textoPdf = await this.pdfReader.extractText(input.file);
    if (!textoPdf.trim()) {
      throw new BadRequestException(
        'Nao foi possivel extrair nenhum texto deste PDF. Verifique se o arquivo nao e uma ' +
          'imagem escaneada sem camada de texto.',
      );
    }

    try {
      return await this.aiConversationService.extrairFichaTecnicaEmpreendimento(textoPdf);
    } catch (error) {
      // Nunca preencher a ficha tecnica com dados inventados - se a IA nao
      // devolveu um JSON valido, o erro precisa ficar claro para o usuario
      // tentar novamente (ver CLAUDE.md).
      throw new BadRequestException(
        `Nao foi possivel extrair a ficha tecnica deste PDF: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }.`,
      );
    }
  }
}
