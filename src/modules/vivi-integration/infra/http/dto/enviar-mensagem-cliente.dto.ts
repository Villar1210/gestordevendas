// Etapa 1, parte 3 (19/11/2026): texto que o corretor envia ao cliente
// pelo numero oficial (POST /leads-vivi/:cardId/mensagens).
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EnviarMensagemClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  texto!: string;
}
