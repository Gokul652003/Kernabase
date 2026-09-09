import { IsString, Length } from 'class-validator';

export class CreateManagedProjectDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
