import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../config/auth.config';

interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

// Runs on every request hitting a route behind JwtAuthGuard. Only checks
// the ACCESS token secret/expiry — refresh tokens never go through here,
// they're verified by hand in AuthService against their own secret.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.accessTokenSecret,
    });
  }

  // Whatever this returns becomes req.user.
  async validate(payload: AccessTokenPayload) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
