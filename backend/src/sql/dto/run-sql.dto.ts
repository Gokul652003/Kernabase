import { IsString, MaxLength, MinLength } from 'class-validator';

export class RunSqlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  query!: string;
}
