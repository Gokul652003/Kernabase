import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ALLOWED_COLUMN_TYPES, ColumnType } from '@/common/allowed-types';

export class ColumnDefDto {
  @IsString()
  @Length(1, 63)
  name!: string;

  @IsIn(ALLOWED_COLUMN_TYPES)
  type!: ColumnType;

  @IsOptional()
  @IsBoolean()
  primaryKey?: boolean;

  @IsOptional()
  @IsBoolean()
  nullable?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;
}
