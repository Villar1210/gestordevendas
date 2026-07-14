// src/modules/rh/infra/http/rh.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateCorretorDto } from './dtos/create-corretor.dto';
import { UpdateStatusDisponibilidadeDto } from './dtos/update-status-disponibilidade.dto';
import { PublicSignupDto } from './dtos/public-signup.dto';
import { AprovarCadastroDto } from './dtos/aprovar-cadastro.dto';
import { CreateCorretorUseCase } from '../../application/use-cases/create-corretor.use-case';
import { ListCorretoresUseCase } from '../../application/use-cases/list-corretores.use-case';
import { UpdateStatusDisponibilidadeUseCase } from '../../application/use-cases/update-status-disponibilidade.use-case';
import {
  PublicSignupUseCase,
  TipoPerfilCadastro,
} from '../../application/use-cases/public-signup.use-case';
import { ListCadastrosPendentesUseCase } from '../../application/use-cases/list-cadastros-pendentes.use-case';
import { AprovarCadastroUseCase } from '../../application/use-cases/aprovar-cadastro.use-case';
import { RejeitarCadastroUseCase } from '../../application/use-cases/rejeitar-cadastro.use-case';
import { ListPossiveisSuperioresUseCase } from '../../application/use-cases/list-possiveis-superiores.use-case';
import { ListCadastrosAprovadosUseCase } from '../../application/use-cases/list-cadastros-aprovados.use-case';

@Controller('rh')
export class RhController {
  constructor(
    private readonly createCorretorUseCase: CreateCorretorUseCase,
    private readonly listCorretoresUseCase: ListCorretoresUseCase,
    private readonly updateStatusDisponibilidadeUseCase: UpdateStatusDisponibilidadeUseCase,
    private readonly publicSignupUseCase: PublicSignupUseCase,
    private readonly listCadastrosPendentesUseCase: ListCadastrosPendentesUseCase,
    private readonly aprovarCadastroUseCase: AprovarCadastroUseCase,
    private readonly rejeitarCadastroUseCase: RejeitarCadastroUseCase,
    private readonly listPossiveisSuperioresUseCase: ListPossiveisSuperioresUseCase,
    private readonly listCadastrosAprovadosUseCase: ListCadastrosAprovadosUseCase,
  ) {}

  // POST /rh/corretores - cadastra um novo corretor (so Administrador)
  @Post('corretores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async createCorretor(@Body() dto: CreateCorretorDto, @Req() req: Request) {
    return this.createCorretorUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      name: dto.name,
      email: dto.email,
      password: dto.password,
    });
  }

  // GET /rh/corretores - lista os corretores do tenant autenticado
  @Get('corretores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...DASHBOARD_ROLES)
  async listCorretores(@Req() req: Request) {
    return this.listCorretoresUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /rh/me/status - o usuario logado atualiza o proprio status de disponibilidade
  @Patch('me/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...DASHBOARD_ROLES)
  async updateMyStatus(@Body() dto: UpdateStatusDisponibilidadeDto, @Req() req: Request) {
    await this.updateStatusDisponibilidadeUseCase.execute({
      userId: req.user!.id,
      tenantId: req.user!.tenantId,
      status: dto.status,
    });
    return { message: 'Status atualizado com sucesso.' };
  }

  // POST /rh/cadastro-publico - rota PUBLICA (sem login): cria o cadastro
  // pendente de aprovacao para qualquer um dos 4 perfis.
  @Post('cadastro-publico')
  async cadastroPublico(@Body() dto: PublicSignupDto) {
    return this.publicSignupUseCase.execute({
      tipoPerfil: dto.tipoPerfil as TipoPerfilCadastro,
      name: dto.name,
      email: dto.email,
      password: dto.password,
      telefone: dto.telefone,
      cpf: dto.cpf,
      creci: dto.creci,
      nomeImobiliaria: dto.nomeImobiliaria,
      cnpj: dto.cnpj,
      creciJ: dto.creciJ,
      cargoNaEmpresa: dto.cargoNaEmpresa,
      tipoCliente: dto.tipoCliente,
      cep: dto.cep,
      endereco: dto.endereco,
    });
  }

  // GET /rh/cadastros-pendentes - lista cadastros aguardando aprovacao (so Administrador)
  @Get('cadastros-pendentes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async listCadastrosPendentes(@Req() req: Request) {
    return this.listCadastrosPendentesUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // POST /rh/cadastros/:id/aprovar - aprova um cadastro pendente (so Administrador)
  @Post('cadastros/:id/aprovar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async aprovarCadastro(
    @Param('id') id: string,
    @Body() dto: AprovarCadastroDto,
    @Req() req: Request,
  ) {
    return this.aprovarCadastroUseCase.execute({
      cadastroId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      cargoHierarquico: dto.cargoHierarquico,
      superiorId: dto.superiorId,
    });
  }

  // POST /rh/cadastros/:id/rejeitar - rejeita um cadastro pendente (so Administrador)
  @Post('cadastros/:id/rejeitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async rejeitarCadastro(@Param('id') id: string, @Req() req: Request) {
    return this.rejeitarCadastroUseCase.execute({
      cadastroId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // GET /rh/possiveis-superiores - lista candidatos a "superior" na hierarquia (so Administrador)
  @Get('possiveis-superiores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async listPossiveisSuperiores(@Req() req: Request) {
    return this.listPossiveisSuperioresUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // GET /rh/cadastros-aprovados - corretores/parceiros ja aprovados, com
  // status do contrato de prestacao de servico (so Administrador) - aba
  // "Aprovados" da tela de Aprovacoes.
  @Get('cadastros-aprovados')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async listCadastrosAprovados(@Req() req: Request) {
    return this.listCadastrosAprovadosUseCase.execute({ tenantId: req.user!.tenantId });
  }
}
