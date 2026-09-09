import { ApplicationError } from '@/common/errors/application.error';
import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { TokenService } from '@/auth/token.service';
import { USER_REPOSITORY, UserRepository } from '@/db/control-plane/control-plane.ports';
import { AuthApplication, AuthUser } from '@/auth/auth-service.port';

@Injectable()
export class AuthService implements AuthApplication {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async signup(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.users.findByEmail(normalizedEmail)) throw ApplicationError.badRequest('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.createUser(normalizedEmail, passwordHash);

    return { token: this.tokens.issue({ userId: user.id, email: user.email }), user };
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const row = await this.users.findByEmail(normalizedEmail);
    if (!row) throw ApplicationError.unauthorized('Invalid email or password');
    const valid = await bcrypt.compare(password, row.passwordHash);
    if (!valid) throw ApplicationError.unauthorized('Invalid email or password');
    const user = { id: row.id, email: row.email };
    return { token: this.tokens.issue({ userId: user.id, email: user.email }), user };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw ApplicationError.unauthorized();
    return user;
  }

}
