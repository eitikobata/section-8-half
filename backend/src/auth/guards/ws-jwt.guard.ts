import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { authConfig } from '../../config/auth.config';

/**
 * Runs once, at handshake time, not per-message — the gateway is a single
 * global namespace (Bloco 3) with no per-message auth checks, so gating
 * the connection itself is enough. A client that fails this never gets a
 * socket; there's no "connected but unauthenticated" state to worry about.
 *
 * Doesn't go through Passport: WS handshakes don't carry an Authorization
 * header the same way HTTP does, so the token comes from
 * `socket.handshake.auth.token` (what socket.io-client sends via
 * `io(url, { auth: { token } })`) and gets verified directly against the
 * same access-token secret JwtStrategy uses.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    return this.verifyClient(context.switchToWs().getClient<Socket>());
  }

  /**
   * Same check as canActivate(), exposed directly so IncidentsGateway can
   * call it from handleConnection() — Nest doesn't run @UseGuards for
   * that lifecycle hook, only for @SubscribeMessage handlers, so the
   * gateway needs a plain method to call by hand instead of an
   * ExecutionContext.
   */
  verifyClient(client: Socket): boolean {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`WS handshake rejected: no token (${client.id})`);
      return false;
    }

    try {
      const payload = this.jwt.verify(token, {
        secret: authConfig.accessTokenSecret,
      });
      // Stashed on the socket so gateway handlers can read it later
      // without re-verifying the token on every event.
      (client as Socket & { user?: unknown }).user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      return true;
    } catch {
      this.logger.warn(`WS handshake rejected: invalid token (${client.id})`);
      return false;
    }
  }
}
