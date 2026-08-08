import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { authConfig } from '../config/auth.config';
import { LoginDto } from './dto/login.dto';

interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokenPair(user);
  }

  /**
   * Rotates the refresh token: the incoming one gets revoked and a brand
   * new pair (access + refresh) is issued. This limits how long a leaked
   * refresh token stays useful — reusing an already-rotated one fails,
   * since by then it's marked revoked in Postgres.
   *
   * Takes the raw token string directly (not a DTO) — AuthController
   * resolves it from the httpOnly cookie or, failing that, the request
   * body, before calling this.
   */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: { sub: string; jti: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: authConfig.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: this exact token was already rotated away once
    // before. Two ways that happens — (a) a client retried a request
    // after a slow/dropped response, genuinely benign, or (b) someone
    // is replaying a stolen refresh token that the legitimate user has
    // already rotated past. There's no way to tell those apart after
    // the fact, so the safe move is to treat it as a compromise: kill
    // every active session for this user, forcing a fresh login
    // everywhere. Better to inconvenience the real user occasionally
    // than to let a leaked token keep working silently.
    if (stored.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId} — revoking all sessions`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(stored.user);
  }

  /** Revokes a single refresh token (logout from one device/session). */
  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(user: User) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: authConfig.accessTokenSecret,
      expiresIn: authConfig.accessTokenTtl,
    });

    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, jti },
      {
        secret: authConfig.refreshTokenSecret,
        expiresIn: `${authConfig.refreshTokenTtlDays}d`,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  // Refresh tokens are only ever stored as a SHA-256 hash — same reasoning
  // as password hashing conceptually, but plain sha256 is enough here
  // since this isn't protecting a low-entropy secret like a password,
  // it's a lookup key for an already-high-entropy signed JWT.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
