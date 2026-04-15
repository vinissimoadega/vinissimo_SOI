import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { clearSessionCookie } from './auth.utils';

type LoginBody = {
  email?: string;
  password?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginBody, @Res({ passthrough: true }) response: any) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      throw new UnauthorizedException('Email e senha são obrigatórios');
    }

    const result = await this.authService.login(email, password);
    response.setHeader('Set-Cookie', result.cookie);

    return {
      user: result.user,
      expiresAt: result.expiresAt,
    };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: any) {
    response.setHeader('Set-Cookie', clearSessionCookie());

    return {
      success: true,
    };
  }
}
