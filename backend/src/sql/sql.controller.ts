import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/auth/auth.guard';
import { RunSqlDto } from '@/sql/dto/run-sql.dto';
import { SQL_APPLICATION, SqlApplication, SqlResult } from '@/sql/sql-service.port';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/sql')
export class SqlController {
  constructor(@Inject(SQL_APPLICATION) private readonly sql: SqlApplication) {}

  @Post()
  run(@Body() dto: RunSqlDto): Promise<SqlResult> {
    return this.sql.run(dto.query);
  }
}
