import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { sanitizePayload } from '../sanitize-payload';
import { HttpLogsService } from '../../httpLog/httpLog.service';
import { HttpMethod, HttpLog } from '../../httpLog/domain/httpLog';

const REQUEST_ID_KEY = 'request_id' as const;

type RequestWithId = Request & { [REQUEST_ID_KEY]: string } & {
  user?: { id?: number; organization?: number | null };
};

export type HttpLogInterceptorOptions = {
  enabled: boolean;
  skipPathPrefixes: readonly string[];
};

type PersistPayload = Omit<
  HttpLog,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpLog');

  constructor(
    private readonly httpLogsService: HttpLogsService,
    private readonly options: HttpLogInterceptorOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>() as RequestWithId;

    if (!this.options.enabled) {
      return next.handle();
    }

    const requestPath = req.originalUrl ?? req.url;
    if (this.shouldSkipPath(requestPath)) {
      return next.handle();
    }

    const startAt = new Date();
    const requestId = req[REQUEST_ID_KEY];
    const parsed = this.parseRequestUrl(requestPath);
    const headers = this.sanitizeHeadersForLog(req.headers);

    const sanitizedBody =
      req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
        ? sanitizePayload(req.body)
        : req.body;

    const base: Omit<
      PersistPayload,
      'endAt' | 'statusCode' | 'responseTimeMs' | 'responseBody'
    > = {
      requestId,
      environment: process.env.NODE_ENV ?? null,
      orgId: req.user?.organization ?? null,
      clientIp: this.extractClientIp(req),
      headers: headers as Record<string, unknown>,
      userId: req.user?.id ?? undefined,
      token: req.headers.authorization ?? undefined,
      startAt,
      method: req.method as HttpMethod,
      url: requestPath,
      query: req.query as Record<string, unknown>,
      routeParams: req.params as Record<string, unknown>,
      requestBody: sanitizedBody,
      rawUrl: parsed.rawUrl,
      urlVersion: parsed.urlVersion,
      urlController: parsed.urlController,
      urlEndPoint: parsed.urlEndPoint,
    };

    return next.handle().pipe(
      tap((data) => {
        const res = httpCtx.getResponse<Response>();
        const endAt = new Date();
        this.persist({
          ...base,
          endAt,
          statusCode: res.statusCode,
          responseTimeMs: endAt.getTime() - startAt.getTime(),
          responseBody: sanitizePayload(data),
        });
        this.logger.log(
          this.formatLine(requestId, req.method, requestPath, res.statusCode, endAt.getTime() - startAt.getTime(), req.user?.id),
        );
      }),
      catchError((err) => {
        const endAt = new Date();
        const status = (err as { status?: number }).status ?? 500;
        this.persist({
          ...base,
          endAt,
          statusCode: status,
          responseTimeMs: endAt.getTime() - startAt.getTime(),
          responseBody: {
            message: (err as Error).message,
            stack: (err as Error).stack?.split('\n').slice(0, 3).join('\n'),
          },
        });
        this.logger.error(
          this.formatLine(requestId, req.method, requestPath, status, endAt.getTime() - startAt.getTime(), req.user?.id, (err as Error).message),
        );
        throw err;
      }),
    );
  }

  private persist(payload: PersistPayload): void {
    // Fire-and-forget: never block the response on DB write.
    this.httpLogsService.create(payload).catch((err) => {
      this.logger.warn(`Failed to persist http log: ${(err as Error).message}`);
    });
  }

  private formatLine(
    requestId: string,
    method: string,
    url: string,
    status: number,
    durationMs: number,
    userId?: number,
    error?: string,
  ): string {
    const parts = [
      `[${requestId}]`,
      `${method} ${url}`,
      `→ ${status}`,
      `(${durationMs}ms)`,
    ];
    if (userId !== undefined) parts.push(`user=${userId}`);
    if (error) parts.push(`error="${error}"`);
    return parts.join(' ');
  }

  private shouldSkipPath(fullUrl: string): boolean {
    const [path] = fullUrl.split('?', 1);
    for (const prefix of this.options.skipPathPrefixes) {
      if (prefix.length > 0 && path.startsWith(prefix)) return true;
    }
    return false;
  }

  private sanitizeHeadersForLog(
    headers: Request['headers'],
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      out[key] = String(value);
    }
    return out;
  }

  private extractClientIp(req: Request): string | null {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    return req.ip ?? req.socket.remoteAddress ?? null;
  }

  private parseRequestUrl(fullUrl: string): {
    rawUrl: string;
    urlVersion: string;
    urlController: string;
    urlEndPoint: string;
  } {
    const [path] = fullUrl.split('?', 1);
    const segments = path.replace(/^\/+/, '').split('/');
    const maskNumeric = (seg: string) => (/^\d+$/.test(seg) ? '{id}' : seg);
    const masked = segments.map(maskNumeric);

    const urlVersion = `/${segments.slice(0, 2).join('/')}`;
    const urlController = segments[2] ?? '';
    const rawUrl = `/${masked.join('/')}`;
    const urlEndPoint = masked.slice(3).join('/') || '';

    return { rawUrl, urlVersion, urlController, urlEndPoint };
  }
}
