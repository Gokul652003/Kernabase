export const AUTH_APPLICATION = Symbol('AUTH_APPLICATION');

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthApplication {
  signup(email: string, password: string): Promise<{ token: string; user: AuthUser }>;
  login(email: string, password: string): Promise<{ token: string; user: AuthUser }>;
  me(userId: string): Promise<AuthUser>;
}
