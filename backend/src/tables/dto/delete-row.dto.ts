import { IsObject } from 'class-validator';

export class DeleteRowDto {
  @IsObject()
  pk!: Record<string, unknown>;
}
