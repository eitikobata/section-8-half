import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@Module({
  imports: [
    PassportModule,
    // No global secret/signOptions here on purpose — access and refresh
    // tokens use different secrets and TTLs, so AuthService passes them
    // explicitly on every sign()/verify() call instead.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, WsJwtGuard],
  // JwtAuthGuard is used by other modules' controllers (incidents);
  // WsJwtGuard by IncidentsGateway. JwtModule re-exported so WsJwtGuard's
  // JwtService dependency resolves wherever it's imported.
  exports: [JwtAuthGuard, WsJwtGuard, JwtModule],
})
export class AuthModule {}
