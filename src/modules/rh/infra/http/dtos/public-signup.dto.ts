// src/modules/rh/infra/http/dtos/public-signup.dto.ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const TIPOS_PERFIL = ['comprador', 'corretor_house', 'corretor_parceiro', 'imobiliaria_parceira'];
const TIPOS_CORRETOR = ['corretor_house', 'corretor_parceiro'];

export class PublicSignupDto {
  @IsIn(TIPOS_PERFIL, { message: `tipoPerfil invalido. Use um destes: ${TIPOS_PERFIL.join(', ')}.` })
  tipoPerfil!: string;

  @IsString()
  @MinLength(2, { message: 'Informe seu nome.' })
  name!: string;

  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  // Obrigatorio so para os dois perfis de corretor.
  @ValidateIf((dto) => TIPOS_CORRETOR.includes(dto.tipoPerfil))
  @IsString()
  @MinLength(1, { message: 'CRECI e obrigatorio para corretores.' })
  creci?: string;

  // Campos obrigatorios so para imobiliaria_parceira.
  @ValidateIf((dto) => dto.tipoPerfil === 'imobiliaria_parceira')
  @IsString()
  @MinLength(1, { message: 'Informe o nome da imobiliaria.' })
  nomeImobiliaria?: string;

  @ValidateIf((dto) => dto.tipoPerfil === 'imobiliaria_parceira')
  @IsString()
  @MinLength(1, { message: 'CNPJ e obrigatorio para imobiliarias parceiras.' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  creciJ?: string;

  @IsOptional()
  @IsString()
  cargoNaEmpresa?: string;

  // So relevante (e enviado) quando tipoPerfil = comprador (Cliente).
  @ValidateIf((dto) => dto.tipoPerfil === 'comprador')
  @IsIn(['comprador', 'proprietario', 'ambos'], {
    message: 'tipoCliente invalido. Use um destes: comprador, proprietario, ambos.',
  })
  tipoCliente?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  endereco?: string;
}
