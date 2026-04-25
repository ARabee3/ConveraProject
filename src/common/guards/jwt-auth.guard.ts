import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: unknown): unknown {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('Invalid credentials.');
    }
    return user;
  }
}
