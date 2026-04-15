import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  createSessionCookie,
  signSessionToken,
  verifyPassword,
} from './auth.utils';
import { AuthenticatedUser, AuthenticatedUserRecord } from './auth.types';

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: string[] | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(email: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    await this.db.query(
      'UPDATE soi.users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1;',
      [user.id],
    );

    const authenticatedUser = await this.getUserById(user.id);

    if (!authenticatedUser) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const session = signSessionToken({
      sub: authenticatedUser.id,
      email: authenticatedUser.email,
      roles: authenticatedUser.roles,
    });

    return {
      user: authenticatedUser,
      expiresAt: session.expiresAt,
      cookie: createSessionCookie(session.token, session.ttlSeconds),
    };
  }

  async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    const result = await this.db.query<UserRow>(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.password_hash,
          u.is_active,
          u.last_login_at,
          COALESCE(array_remove(array_agg(r.role_key), NULL), '{}') AS roles
        FROM soi.users u
        LEFT JOIN soi.user_roles ur ON ur.user_id = u.id
        LEFT JOIN soi.roles r ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY
          u.id,
          u.full_name,
          u.email,
          u.password_hash,
          u.is_active,
          u.last_login_at
        LIMIT 1;
      `,
      [userId],
    );

    const row = result.rows[0];

    if (!row || !row.is_active) {
      return null;
    }

    return this.mapUser(row);
  }

  private async findUserByEmail(
    email: string,
  ): Promise<AuthenticatedUserRecord | null> {
    const result = await this.db.query<UserRow>(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.password_hash,
          u.is_active,
          u.last_login_at,
          COALESCE(array_remove(array_agg(r.role_key), NULL), '{}') AS roles
        FROM soi.users u
        LEFT JOIN soi.user_roles ur ON ur.user_id = u.id
        LEFT JOIN soi.roles r ON r.id = ur.role_id
        WHERE LOWER(u.email) = LOWER($1)
        GROUP BY
          u.id,
          u.full_name,
          u.email,
          u.password_hash,
          u.is_active,
          u.last_login_at
        LIMIT 1;
      `,
      [email],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      ...this.mapUser(row),
      passwordHash: row.password_hash,
    };
  }

  private mapUser(row: UserRow): AuthenticatedUser {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      roles: row.roles ?? [],
    };
  }
}
