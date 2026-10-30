// src/modules/gestao_imobiliaria/infra/http/dtos/create-empreendimento.dto.ts
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export const EMPREENDIMENTO_TIPOS = ['vertical', 'horizontal', 'comercial', 'misto'] as const;
export const EMPREENDIMENTO_STATUS = ['breve_lancamento', 'lancamento', 'em_obras', 'pronto'] as const;

export class CreateEmpreendimentoDto {
  @IsString()
  @MinLength(1, { message: 'Informe um nome para o empreendimento.' })
  name!: string;

  // Endereço
  @IsString()
  @MinLength(1, { message: 'Informe a rua.' })
  rua!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o numero.' })
  numero!: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @MinLength(1, { message: 'Informe o bairro.' })
  bairro!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a cidade.' })
  cidade!: string;

  @IsString()
  @Length(2, 2, { message: 'UF deve ter 2 letras.' })
  uf!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o CEP.' })
  cep!: string;

  // Caracterização
  @IsOptional()
  @IsString()
  @IsIn(EMPREENDIMENTO_TIPOS, { message: 'Tipo inválido. Use: vertical, horizontal, comercial ou misto.' })
  tipo?: string;

  // Construtoras (Fatia A): construtoraId (do proprio tenant, senao 404) e
  // o caminho novo. "construtora" (texto) continua aceito por
  // compatibilidade: sem construtoraId, acha a construtora pelo nome
  // normalizado ou cria uma nova.
  @IsOptional()
  @IsUUID('4', { message: 'Construtora inválida.' })
  construtoraId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'O nome da construtora deve ter no máximo 150 caracteres.' })
  construtora?: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPREENDIMENTO_STATUS, { message: 'Status inválido. Use: breve_lancamento, lancamento, em_obras ou pronto.' })
  statusObra?: string;

  // Preço
  @IsOptional()
  @IsNumber({}, { message: 'precoMinimo deve ser um número.' })
  @IsPositive({ message: 'precoMinimo deve ser positivo.' })
  precoMinimo?: number;

  @IsOptional()
  @IsNumber({}, { message: 'precoMaximo deve ser um número.' })
  @IsPositive({ message: 'precoMaximo deve ser positivo.' })
  precoMaximo?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// PATCH /empreendimentos/:id - por enquanto so troca a construtora do
// empreendimento (null = desvincular). Outros campos entram aqui quando a
// tela de edicao do empreendimento existir.
export class UpdateEmpreendimentoDto {
  @IsOptional()
  @IsUUID('4', { message: 'Construtora inválida.' })
  construtoraId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'O nome da construtora deve ter no máximo 150 caracteres.' })
  construtora?: string;
}
