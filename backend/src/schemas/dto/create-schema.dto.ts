import { IsString, Length } from 'class-validator';

export class CreateSchemaDto {
  @IsString()
  @Length(1, 63)
  name!: string;
}
