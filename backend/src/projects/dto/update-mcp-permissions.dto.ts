import { IsBoolean } from 'class-validator';

export class UpdateMcpPermissionsDto {
  @IsBoolean()
  allowWrite!: boolean;

  @IsBoolean()
  allowSchema!: boolean;
}
