import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ALLOWED_COLUMN_TYPES, ColumnType } from '@/common/allowed-types';

/**
 * Every field is optional; each one present is a change to apply. `dropDefault` is a
 * separate flag rather than `defaultValue: null` so "remove the default" and "leave the
 * default alone" stay distinguishable after validation strips undefined values.
 */
export class AlterColumnDto {
  @IsOptional()
  @IsString()
  @Length(1, 63)
  name?: string;

  @IsOptional()
  @IsIn(ALLOWED_COLUMN_TYPES)
  type?: ColumnType;

  @IsOptional()
  @IsBoolean()
  nullable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultValue?: string;

  @IsOptional()
  @IsBoolean()
  dropDefault?: boolean;
}
