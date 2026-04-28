import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';

export type SafeGatewayConfig = {
  app: {
    env: string;
    port: number;
    prefix: string;
  };
  proxy: {
    upstreamBaseUrl: string;
    timeoutMs: number;
  };
  rateLimit: {
    short: { ttlMs: number; limit: number };
    long: { ttlMs: number; limit: number };
  };
  ai: {
    enabled: boolean;
    dryRun: boolean;
    model: string;
    cron: string;
    windowMinutes: number;
    hasApiKey: boolean;
  };
  queue: {
    prefix: string;
    redisHost: string;
    redisPort: number;
    httpLogBatchSize: number;
    httpLogFlushIntervalMs: number;
  };
  httpLog: {
    enabled: boolean;
    skipPathPrefixes: string[];
  };
};

function parseEnvBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Returns the gateway's currently-effective configuration WITH SECRETS STRIPPED.
 *
 * Construction is allow-list based — nothing is spread. New env vars must
 * be added explicitly, so a contributor can't accidentally leak a secret.
 *
 * Explicitly NOT exposed:
 *   AUTH_JWT_SECRET, DATABASE_PASSWORD, DATABASE_URL, DATABASE_USERNAME,
 *   DATABASE_CA / DATABASE_KEY / DATABASE_CERT, OPENAI_API_KEY,
 *   full REDIS_URL (only host + port).
 */
@Injectable()
export class ConfigInfoService {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  build(): SafeGatewayConfig {
    const ai = this.configService.getOrThrow('ai', { infer: true });
    const proxy = this.configService.getOrThrow('proxy', { infer: true });
    const queue = this.configService.getOrThrow('queue', { infer: true });
    const app = this.configService.getOrThrow('app', { infer: true });

    const { redisHost, redisPort } = this.parseRedisHostPort(queue.redisUrl);

    return {
      app: {
        env: app.nodeEnv,
        port: app.port,
        prefix: app.apiPrefix,
      },
      proxy: {
        upstreamBaseUrl: proxy.upstreamBaseUrl,
        timeoutMs: proxy.timeoutMs,
      },
      rateLimit: {
        short: {
          ttlMs: intFromEnv('RATE_LIMIT_SHORT_TTL_MS', 10_000),
          limit: intFromEnv('RATE_LIMIT_SHORT_LIMIT', 20),
        },
        long: {
          ttlMs: intFromEnv('RATE_LIMIT_LONG_TTL_MS', 15 * 60 * 1000),
          limit: intFromEnv('RATE_LIMIT_LONG_LIMIT', 500),
        },
      },
      ai: {
        enabled: ai.enabled,
        dryRun: ai.dryRun,
        model: ai.model,
        cron: ai.cron,
        windowMinutes: ai.windowMinutes,
        hasApiKey: !!ai.openAiApiKey,
      },
      queue: {
        prefix: queue.prefix,
        redisHost,
        redisPort,
        httpLogBatchSize: queue.httpLogBatchSize,
        httpLogFlushIntervalMs: queue.httpLogFlushIntervalMs,
      },
      httpLog: {
        enabled: parseEnvBoolean(process.env.ENABLE_HTTP_REQUEST_LOGS, true),
        skipPathPrefixes: (
          process.env.HTTP_LOG_SKIP_PATH_PREFIXES ??
          '/docs,/api/v1/health,/api/v1/http-logs,/favicon.ico'
        )
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      },
    };
  }

  private parseRedisHostPort(url: string): {
    redisHost: string;
    redisPort: number;
  } {
    try {
      const u = new URL(url);
      return {
        redisHost: u.hostname || 'localhost',
        redisPort: u.port ? Number(u.port) : 6379,
      };
    } catch {
      return { redisHost: 'unknown', redisPort: 0 };
    }
  }
}
