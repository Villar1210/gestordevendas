// src/modules/edoc/application/use-cases/generate-signed-pdf.use-case.ts
// Chamado pelo SignDocumentUseCase logo apos o envelope ficar "concluido"
// (fora da transaction de banco - isso e I/O de arquivo, nao deve segurar
// lock de banco). Falha aqui NAO desfaz a assinatura ja registrada -
// so loga o erro (ver SignDocumentUseCase).
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createHash } from 'crypto';
import { ISignatureEnvelopeRepository } from '../../domain/repositories/signature-envelope-repository.interface';
import { ISignatureRecipientRepository } from '../../domain/repositories/signature-recipient-repository.interface';
import { ISignatureFieldRepository } from '../../domain/repositories/signature-field-repository.interface';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';

const PNG_DATA_URL_REGEX = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/;

interface GenerateSignedPdfInput {
  envelopeId: string;
}

@Injectable()
export class GenerateSignedPdfUseCase {
  constructor(
    @Inject('ISignatureEnvelopeRepository')
    private readonly envelopeRepository: ISignatureEnvelopeRepository,
    @Inject('ISignatureRecipientRepository')
    private readonly recipientRepository: ISignatureRecipientRepository,
    @Inject('ISignatureFieldRepository')
    private readonly fieldRepository: ISignatureFieldRepository,
    @Inject('IFileStorageService') private readonly fileStorageService: IFileStorageService,
  ) {}

  async execute(input: GenerateSignedPdfInput): Promise<void> {
    const envelope = await this.envelopeRepository.findById(input.envelopeId);
    if (!envelope) {
      throw new NotFoundException('Envelope nao encontrado.');
    }

    const [originalBytes, recipients, fields] = await Promise.all([
      this.fileStorageService.download(envelope.documentUrl),
      this.recipientRepository.findAllByEnvelope(envelope.id),
      this.fieldRepository.findAllByEnvelope(envelope.id),
    ]);

    const recipientsById = new Map(recipients.map((recipient) => [recipient.id, recipient]));

    const pdfDoc = await PDFDocument.load(originalBytes);
    const pages = pdfDoc.getPages();
    const signatureFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Fatia 3 (papeis + rubrica): itera por CAMPO, nao por destinatario -
    // um destinatario/remetente pode ter varios SignatureField (1 rubrica
    // por pagina + 1 assinatura na ultima pagina), e cada campo busca
    // recipient.signatureImageData de novo, de forma independente. Isso ja
    // aplica a MESMA imagem assinada em todas as posicoes marcadas do
    // mesmo participante sem nenhuma mudanca necessaria aqui - so precisa
    // que os campos certos (rubrica x N paginas + assinatura x 1) tenham
    // sido criados antes (ver CreateEnvelopeUseCase).
    for (const field of fields) {
      const recipient = recipientsById.get(field.recipientId);
      if (!recipient?.signatureImageData) continue; // nao deveria acontecer se o envelope esta concluido

      const page = pages[field.pageNumber - 1];
      if (!page) continue; // pagina invalida - protege contra dado inconsistente, nao trava a geracao inteira

      const { width: pageWidth, height: pageHeight } = page.getSize();
      const fieldWidth = field.widthPercent * pageWidth;
      const fieldHeight = field.heightPercent * pageHeight;
      const x = field.xPercent * pageWidth;
      // PDF usa origem no canto inferior-esquerdo; xPercent/yPercent usam
      // origem no canto superior-esquerdo (mesma convencao do CSS/canvas
      // usada no editor de posicionamento do frontend) - por isso inverte o eixo Y.
      const y = pageHeight - field.yPercent * pageHeight - fieldHeight;

      const dataUrlMatch = recipient.signatureImageData.match(PNG_DATA_URL_REGEX);
      if (dataUrlMatch) {
        const imageBytes = Buffer.from(dataUrlMatch[1], 'base64');
        const pngImage = await pdfDoc.embedPng(imageBytes);
        page.drawImage(pngImage, { x, y, width: fieldWidth, height: fieldHeight });
      } else {
        // Nome digitado (texto puro, sem imagem) - desenha como texto em
        // fonte italica, aproximando o visual de assinatura usado na tela.
        const fontSize = Math.min(fieldHeight * 0.6, 20);
        page.drawText(recipient.signatureImageData, {
          x,
          y: y + (fieldHeight - fontSize) / 2,
          size: fontSize,
          font: signatureFont,
          color: rgb(0.12, 0.16, 0.22),
        });
      }
    }

    const signedBytes = await pdfDoc.save();
    const { url } = await this.fileStorageService.upload({
      buffer: Buffer.from(signedBytes),
      originalname: `assinado-${createHash('sha256').update(envelope.id).digest('hex').slice(0, 8)}.pdf`,
      mimetype: 'application/pdf',
    });

    await this.envelopeRepository.updateSignedDocumentUrl(envelope.id, url);
  }
}
