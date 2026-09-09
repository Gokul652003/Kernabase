import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CONTROL_PLANE_POOL } from '@/db/control-plane/control-plane.pool';
import { StoredUser, StoredUserWithPassword, UserRepository } from '@/db/control-plane/control-plane.ports';

@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(@Inject(CONTROL_PLANE_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<StoredUserWithPassword | null> {
    const { rows } = await this.pool.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM _studio.users WHERE email = $1',
      [email],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const { rows } = await this.pool.query<StoredUser>('SELECT id, email FROM _studio.users WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async createUser(email: string, passwordHash: string): Promise<StoredUser> {
    const { rows } = await this.pool.query<StoredUser>(
      'INSERT INTO _studio.users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );
    const row = rows[0];
    if (!row) throw new Error('INSERT ... RETURNING produced no row');
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.pool.query('DELETE FROM _studio.users WHERE id = $1', [id]);
  }
}
