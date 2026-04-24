import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Tracks rate-limit quota by JWT user id when present (set by JwtGuard),
 * falling back to IP for anonymous traffic (e.g., /auth/login proxied
 * through the gateway, public /health, etc.).
 */
@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: { id?: number } }).user;
    if (user?.id !== undefined) return `user:${user.id}`;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return `ip:${ip}`;
  }
}
