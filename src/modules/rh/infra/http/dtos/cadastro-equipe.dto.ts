// RH - ficha completa da equipe interna (25/11/2026). Mesmos campos da ficha
// de referencia aprovada pelo Villar (ver doc claude/rh-cadastro-equipe.md).
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CARGOS_EQUIPE } from '../../../domain/services/cargos-equipe';

const apara = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const soDigitos = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value);

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'];
export const QTD_FILHOS = ['Nenhum', '1', '2', '3', '4', '5', '5 ou mais'];
export const ESCOLARIDADES = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Técnico',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-graduação / Especialização',
  'Mestrado / Doutorado',
];
export const TIPOS_PIX = ['CPF', 'CNPJ', 'E-mail', 'Celular', 'Aleatória'];
export const CAMISAS = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export class CadastroEquipeDto {
  // Indicacao e cargo
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(150) indicadoPor!: string;
  @IsIn(CARGOS_EQUIPE as unknown as string[]) cargo!: string;
  @IsBoolean() jaTrabalhouNoGrupo!: boolean;
  @IsUUID() superiorId!: string;

  // Pessoais
  @Transform(apara) @IsString() @MinLength(5) @MaxLength(150) nome!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(30) rg!: string;
  @IsIn(UFS) rgUf!: string;
  @Transform(soDigitos) @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 números.' }) cpf!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(150) nomeMae!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(150) nomePai!: string;
  @IsDateString() dataNascimento!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(60) paisNascimento!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(40) estadoNascimento!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(80) cidadeNascimento!: string;
  @IsIn(ESTADOS_CIVIS) estadoCivil!: string;
  @ValidateIf((o: CadastroEquipeDto) => o.estadoCivil === 'Casado(a)' || o.estadoCivil === 'União estável')
  @Transform(apara)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nomeConjuge?: string;
  @IsIn(QTD_FILHOS) quantidadeFilhos!: string;
  @Transform(apara) @IsEmail() @MaxLength(150) email!: string;
  @Transform(soDigitos) @Matches(/^\d{10,11}$/, { message: 'Telefone com DDD inválido.' }) telefone!: string;

  // Endereco
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(150) rua!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(20) numero!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(80) bairro!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(80) cidade!: string;
  @Transform(soDigitos) @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 números.' }) cep!: string;

  // Escolaridade e CRECI
  @IsIn(ESCOLARIDADES) escolaridade!: string;
  @IsBoolean() possuiCreci!: boolean;
  @ValidateIf((o: CadastroEquipeDto) => o.possuiCreci) @IsIn(['Estágio', 'Definitivo']) creciTipo?: string;
  @ValidateIf((o: CadastroEquipeDto) => o.possuiCreci) @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(30) creciNumero?: string;
  @ValidateIf((o: CadastroEquipeDto) => o.possuiCreci) @IsDateString() creciValidade?: string;
  @IsOptional() @Transform(apara) @IsString() @MaxLength(150) creciSupervisor?: string;

  // Pagamento
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(60) banco!: string;
  @Transform(apara) @Matches(/^[\d-]{1,10}$/, { message: 'Agência inválida.' }) agencia!: string;
  @Transform(apara) @Matches(/^[\dXx-]{2,20}$/, { message: 'Conta inválida (ex.: 00000-0).' }) conta!: string;
  @IsIn(['Corrente', 'Poupança']) tipoConta!: string;
  @IsIn(TIPOS_PIX) tipoPix!: string;
  @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(80) chavePix!: string;
  @IsBoolean() optaPj!: boolean;
  @ValidateIf((o: CadastroEquipeDto) => o.optaPj) @Transform(soDigitos) @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 números.' }) cnpj?: string;
  @ValidateIf((o: CadastroEquipeDto) => o.optaPj) @Transform(apara) @IsString() @IsNotEmpty() @MaxLength(60) pjBanco?: string;
  @ValidateIf((o: CadastroEquipeDto) => o.optaPj) @Transform(apara) @Matches(/^[\d-]{1,10}$/) pjAgencia?: string;
  @ValidateIf((o: CadastroEquipeDto) => o.optaPj) @Transform(apara) @Matches(/^[\dXx-]{2,20}$/) pjConta?: string;

  // Final
  @IsIn(CAMISAS) tamanhoCamisa!: string;
  @IsString() @Length(8, 72) senha!: string;
  @Equals(true, { message: 'É preciso aceitar o uso dos dados (LGPD).' }) aceiteLgpd!: boolean;
}

export class RejeitarCadastroDto {
  @IsOptional() @Transform(apara) @IsString() @MaxLength(500) motivo?: string;
}
