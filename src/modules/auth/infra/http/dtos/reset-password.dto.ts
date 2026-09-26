import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Este link é inválido. Peça um novo em "Esqueci minha senha".' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  // bcrypt ignora o que passa de 72 bytes - melhor avisar do que cortar calado.
  @MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres.' })
  newPassword!: string;
}
