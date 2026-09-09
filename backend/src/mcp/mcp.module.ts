import { Module } from '@nestjs/common';
import { ProjectsModule } from '@/projects/projects.module';
import { SchemasModule } from '@/schemas/schemas.module';
import { TablesModule } from '@/tables/tables.module';
import { McpAuthGuard } from '@/mcp/mcp-auth.guard';
import { McpController } from '@/mcp/mcp.controller';

@Module({
  imports: [ProjectsModule, TablesModule, SchemasModule],
  controllers: [McpController],
  providers: [McpAuthGuard],
})
export class McpModule {}
