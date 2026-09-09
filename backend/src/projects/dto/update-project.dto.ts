import { IsString, Length } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
