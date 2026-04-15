import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AuthenticatedUser } from './auth.types';
import { extractTokenFromHeaders, verifySessionToken } from './auth.utils';

type RequestWithUser = {
  headers: {
    authorization?: string;
    cookie?: string;
  };
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractTokenFromHeaders(request.headers);

    if (!token) {
      throw new UnauthorizedException('Autenticação obrigatória');
    }

    try {
      const payload = verifySessionToken(token);
      const user = await this.authService.getUserById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Sessão inválida');
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
  }
}
