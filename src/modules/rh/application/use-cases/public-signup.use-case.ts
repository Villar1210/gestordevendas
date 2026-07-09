// src/modules/rh/application/use-cases/public-signup.use-case.ts
import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ICadastroRepository } from '../../domain/repositories/cadastro-repository.interface';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface';

export type TipoPerfilCadastro =
  | 'comprador'
  | 'corretor_house'
  | 'corretor_parceiro'
  | 'imobiliaria_parceira';

// Nome do Role criado/reaproveitado por tipo de perfil. "corretor_house"
// reaproveita o mesmo Role "Corretor" ja usado pelo cadastro de corretor
// feito pelo Administrador (fatia minima do RH) - de proposito, para um
// corretor da House aprovado aparecer no Kanban com as mesmas regras de
// visibilidade de qualquer outro Corretor.
const ROLE_NAME_BY_PERFIL: Record<TipoPerfilCadastro, string> = {
  comprador: 'Cliente',
  corretor_house: 'Corretor',
  corretor_parceiro: 'Corretor Parceiro',
  imobiliaria_parceira: 'Imobiliaria Parceira',
};

interface PublicSignupInput {
  tipoPerfil: TipoPerfilCadastro;
  name: string;
  email: string;
  password: string;
  telefone?: string;
  cpf?: string;
  creci?: string;
  nomeImobiliaria?: string;
  cnpj?: string;
  creciJ?: string;
  cargoNaEmpresa?: string;
  tipoCliente?: string;
  cep?: string;
  endereco?: string;
}

@Injectable()
export class PublicSignupUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IRoleRepository') private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(input: PublicSignupInput): Promise<{ message: string }> {
    const tenantId = process.env.PUBLIC_SIGNUP_TENANT_ID;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'Cadastro publico ainda nao esta configurado. Tente novamente mais tarde.',
      );
    }

    const roleName = ROLE_NAME_BY_PERFIL[input.tipoPerfil];
    if (!roleName) {
      throw new BadRequestException('Tipo de perfil invalido.');
    }

    const existing = await this.cadastroRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Ja existe um cadastro com este e-mail.');
    }

    let role = await this.roleRepository.findByTenantAndName(tenantId, roleName);
    if (!role) {
      role = await this.roleRepository.create({ tenantId, name: roleName });
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    await this.cadastroRepository.create({
      tenantId,
      roleId: role.id,
      name: input.name,
      email: input.email,
      hashedPassword,
      telefone: input.telefone,
      cpf: input.cpf,
      creci: input.creci,
      nomeImobiliaria: input.nomeImobiliaria,
      cnpj: input.cnpj,
      creciJ: input.creciJ,
      cargoNaEmpresa: input.cargoNaEmpresa,
      tipoCliente: input.tipoCliente,
      cep: input.cep,
      endereco: input.endereco,
    });

    return {
      message: 'Cadastro recebido! Nossa equipe vai analisar e entrar em contato em breve.',
    };
  }
}
