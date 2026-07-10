// src/modules/portal_cliente/infra/http/portal-cliente.controller.ts
// So JwtAuthGuard (SEM @Roles) - qualquer usuario autenticado pode chamar.
// Cada use case so retorna dados vinculados ao PROPRIO e-mail do usuario
// logado (resolvido aqui a partir do id do token, que nao carrega o
// e-mail), entao nao ha vazamento entre usuarios/tenants.
import { Controller, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { Inject } from '@nestjs/common';
import { GetMeusImoveisUseCase } from '../../application/use-cases/get-meus-imoveis.use-case';
import { GetMeuAtendimentoUseCase } from '../../application/use-cases/get-meu-atendimento.use-case';
import { GetMinhasAssinaturasPendentesUseCase } from '../../application/use-cases/get-minhas-assinaturas-pendentes.use-case';
import { GetMeusDocumentosAssinadosUseCase } from '../../application/use-cases/get-meus-documentos-assinados.use-case';

@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalClienteController {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly getMeusImoveisUseCase: GetMeusImoveisUseCase,
    private readonly getMeuAtendimentoUseCase: GetMeuAtendimentoUseCase,
    private readonly getMinhasAssinaturasPendentesUseCase: GetMinhasAssinaturasPendentesUseCase,
    private readonly getMeusDocumentosAssinadosUseCase: GetMeusDocumentosAssinadosUseCase,
  ) {}

  // O JWT so carrega id/tenantId/role (ver JwtStrategy) - o e-mail e
  // resolvido aqui, uma vez, a partir do proprio id do usuario autenticado.
  private async getEmailDoUsuarioLogado(req: Request): Promise<string> {
    const user = await this.userRepository.findById(req.user!.id);
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }
    return user.email;
  }

  // GET /portal/meus-imoveis
  @Get('meus-imoveis')
  async meusImoveis(@Req() req: Request) {
    const email = await this.getEmailDoUsuarioLogado(req);
    return this.getMeusImoveisUseCase.execute({ tenantId: req.user!.tenantId, email });
  }

  // GET /portal/meu-atendimento
  @Get('meu-atendimento')
  async meuAtendimento(@Req() req: Request) {
    const email = await this.getEmailDoUsuarioLogado(req);
    return this.getMeuAtendimentoUseCase.execute({ tenantId: req.user!.tenantId, email });
  }

  // GET /portal/assinaturas-pendentes
  @Get('assinaturas-pendentes')
  async assinaturasPendentes(@Req() req: Request) {
    const email = await this.getEmailDoUsuarioLogado(req);
    return this.getMinhasAssinaturasPendentesUseCase.execute({
      tenantId: req.user!.tenantId,
      email,
    });
  }

  // GET /portal/documentos-assinados
  @Get('documentos-assinados')
  async documentosAssinados(@Req() req: Request) {
    const email = await this.getEmailDoUsuarioLogado(req);
    return this.getMeusDocumentosAssinadosUseCase.execute({
      tenantId: req.user!.tenantId,
      email,
    });
  }
}
