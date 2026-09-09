import { IsBoolean } from 'class-validator';

export class SetRlsDto {
  @IsBoolean()
  enabled!: boolean;
}
