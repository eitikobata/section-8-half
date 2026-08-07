import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Thin wrapper so it can be dropped on any controller/route with
// @UseGuards(JwtAuthGuard) — delegates entirely to JwtStrategy.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
