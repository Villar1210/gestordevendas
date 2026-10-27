// Fase B (27/10/2026): rotas que a VIVI do fazer.ai chama durante a conversa.
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class LeadEmAtendimentoViviDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^55\d{10,11}$/, { message: 'phoneNumber deve estar no formato 5511999990000' })
  phoneNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  nome?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  mensagem?: string;
}

export class EncaminharCorretorViviDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^55\d{10,11}$/, { message: 'phoneNumber deve estar no formato 5511999990000' })
  phoneNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  nome?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resumo?: string;
}
