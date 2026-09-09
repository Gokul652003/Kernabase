import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@/auth/auth.guard';
import { CreateTableDto } from '@/tables/dto/create-table.dto';
import { AddColumnDto } from '@/tables/dto/add-column.dto';
import { AlterColumnDto } from '@/tables/dto/alter-column.dto';
import { RenameTableDto } from '@/tables/dto/rename-table.dto';
import { UpdateRowDto } from '@/tables/dto/update-row.dto';
import { DeleteRowDto } from '@/tables/dto/delete-row.dto';
import { ColumnInfo, RowFilter, RowsResponse, TableInfo } from '@/tables/tables.types';
import { TABLES_APPLICATION, TablesApplication } from '@/tables/tables-service.port';
import { DEFAULT_ROW_LIMIT, parseRowSort } from '@/tables/row-query.builder';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/tables')
export class TablesController {
  constructor(@Inject(TABLES_APPLICATION) private readonly tables: TablesApplication) {}

  @Get()
  list(@Query('schema') schema?: string): Promise<TableInfo[]> {
    return this.tables.listTables(schema);
  }

  @Post()
  create(@Body() dto: CreateTableDto, @Query('schema') schema?: string): Promise<void> {
    return this.tables.createTable(dto, schema);
  }

  @Delete(':table')
  drop(@Param('table') table: string, @Query('schema') schema?: string): Promise<void> {
    return this.tables.dropTable(table, schema);
  }

  @Patch(':table')
  rename(
    @Param('table') table: string,
    @Body() dto: RenameTableDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.tables.renameTable(table, dto.name, schema);
  }

  @Post(':table/columns')
  addColumn(
    @Param('table') table: string,
    @Body() dto: AddColumnDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.tables.addColumn(table, dto, schema);
  }

  @Patch(':table/columns/:column')
  alterColumn(
    @Param('table') table: string,
    @Param('column') column: string,
    @Body() dto: AlterColumnDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.tables.alterColumn(table, column, dto, schema);
  }

  @Delete(':table/columns/:column')
  dropColumn(
    @Param('table') table: string,
    @Param('column') column: string,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.tables.dropColumn(table, column, schema);
  }

  @Get(':table/schema')
  schema(@Param('table') table: string, @Query('schema') schema?: string): Promise<ColumnInfo[]> {
    return this.tables.getSchema(table, schema);
  }

  @Get(':table/rows')
  rows(
    @Param('table') table: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('filters') filtersJson?: string,
    @Query('schema') schema?: string,
    @Query('cursor') cursor?: string,
    @Query('includeTotal') includeTotal?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
  ): Promise<RowsResponse> {
    let filters: RowFilter[] | undefined;
    if (filtersJson) {
      try {
        const parsed = JSON.parse(filtersJson);
        if (!Array.isArray(parsed)) throw new Error();
        filters = parsed;
      } catch {
        throw new BadRequestException('Invalid filters parameter');
      }
    }
    return this.tables.getRows({
      table,
      schema,
      limit: Number(limit) || DEFAULT_ROW_LIMIT,
      offset: Number(offset) || 0,
      filters,
      cursor,
      sort: parseRowSort(sort, dir),
      includeTotal: includeTotal !== 'false' && !cursor,
    });
  }

  @Post(':table/rows')
  insert(
    @Param('table') table: string,
    @Body() values: Record<string, unknown>,
    @Query('schema') schema?: string,
  ): Promise<Record<string, unknown>> {
    return this.tables.insertRow(table, values, schema);
  }

  @Put(':table/rows')
  update(
    @Param('table') table: string,
    @Body() dto: UpdateRowDto,
    @Query('schema') schema?: string,
  ): Promise<Record<string, unknown>> {
    return this.tables.updateRow(table, dto.pk, dto.values, schema);
  }

  @Delete(':table/rows')
  remove(
    @Param('table') table: string,
    @Body() dto: DeleteRowDto,
    @Query('schema') schema?: string,
  ): Promise<void> {
    return this.tables.deleteRow(table, dto.pk, schema);
  }
}
