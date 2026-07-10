// src/modules/edoc/infra/http/sign-public.controller.ts
// Controller PUBLICO (sem JwtAuthGuard/RolesGuard) - o token do link e a
// propria fronteira de seguranca. Ver GetEnvelopeByTokenUseCase e
// SignDocumentUseCase.
import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { SignDocumentDto } from './dtos/sign-document.dto';
import { GetEnvelopeByTokenUseCase } from '../../application/use-cases/get-envelope-by-token.use-case';
import { SignDocumentUseCase } from '../../application/use-cases/sign-document.use-case';

@Controller('edoc/sign')
export class SignPublicController {
  constructor(
    private readonly getEnvelopeByTokenUseCase: GetEnvelopeByTokenUseCase,
    private readonly signDocumentUseCase: SignDocumentUseCase,
  ) {}

  // GET /edoc/sign/:token - dados do documento para a tela de assinatura
  @Get(':token')
  async getByToken(@Param('token') token: string) {
    return this.getEnvelopeByTokenUseCase.execute({ token });
  }

  // POST /edoc/sign/:token - efetiva a assinatura
  @Post(':token')
  async sign(@Param('token') token: string, @Body() dto: SignDocumentDto, @Req() req: Request) {
    return this.signDocumentUseCase.execute({
      token,
      signatureImageData: dto.signatureImageData,
      signerIp: req.ip ?? null,
      signerUserAgent: req.headers['user-agent'] ?? null,
    });
  }
}
