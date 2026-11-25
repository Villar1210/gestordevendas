// src/modules/rh/application/use-cases/cadastro-equipe.use-cases.ts
// RH - cadastro completo da equipe interna (25/11/2026, desenho aprovado pelo
// Villar). A ficha e enviada pela tela inicial e chega ao RH como cadastro
// pendente; o Administrador confere, ve os dados bancarios (mascarados ate
// pedir, com registro de quem viu) e aprova com cargo e superior.
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface';
import { ehCargoEquipe, mascarar, REGRAS_CARGO } from '../../domain/services/cargos-equipe';
import { FichaCadastralRepository } from '../../infra/database/ficha-cadastral.repository';
import type { CadastroEquipeDto } from '../../infra/http/dtos/cadastro-equipe.dto';

// Papel (Role) de toda a equipe interna; o cargo de verdade e o
// cargoHierarquico, definido na aprovacao.
export const ROLE_EQUIPE = 'Corretor';
const DIAS_AVISO_CRECI = 30;

export type SituacaoCadastro = 'pendente' | 'aprovado' | 'rejeitado';

export function situacaoCreci(validade: Date | null, possui: boolean, agora = new Date()): 'sem_creci' | 'vencido' | 'vencendo' | 'ok' {
  if (!possui || !validade) return 'sem_creci';
  const dias = (validade.getTime() - agora.getTime()) / 86_400_000;
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_AVISO_CRECI) return 'vencendo';
  return 'ok';
}

