import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { authConfig } from '../config/auth.config';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tighter limit than the app-wide default (100/min from AppModule) —
  // login is the one route worth specifically protecting against
  // brute-force password guessing. 5 attempts/min per IP is generous
  // for a real user (typos happen) but throttles automated guessing.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer the httpOnly cookie — that's what the browser frontend
    // relies on. Body is only a fallback for non-browser API clients
    // that don't carry a cookie jar (see RefreshDto's comment).
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    const result = await this.authService.refresh(incomingToken);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  // 204: logout succeeds even if the token was already invalid/expired —
  // the caller's intent (kill this session) is satisfied either way.
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    await this.authService.logout(incomingToken);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: 'lax',
      domain: authConfig.cookieDomain,
      path: REFRESH_COOKIE_PATH,
      maxAge: authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
  }
}
