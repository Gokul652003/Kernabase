import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/auth/auth.guard';
import { CreatePolicyDto } from '@/policies/dto/create-policy.dto';
import { SetRlsDto } from '@/policies/dto/set-rls.dto';
import { PolicyInfo, RlsStatus } from '@/policies/policies.types';
import { POLICIES_APPLICATION, PoliciesApplication } from '@/policies/policies-service.port';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/tables/:table')
export class PoliciesController {
  constructor(@Inject(POLICIES_APPLICATION) private readonly policies: PoliciesApplication) {}

  @Get('rls')
  getRls(@Param('table') table: string, @Query('schema') schema?: string): Promise<RlsStatus> {
    return this.policies.getRlsStatus(table, schema);
  }

  @Put('rls')
  setRls(
    @Param('table') table: string,
    @Body() dto: SetRlsDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.policies.setRlsEnabled(table, dto.enabled, schema);
  }

  @Get('policies')
  list(@Param('table') table: string, @Query('schema') schema?: string): Promise<PolicyInfo[]> {
    return this.policies.listPolicies(table, schema);
  }

  @Post('policies')
  create(
    @Param('table') table: string,
    @Body() dto: CreatePolicyDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.policies.createPolicy(table, dto, schema);
  }

  @Delete('policies/:name')
  remove(
    @Param('table') table: string,
    @Param('name') name: string,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.policies.dropPolicy(table, name, schema);
  }
}
