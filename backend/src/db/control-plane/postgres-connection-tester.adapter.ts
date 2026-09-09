import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { ApplicationError } from '@/common/errors/application.error';
import { DatabaseConnectionTester, NewProjectRecord } from '@/db/control-plane/control-plane.ports';

/**
 * Opens a throwaway connection to prove a user-supplied database is reachable before
 * it is saved. Deliberately not pooled — it runs once per project creation and must
 * not leave a connection behind on failure.
 */
@Injectable()
export class PostgresConnectionTesterAdapter implements DatabaseConnectionTester {
  private readonly logger = new Logger(PostgresConnectionTesterAdapter.name);

  async assertConnectable(project: NewProjectRecord): Promise<void> {
    const testPool = new Pool({
      host: project.host,
      port: project.port,
      user: project.dbUser,
      password: project.dbPassword,
      database: project.database,
      connectionTimeoutMillis: 5000,
    });
    testPool.on('error', (error) => this.logger.warn(`Connection test pool error: ${error.message}`));
    try {
      await testPool.query('SELECT 1');
    } catch (error) {
      throw ApplicationError.badRequest(`Could not connect: ${(error as Error).message}`, error);
    } finally {
      await testPool.end().catch(() => {});
    }
  }
}
