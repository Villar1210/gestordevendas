// src/modules/whatsappmarketing/infra/http/whatsapp.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateWhatsAppSessionDto } from './dtos/create-whatsapp-session.dto';
import { SendWhatsAppMessageDto } from './dtos/send-whatsapp-message.dto';
import { CreateWhatsAppSessionUseCase } from '../../application/use-cases/create-whatsapp-session.use-case';
import { SendWhatsAppMessageUseCase } from '../../application/use-cases/send-whatsapp-message.use-case';
import { DisconnectWhatsAppSessionUseCase } from '../../application/use-cases/disconnect-whatsapp-session.use-case';
import { GetWhatsAppQrCodeUseCase } from '../../application/use-cases/get-whatsapp-qr-code.use-case';
import { GetWhatsAppSessionStatusUseCase } from '../../application/use-cases/get-whatsapp-session-status.use-case';
import { GetMyWhatsAppSessionUseCase } from '../../application/use-cases/get-my-whatsapp-session.use-case';

@Controller('whatsapp/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class WhatsAppController {
  constructor(
    private readonly createWhatsAppSessionUseCase: CreateWhatsAppSessionUseCase,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
    private readonly disconnectWhatsAppSessionUseCase: DisconnectWhatsAppSessionUseCase,
    private readonly getWhatsAppQrCodeUseCase: GetWhatsAppQrCodeUseCase,
    private readonly getWhatsAppSessionStatusUseCase: GetWhatsAppSessionStatusUseCase,
    private readonly getMyWhatsAppSessionUseCase: GetMyWhatsAppSessionUseCase,
  ) {}

  // GET /whatsapp/sessions/me - sessao mais recente do tenant logado, ou null
  @Get('me')
  async getMine(@Req() req: Request) {
    return this.getMyWhatsAppSessionUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // POST /whatsapp/sessions - inicia uma nova conexao (gera QR Code para escanear)
  @Post()
  async create(@Body() dto: CreateWhatsAppSessionDto, @Req() req: Request) {
    return this.createWhatsAppSessionUseCase.execute({
      tenantId: req.user!.tenantId,
      ownerUserId: dto.ownerUserId,
      label: dto.label,
    });
  }

  // GET /whatsapp/sessions/:id/qr - retorna o QR Code atual (data URL) para escanear
  @Get(':id/qr')
  async getQrCode(@Param('id') id: string, @Req() req: Request) {
    return this.getWhatsAppQrCodeUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
    });
  }

  // GET /whatsapp/sessions/:id/status - consulta o status atual da sessao
  @Get(':id/status')
  async getStatus(@Param('id') id: string, @Req() req: Request) {
    return this.getWhatsAppSessionStatusUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
    });
  }

  // POST /whatsapp/sessions/:id/send - envia uma mensagem de texto pela sessao conectada
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('id') id: string,
    @Body() dto: SendWhatsAppMessageDto,
    @Req() req: Request,
  ) {
    await this.sendWhatsAppMessageUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
      to: dto.to,
      body: dto.body,
    });
    return { message: 'Mensagem enviada com sucesso.' };
  }

  // DELETE /whatsapp/sessions/:id - encerra a conexao (soft delete: preserva historico)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('id') id: string, @Req() req: Request) {
    await this.disconnectWhatsAppSessionUseCase.execute({
      sessionId: id,
      tenantId: req.user!.tenantId,
    });
    return { message: 'Sessao WhatsApp desconectada.' };
  }
}
