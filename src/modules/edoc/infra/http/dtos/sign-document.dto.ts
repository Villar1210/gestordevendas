// src/modules/edoc/infra/http/dtos/sign-document.dto.ts
import { IsString, MinLength } from 'class-validator';

export class SignDocumentDto {
  // Data URL PNG (canvas) OU o nome digitado (texto puro) - ver
  // SignDocumentUseCase.validateAndHashSignature.
  @IsString()
  @MinLength(1, { message: 'Assinatura obrigatoria.' })
  signatureImageData!: string;
}
