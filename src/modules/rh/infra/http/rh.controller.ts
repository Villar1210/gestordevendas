// src/modules/rh/infra/http/rh.controller.ts
import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateCorretorDto } from './dtos/create-corretor.dto';
import { UpdateStatusDisponibilidadeDto } from './dtos/update-status-disponibilidade.dto';
import { PublicSignupDto } from './dtos/public-signup.dto';
import { AprovarCadastroDto } from './dtos/aprovar-cadastro.dto';
import { UpdateContratoTemplateDto } from './dtos/update-contrato-template.dto';
import { UpdateContratoParceriaConfigDto } from './dtos/update-contrato-parceria-config.dto';
import { UpdateUserCargoDto } from './dtos/update-user-cargo.dto';
import { UpdateEmailTemplateDto } from './dtos/update-email-template.dto';
import { CreateCorretorUseCase } from '../../application/use-cases/create-corretor.use-case';
import { ListCorretoresUseCase } from '../../application/use-cases/list-corretores.use-case';
import { UpdateStatusDisponibilidadeUseCase } from '../../application/use-cases/update-status-disponibilidade.use-case';
import { RegistrarAtividadeUseCase } from '../../application/use-cases/registrar-atividade.use-case';
import {
  PublicSignupUseCase,
  TipoPerfilCadastro,
} from '../../application/use-cases/public-signup.use-case';
import { ListCadastrosPendentesUseCase } from '../../application/use-cases/list-cadastros-pendentes.use-case';
import { AprovarCadastroUseCase } from '../../application/use-cases/aprovar-cadastro.use-case';
import { RejeitarCadastroUseCase } from '../../application/use-cases/rejeitar-cadastro.use-case';
import { ListPossiveisSuperioresUseCase } from '../../application/use-cases/list-possiveis-superiores.use-case';
import { ListCadastrosAprovadosUseCase } from '../../application/use-cases/list-cadastros-aprovados.use-case';
import { GetOrCreateContratoTemplateUseCase } from '../../application/use-cases/get-or-create-contrato-template.use-case';
import { UpdateContratoTemplateUseCase } from '../../application/use-cases/update-contrato-template.use-case';
import { GetContratoParceriaConfigUseCase } from '../../application/use-cases/get-contrato-parceria-config.use-case';
import { UpdateContratoParceriaConfigUseCase } from '../../application/use-cases/update-contrato-parceria-config.use-case';
import { ListUsuariosComHierarquiaUseCase } from '../../application/use-cases/list-usuarios-com-hierarquia.use-case';
import { UpdateUserCargoUseCase } from '../../application/use-cases/update-user-cargo.use-case';
import { ListEmailTemplatesUseCase } from '../../application/use-cases/list-email-templates.use-case';
import { UpdateEmailTemplateUseCase } from '../../application/use-cases/update-email-template.use-case';

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
    private readonly getOrCreateContratoTemplateUseCase: GetOrCreateContratoTemplateUseCase,
    private readonly updateContratoTemplateUseCase: UpdateContratoTemplateUseCase,
    private readonly getContratoParceriaConfigUseCase: GetContratoParceriaConfigUseCase,
    private readonly updateContratoParceriaConfigUseCase: UpdateContratoParceriaConfigUseCase,
    private readonly listUsuariosComHierarquiaUseCase: ListUsuariosComHierarquiaUseCase,
    private readonly updateUserCargoUseCase: UpdateUserCargoUseCase,
    private readonly listEmailTemplatesUseCase: ListEmailTemplatesUseCase,
    private readonly updateEmailTemplateUseCase: UpdateEmailTemplateUseCase,
    private readonly registrarAtividadeUseCase: RegistrarAtividadeUseCase,
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
      telefone: dto.telefone,
      whatsapp: dto.whatsapp,
      creci: dto.creci,
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

  // POST /rh/me/atividade - "sinal de vida" da Topbar (a cada 60s). Devolve o
  // status atual para o frontend perceber se foi derrubado por inatividade.
  @Post('me/atividade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...DASHBOARD_ROLES)
  async registrarAtividade(@Req() req: Request) {
    return this.registrarAtividadeUseCase.execute({
      userId: req.user!.id,
      tenantId: req.user!.tenantId,
    });
  }

  // POST /rh/cadastro-publico - rota PUBLICA (sem login): cria o cadastro
  // pendente de aprovacao para qualquer um dos 4 perfis.
  // Limite proprio (mais estrito que o global de 100/min): rota publica que
  // cria conta e dispara e-mail aos Administradores - evita enxurrada de
  // cadastros falsos/spam de e-mail.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
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

  // GET /rh/contrato-template - texto atual do template de contrato de
  // prestacao de servico do tenant (cria automaticamente o padrao na
  // primeira vez, so Administrador).
  @Get('contrato-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async getContratoTemplate(@Req() req: Request) {
    return this.getOrCreateContratoTemplateUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /rh/contrato-template - Administrador edita o texto do template
  // (usado nas proximas aprovacoes de cadastro).
  @Patch('contrato-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async updateContratoTemplate(@Body() dto: UpdateContratoTemplateDto, @Req() req: Request) {
    return this.updateContratoTemplateUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      nome: dto.nome,
      corpo: dto.corpo,
    });
  }

  // GET/PUT /rh/contrato-parceria-config - quem assina o contrato de
  // prestacao de servico alem do contratado e se o acesso espera a
  // assinatura (Painel de Configuracao -> "Assinaturas do Contrato").
  @Get('contrato-parceria-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async getContratoParceriaConfig(@Req() req: Request) {
    return this.getContratoParceriaConfigUseCase.execute(req.user!.tenantId);
  }

  @Put('contrato-parceria-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async updateContratoParceriaConfig(@Body() dto: UpdateContratoParceriaConfigDto, @Req() req: Request) {
    return this.updateContratoParceriaConfigUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      dados: {
        assinaturaEmpresaAtiva: dto.assinaturaEmpresaAtiva,
        representanteNome: dto.representanteNome ?? null,
        representanteEmail: dto.representanteEmail ?? null,
        representanteCargo: dto.representanteCargo ?? null,
        quantidadeTestemunhas: dto.quantidadeTestemunhas,
        testemunha1Nome: dto.testemunha1Nome ?? null,
        testemunha1Email: dto.testemunha1Email ?? null,
        testemunha2Nome: dto.testemunha2Nome ?? null,
        testemunha2Email: dto.testemunha2Email ?? null,
        bloquearAcessoAteAssinar: dto.bloquearAcessoAteAssinar,
        lembretesAtivos: dto.lembretesAtivos,
        lembreteDias: dto.lembreteDias ?? '2,5',
      },
    });
  }

  // GET /rh/usuarios-hierarquia - aba "Permissoes/Cargos" do Painel
  // Administrativo: usuarios com cargo/superior atuais (so Administrador).
  @Get('usuarios-hierarquia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async listUsuariosComHierarquia(@Req() req: Request) {
    return this.listUsuariosComHierarquiaUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // PATCH /rh/usuarios-hierarquia/:id - reatribui cargo/superior de um
  // usuario ja aprovado, a qualquer momento (so Administrador).
  @Patch('usuarios-hierarquia/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async updateUserCargo(
    @Param('id') id: string,
    @Body() dto: UpdateUserCargoDto,
    @Req() req: Request,
  ) {
    return this.updateUserCargoUseCase.execute({
      userId: id,
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      cargoHierarquico: dto.cargoHierarquico ?? null,
      superiorId: dto.superiorId ?? null,
      standId: dto.standId ?? null,
    });
  }

  // GET /rh/email-templates - aba "Templates de E-mail" do Painel
  // Administrativo: os 3 templates do fluxo de RH (so Administrador).
  @Get('email-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async listEmailTemplates(@Req() req: Request) {
    return this.listEmailTemplatesUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
    });
  }

  // PATCH /rh/email-templates/:tipo - Administrador edita um dos 3 templates.
  @Patch('email-templates/:tipo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  async updateEmailTemplate(
    @Param('tipo') tipo: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Req() req: Request,
  ) {
    return this.updateEmailTemplateUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      tipo,
      assunto: dto.assunto,
      corpo: dto.corpo,
    });
  }
}
