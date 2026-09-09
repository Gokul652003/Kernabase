import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ALLOWED_COLUMN_TYPES, ColumnType } from '@/common/allowed-types';

export class AddColumnDto {
  @IsString()
  @Length(1, 63)
  name!: string;

  @IsIn(ALLOWED_COLUMN_TYPES)
  type!: ColumnType;

  @IsOptional()
  @IsBoolean()
  nullable?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;

  /** A literal, or one of the allowlisted expressions (`now()`, `gen_random_uuid()`, …). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultValue?: string;
}
