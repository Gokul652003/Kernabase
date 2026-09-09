import { IsString, Length } from 'class-validator';

export class RenameTableDto {
  @IsString()
  @Length(1, 63)
  name!: string;
}
