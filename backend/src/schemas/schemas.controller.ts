import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/auth/auth.guard';
import { CreateSchemaDto } from '@/schemas/dto/create-schema.dto';
import { SCHEMAS_APPLICATION, SchemasApplication } from '@/schemas/schemas-service.port';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/schemas')
export class SchemasController {
  constructor(@Inject(SCHEMAS_APPLICATION) private readonly schemas: SchemasApplication) {}

  @Get()
  list(): Promise<string[]> {
    return this.schemas.list();
  }

  @Post()
  create(@Body() dto: CreateSchemaDto): Promise<void> {
    return this.schemas.create(dto.name);
  }

  @Delete(':name')
  drop(@Param('name') name: string): Promise<void> {
    return this.schemas.drop(name);
  }
}
