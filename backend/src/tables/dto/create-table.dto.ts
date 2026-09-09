import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, Length, ValidateNested } from 'class-validator';
import { ColumnDefDto } from '@/tables/dto/column-def.dto';

export class CreateTableDto {
  @IsString()
  @Length(1, 63)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ColumnDefDto)
  columns!: ColumnDefDto[];
}
