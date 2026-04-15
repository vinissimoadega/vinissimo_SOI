export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: string[];
};

export type AuthenticatedUserRecord = AuthenticatedUser & {
  passwordHash: string;
};

export type SessionTokenPayload = {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
};
