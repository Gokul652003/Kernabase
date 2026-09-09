import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** PostgreSQL's default port — correct for almost every connection anyone will add. */
export const DEFAULT_POSTGRES_PORT = 5432;

export class CreateProjectDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(1, 255)
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = DEFAULT_POSTGRES_PORT;

  @IsString()
  @Length(1, 63)
  database!: string;

  @IsString()
  @Length(1, 63)
  dbUser!: string;

  @IsString()
  @Length(0, 255)
  dbPassword!: string;
}
