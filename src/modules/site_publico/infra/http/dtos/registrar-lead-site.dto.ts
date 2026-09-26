import { Equals, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class RegistrarLeadSiteDto {
  @IsString()
  @MinLength(2, { message: 'Informe seu nome.' })
  @MaxLength(120)
  @Matches(/\p{L}.*\p{L}/u, { message: 'Informe seu nome.' })
  nome!: string;

  // Aceita com ou sem mascara; o use case guarda so os digitos.
  @IsString()
  @Matches(/^(?=(?:\D*\d){10,13}\D*$)[\d\s()+-]{10,20}$/, { message: 'Informe um telefone válido com DDD.' })
  telefone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensagem?: string;

  @IsOptional()
  @IsUUID('4')
  imovelId?: string;

  @IsOptional()
  @IsUUID('4')
  empreendimentoId?: string;

  // LGPD: o visitante precisa marcar o aceite para enviar o formulario.
  @IsBoolean()
  @Equals(true, { message: 'É preciso aceitar a política de privacidade.' })
  aceiteLgpd!: boolean;

  // Campo "armadilha" contra robos: fica escondido no formulario. Humano
  // deixa vazio; robo preenche e o envio e descartado em silencio.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
