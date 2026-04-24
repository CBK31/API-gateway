import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HttpLogEntity } from '../../httpLog/infrastructure/persistance/relational/entities/httpLog.entity';
import { TrafficSummary } from '../domain/ai-analysis';

const SUSPICIOUS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'path-traversal', re: /\.\.(%2f|%5c|\/|\\)/i },
  { name: 'sql-injection', re: /(union\s+select|or\s+1=1|--\s|';\s*drop\s+table)/i },
  { name: 'xss-probe', re: /(<script\b|onerror=|javascript:)/i },
  { name: 'null-byte', re: /%00/i },
  { name: 'shell-injection', re: /(;|\||&&|`|\$\(|%0a)/i },
  { name: 'env-probe', re: /\/(\.env|\.git|wp-admin|phpmyadmin)/i },
];

const AUTH_PATH_REGEX = /\/auth\//i;

@Injectable()
export class TrafficSummaryService {
  constructor(
    @InjectRepository(HttpLogEntity)
    private readonly httpLogRepo: Repository<HttpLogEntity>,
  ) {}

  async summarize(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<{ summary: TrafficSummary; rowCount: number }> {
    const rows = await this.httpLogRepo.find({
      where: { createdAt: Between(windowStart, windowEnd) },
      select: [
        'clientIp',
        'userId',
        'method',
        'url',
        'rawUrl',
        'statusCode',
        'headers',
      ],
      order: { createdAt: 'ASC' },
      take: 5000,
    });

    const rowCount = rows.length;
    const ipCount = new Map<string, number>();
    const ip4xxCount = new Map<string, number>();
    const userIds = new Set<number>();
    const pathCount = new Map<string, number>();
    const uaCount = new Map<string, number>();
    const statusBreakdown: Record<string, number> = {};
    const suspiciousPaths: TrafficSummary['suspiciousPaths'] = [];
    let authAttempts = 0;
    let authFailures = 0;

    for (const r of rows) {
      const ip = r.clientIp ?? 'unknown';
      ipCount.set(ip, (ipCount.get(ip) ?? 0) + 1);
      if (r.userId != null) userIds.add(Number(r.userId));

      const bucket = this.statusBucket(r.statusCode);
      statusBreakdown[bucket] = (statusBreakdown[bucket] ?? 0) + 1;
      if (r.statusCode && r.statusCode >= 400 && r.statusCode < 500) {
        ip4xxCount.set(ip, (ip4xxCount.get(ip) ?? 0) + 1);
      }

      const path = r.rawUrl ?? r.url ?? '';
      pathCount.set(path, (pathCount.get(path) ?? 0) + 1);

      if (AUTH_PATH_REGEX.test(path)) {
        authAttempts += 1;
        if (r.statusCode && r.statusCode >= 400) authFailures += 1;
      }

      const ua =
        (r.headers as Record<string, unknown> | null)?.['user-agent']?.toString() ??
        'unknown';
      uaCount.set(ua, (uaCount.get(ua) ?? 0) + 1);

      const target = r.url ?? '';
      for (const { name, re } of SUSPICIOUS_PATTERNS) {
        if (re.test(target) && suspiciousPaths.length < 20) {
          suspiciousPaths.push({ path: target, ip: r.clientIp ?? null, pattern: name });
          break;
        }
      }
    }

    const topIpsByRequests = this.topN(ipCount, 5).map(([ip, count]) => ({
      ip,
      count,
    }));
    const topIpsBy4xx = this.topN(ip4xxCount, 5).map(([ip, count]) => ({
      ip,
      count,
      total: ipCount.get(ip) ?? 0,
    }));
    const topPaths = this.topN(pathCount, 10).map(([path, count]) => ({
      path,
      count,
    }));
    const topUas = this.topN(uaCount, 5).map(([ua, count]) => ({ ua, count }));

    return {
      rowCount,
      summary: {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        totalRequests: rowCount,
        uniqueIps: ipCount.size,
        uniqueUsers: userIds.size,
        statusBreakdown,
        topIpsByRequests,
        topIpsBy4xx,
        topPaths,
        authFailureRate:
          authAttempts === 0 ? 0 : Number((authFailures / authAttempts).toFixed(3)),
        suspiciousPaths,
        userAgents: { distinct: uaCount.size, top: topUas },
      },
    };
  }

  private statusBucket(code: number | null): string {
    if (code == null) return 'unknown';
    if (code >= 200 && code < 300) return '2xx';
    if (code >= 300 && code < 400) return '3xx';
    if (code === 401) return '401';
    if (code === 403) return '403';
    if (code === 429) return '429';
    if (code >= 400 && code < 500) return '4xx';
    if (code >= 500) return '5xx';
    return 'other';
  }

  private topN(map: Map<string, number>, n: number): Array<[string, number]> {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
}
