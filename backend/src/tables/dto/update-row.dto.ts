import { IsObject } from 'class-validator';

export class UpdateRowDto {
  @IsObject()
  pk!: Record<string, unknown>;

  @IsObject()
  values!: Record<string, unknown>;
}
