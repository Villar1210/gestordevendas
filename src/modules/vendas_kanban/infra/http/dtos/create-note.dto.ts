// src/modules/vendas_kanban/infra/http/dtos/create-note.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1, { message: 'A nota nao pode ser vazia.' })
  body!: string;
}
