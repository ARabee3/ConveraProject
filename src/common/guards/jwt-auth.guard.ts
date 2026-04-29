import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: unknown, _info: unknown, _context: ExecutionContext, _status?: unknown): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('Invalid credentials.');
    }
    return user as TUser;
  }
}
