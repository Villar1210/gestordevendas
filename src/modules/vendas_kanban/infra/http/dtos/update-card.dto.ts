// src/modules/vendas_kanban/infra/http/dtos/update-card.dto.ts
import { IsEmail, IsIn, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

const TEMPERATURA_VALUES = ['quente', 'morno', 'frio'];

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe um titulo para o card.' })
  title?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsIn(TEMPERATURA_VALUES, {
    message: `temperatura deve ser um de: ${TEMPERATURA_VALUES.join(', ')}`,
  })
  temperatura?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Insira um e-mail valido.' })
  email?: string | null;

  @IsOptional()
  @IsString()
  endereco?: string | null;

  @IsOptional()
  @IsString()
  numero?: string | null;

  @IsOptional()
  @IsString()
  complemento?: string | null;

  @IsOptional()
  @IsString()
  bairro?: string | null;

  @IsOptional()
  @IsString()
  cep?: string | null;

  @IsOptional()
  @IsString()
  imovelId?: string | null;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
