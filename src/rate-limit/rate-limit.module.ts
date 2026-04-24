import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserOrIpThrottlerGuard } from './guards/user-or-ip-throttler.guard';

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: intFromEnv('RATE_LIMIT_SHORT_TTL_MS', 10_000),
        limit: intFromEnv('RATE_LIMIT_SHORT_LIMIT', 20),
      },
      {
        name: 'long',
        ttl: intFromEnv('RATE_LIMIT_LONG_TTL_MS', 15 * 60 * 1000),
        limit: intFromEnv('RATE_LIMIT_LONG_LIMIT', 500),
      },
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserOrIpThrottlerGuard },
  ],
})
export class RateLimitModule {}
