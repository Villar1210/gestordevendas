import { IsBoolean } from 'class-validator';

export class PublicarUnidadesSiteDto {
  @IsBoolean()
  publicado!: boolean;
}
