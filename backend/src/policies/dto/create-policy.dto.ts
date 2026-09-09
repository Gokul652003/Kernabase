import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { POLICY_COMMANDS, PolicyCommand } from '@/policies/policies.types';

export class CreatePolicyDto {
  @IsString()
  @Length(1, 63)
  name!: string;

  @IsIn(POLICY_COMMANDS)
  command!: PolicyCommand;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  roles?: string[];

  @IsString()
  @IsOptional()
  using?: string;

  @IsString()
  @IsOptional()
  withCheck?: string;
}
