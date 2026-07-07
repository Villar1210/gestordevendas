// src/modules/gestao_imobiliaria/infra/http/empreendimento.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { CreateEmpreendimentoDto } from './dtos/create-empreendimento.dto';
import { CreateEmpreendimentoUseCase } from '../../application/use-cases/create-empreendimento.use-case';
import { ListEmpreendimentosUseCase } from '../../application/use-cases/list-empreendimentos.use-case';

@Controller('empreendimentos')
@UseGuards(JwtAuthGuard)
export class EmpreendimentoController {
  constructor(
    private readonly createEmpreendimentoUseCase: CreateEmpreendimentoUseCase,
    private readonly listEmpreendimentosUseCase: ListEmpreendimentosUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateEmpreendimentoDto, @Req() req: Request) {
    return this.createEmpreendimentoUseCase.execute({
      tenantId: req.user!.tenantId,
      name: dto.name,
      rua: dto.rua,
      numero: dto.numero,
      bairro: dto.bairro,
      cidade: dto.cidade,
      uf: dto.uf,
      cep: dto.cep,
      description: dto.description,
    });
  }

  @Get()
  async list(@Req() req: Request) {
    return this.listEmpreendimentosUseCase.execute({ tenantId: req.user!.tenantId });
  }
}