@Injectable()
export class CadastroEquipeUseCases {
  constructor(
    private readonly fichas: FichaCadastralRepository,
    @Inject('IRoleRepository') private readonly roles: IRoleRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private tenantPublico(): string {
    const t = process.env.PUBLIC_SIGNUP_TENANT_ID;
    if (!t) throw new InternalServerErrorException('Cadastro ainda não está disponível. Tente novamente mais tarde.');
    return t;
  }

  // Publica: superiores que o candidato pode escolher para o cargo.
  async superioresParaCargo(cargo: string) {
    if (!ehCargoEquipe(cargo)) throw new BadRequestException('Cargo inválido.');
    const regra = REGRAS_CARGO[cargo];
    const lista = await this.fichas.superioresComCargo(this.tenantPublico(), regra.superioresPermitidos);
    return { pergunta: regra.perguntaSuperior, superiores: lista.map((u) => ({ id: u.id, nome: u.name })) };
  }

  async enviarFicha(d: CadastroEquipeDto) {
    const tenantId = this.tenantPublico();
    if (!ehCargoEquipe(d.cargo)) throw new BadRequestException('Cargo inválido.');
    const regra = REGRAS_CARGO[d.cargo];
    // 25/11/2026 (decisao do Villar): o superior so e obrigatorio quando ha
    // alguem com o cargo para escolher; sem ninguem, o RH define na aprovacao.
    if (d.superiorId) {
      if (!(await this.fichas.superiorValido(tenantId, d.superiorId, regra.superioresPermitidos))) {
        throw new BadRequestException('Escolha o seu superior na lista.');
      }
    } else if ((await this.fichas.superioresComCargo(tenantId, regra.superioresPermitidos)).length > 0) {
      throw new BadRequestException('Escolha o seu superior na lista.');
    }
    const email = d.email.toLowerCase();
    const duplicado = await this.fichas.emailOuCpfJaUsado(email, d.cpf);
    if (duplicado === 'email') throw new ConflictException('Já existe um cadastro com este e-mail.');
    if (duplicado === 'cpf') throw new ConflictException('Já existe um cadastro com este CPF.');

    let role = await this.roles.findByTenantAndName(tenantId, ROLE_EQUIPE);
    if (!role) role = await this.roles.create({ tenantId, name: ROLE_EQUIPE });

    const casado = d.estadoCivil === 'Casado(a)' || d.estadoCivil === 'União estável';
    const criado = await this.fichas.criarCadastroComFicha({
      tenantId,
      roleId: role.id,
      nome: d.nome,
      email,
      senhaHash: await bcrypt.hash(d.senha, 10),
      telefone: d.telefone,
      cpf: d.cpf,
      cargoNaEmpresa: d.cargo,
      ficha: {
        indicadoPor: d.indicadoPor,
        cargoPretendido: d.cargo,
        jaTrabalhouNoGrupo: d.jaTrabalhouNoGrupo,
        superiorIndicadoId: d.superiorId ?? null,
        rg: d.rg,
        rgUf: d.rgUf,
        nomeMae: d.nomeMae,
        nomePai: d.nomePai,
        dataNascimento: new Date(d.dataNascimento),
        paisNascimento: d.paisNascimento,
        estadoNascimento: d.estadoNascimento,
        cidadeNascimento: d.cidadeNascimento,
        estadoCivil: d.estadoCivil,
        nomeConjuge: casado ? (d.nomeConjuge ?? null) : null,
        quantidadeFilhos: d.quantidadeFilhos,
        rua: d.rua,
        numero: d.numero,
        bairro: d.bairro,
        cidade: d.cidade,
        cep: d.cep,
        escolaridade: d.escolaridade,
        possuiCreci: d.possuiCreci,
        creciTipo: d.possuiCreci ? (d.creciTipo ?? null) : null,
        creciNumero: d.possuiCreci ? (d.creciNumero ?? null) : null,
        creciValidade: d.possuiCreci && d.creciValidade ? new Date(d.creciValidade) : null,
        creciSupervisor: d.creciSupervisor || null,
        banco: d.banco,
        agencia: d.agencia,
        conta: d.conta,
        tipoConta: d.tipoConta,
        tipoPix: d.tipoPix,
        chavePix: d.chavePix,
        optaPj: d.optaPj,
        cnpj: d.optaPj ? (d.cnpj ?? null) : null,
        pjBanco: d.optaPj ? (d.pjBanco ?? null) : null,
        pjAgencia: d.optaPj ? (d.pjAgencia ?? null) : null,
        pjConta: d.optaPj ? (d.pjConta ?? null) : null,
        tamanhoCamisa: d.tamanhoCamisa,
        aceiteLgpdEm: new Date(),
      },
    });

    // Mesmo aviso do cadastro publico de hoje (e-mail/notificacao aos Administradores).
    this.eventEmitter.emit('cadastro.pendente.criado', { tenantId, cadastroId: criado.id, nome: d.nome, roleName: ROLE_EQUIPE });
    return { message: 'Cadastro recebido! Nossa equipe vai analisar e entrar em contato em breve.' };
  }

  // RH: lista por situacao, com contadores das abas.
  async listar(tenantId: string, situacao: SituacaoCadastro) {
    const [lista, contagem] = await Promise.all([this.fichas.listar(tenantId, situacao), this.fichas.contarPorSituacao(tenantId)]);
    const agora = new Date();
    return {
      contagem,
      cadastros: lista.map((u) => {
        const f = u.fichaCadastral!;
        return {
          id: u.id,
          nome: u.name,
          email: u.email,
          enviadoEm: u.createdAt,
          indicadoPor: f.indicadoPor,
          cargo: f.cargoPretendido,
          superior: f.superiorIndicado ? { id: f.superiorIndicado.id, nome: f.superiorIndicado.name, cargo: f.superiorIndicado.cargoHierarquico } : null,
          creci: { tipo: f.creciTipo, validade: f.creciValidade, situacao: situacaoCreci(f.creciValidade, f.possuiCreci, agora) },
          motivoRecusa: f.motivoRecusa,
        };
      }),
    };
  }

  // RH: ficha completa com o pagamento MASCARADO.
  async ficha(tenantId: string, userId: string) {
    const u = await this.fichas.fichaCompleta(tenantId, userId);
    if (!u?.fichaCadastral) throw new NotFoundException('Ficha não encontrada.');
    const f = u.fichaCadastral;
    const regra = ehCargoEquipe(f.cargoPretendido) ? REGRAS_CARGO[f.cargoPretendido] : null;
    const acessos = await this.fichas.ultimosAcessos(userId);
    return {
      id: u.id,
      nome: u.name,
      email: u.email,
      cpf: u.cpf,
      telefone: u.telefone,
      situacao: u.statusCadastro,
      enviadoEm: u.createdAt,
      indicacao: { indicadoPor: f.indicadoPor, cargo: f.cargoPretendido, jaTrabalhouNoGrupo: f.jaTrabalhouNoGrupo },
      superior: f.superiorIndicado ? { id: f.superiorIndicado.id, nome: f.superiorIndicado.name, cargo: f.superiorIndicado.cargoHierarquico } : null,
      aprovacaoSugerida: regra ? { cargoHierarquico: regra.cargoHierarquico, superioresPermitidos: regra.superioresPermitidos } : null,
      pessoais: {
        rg: f.rg,
        rgUf: f.rgUf,
        dataNascimento: f.dataNascimento,
        paisNascimento: f.paisNascimento,
        estadoNascimento: f.estadoNascimento,
        cidadeNascimento: f.cidadeNascimento,
        estadoCivil: f.estadoCivil,
        nomeConjuge: f.nomeConjuge,
        quantidadeFilhos: f.quantidadeFilhos,
        nomeMae: f.nomeMae,
        nomePai: f.nomePai,
      },
      endereco: { rua: f.rua, numero: f.numero, bairro: f.bairro, cidade: f.cidade, cep: f.cep },
      escolaridade: f.escolaridade,
      tamanhoCamisa: f.tamanhoCamisa,
      creci: {
        possui: f.possuiCreci,
        tipo: f.creciTipo,
        numero: f.creciNumero,
        validade: f.creciValidade,
        supervisor: f.creciSupervisor,
        situacao: situacaoCreci(f.creciValidade, f.possuiCreci),
      },
      pagamento: {
        banco: f.banco,
        agencia: mascarar(f.agencia, 2),
        conta: mascarar(f.conta, 4),
        tipoConta: f.tipoConta,
        tipoPix: f.tipoPix,
        chavePix: mascarar(f.chavePix, 5),
        optaPj: f.optaPj,
        cnpj: mascarar(f.cnpj, 4),
        pjBanco: f.pjBanco,
        pjAgencia: mascarar(f.pjAgencia, 2),
        pjConta: mascarar(f.pjConta, 4),
        mascarado: true,
      },
      aceiteLgpdEm: f.aceiteLgpdEm,
      motivoRecusa: f.motivoRecusa,
      acessosAosDadosBancarios: acessos.map((a) => ({ quem: a.leitor.name, em: a.em })),
    };
  }

  // RH: pagamento completo - fica registrado quem viu e quando.
  async revelarPagamento(tenantId: string, userId: string, leitorId: string) {
    const u = await this.fichas.fichaCompleta(tenantId, userId);
    if (!u?.fichaCadastral) throw new NotFoundException('Ficha não encontrada.');
    await this.fichas.registrarAcessoSensivel(userId, leitorId);
    const f = u.fichaCadastral;
    return {
      banco: f.banco,
      agencia: f.agencia,
      conta: f.conta,
      tipoConta: f.tipoConta,
      tipoPix: f.tipoPix,
      chavePix: f.chavePix,
      optaPj: f.optaPj,
      cnpj: f.cnpj,
      pjBanco: f.pjBanco,
      pjAgencia: f.pjAgencia,
      pjConta: f.pjConta,
      mascarado: false,
    };
  }

  async registrarMotivoRecusa(userId: string, motivo?: string) {
    if (motivo?.trim()) await this.fichas.registrarMotivoRecusa(userId, motivo.trim());
  }
}
