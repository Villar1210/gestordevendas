import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class MoverCardViviDto {
  @IsString()
  @IsNotEmpty()
  cardId!: string;

  @IsString()
  @IsNotEmpty()
  stageName!: string;

  @IsString()
  @IsOptional()
  motivoRepique?: string;
}
