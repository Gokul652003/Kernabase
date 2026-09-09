import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { AuthService } from '@/auth/auth.service';
import { ApplicationError } from '@/common/errors/application.error';
import type { StoredUser, StoredUserWithPassword, UserRepository } from '@/db/control-plane/control-plane.ports';
import type { TokenService } from '@/auth/token.service';

function build(overrides: {
  users?: Partial<UserRepository>;
  tokens?: Partial<TokenService>;
} = {}) {
  const users = {
    findByEmail: async (): Promise<StoredUserWithPassword | null> => null,
    findById: async (): Promise<StoredUser | null> => null,
    createUser: async (email: string): Promise<StoredUser> => ({ id: 'user-1', email }),
    deleteById: async (): Promise<void> => {},
    ...overrides.users,
  } as UserRepository;
  const tokens = { issue: (payload: { userId: string }) => `token:${payload.userId}`, ...overrides.tokens } as TokenService;
  return { service: new AuthService(users, tokens), users, tokens };
}

test('login authenticates through the repository interface, with no database', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const { service } = build({
    users: {
      findByEmail: async (email: string) =>
        email === 'user@example.com' ? { id: 'user-1', email, passwordHash } : null,
    },
  });

  const result = await service.login(' USER@example.com ', 'correct-password');
  assert.equal(result.token, 'token:user-1');
  assert.deepEqual(result.user, { id: 'user-1', email: 'user@example.com' });
});

test('login rejects an unknown user and a wrong password identically', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const { service: unknownUser } = build();
  const { service: wrongPassword } = build({
    users: { findByEmail: async (email: string) => ({ id: 'user-1', email, passwordHash }) },
  });

  await assert.rejects(() => unknownUser.login('missing@example.com', 'password'), /Invalid email or password/);
  await assert.rejects(() => wrongPassword.login('user@example.com', 'wrong'), /Invalid email or password/);
});

test('login raises a transport-neutral unauthorized error', async () => {
  const { service } = build();
  await assert.rejects(
    () => service.login('missing@example.com', 'password'),
    (error: unknown) => error instanceof ApplicationError && error.code === 'unauthorized',
  );
});

test('signup refuses an address that is already registered', async () => {
  const { service } = build({
    users: { findByEmail: async (email: string) => ({ id: 'user-1', email, passwordHash: 'x' }) },
  });
  await assert.rejects(() => service.signup('taken@example.com', 'password123'), /Email already registered/);
});

test('signup creates only the user account and returns its token', async () => {
  const created: string[] = [];
  const { service } = build({
    users: {
      createUser: async (email: string): Promise<StoredUser> => {
        created.push(email);
        return { id: 'user-1', email };
      },
    },
  });

  const result = await service.signup(' NEW@example.com ', 'password123');
  assert.deepEqual(created, ['new@example.com']);
  assert.equal(result.token, 'token:user-1');
  assert.deepEqual(result.user, { id: 'user-1', email: 'new@example.com' });
});
