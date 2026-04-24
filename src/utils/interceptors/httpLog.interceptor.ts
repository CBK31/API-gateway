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
import { QueueService } from '../../queue/queue.service';
import { WriteHttpLogPayload } from '../../queue/types/http-log-jobs.types';
import { HttpMethod } from '../../httpLog/domain/httpLog';

const REQUEST_ID_KEY = 'request_id' as const;

type RequestWithId = Request & { [REQUEST_ID_KEY]: string } & {
  user?: { id?: number; organization?: number | null };
};

export type HttpLogInterceptorOptions = {
  enabled: boolean;
  skipPathPrefixes: readonly string[];
};

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpLog');

  constructor(
    private readonly queueService: QueueService,
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
      WriteHttpLogPayload,
      'endAt' | 'statusCode' | 'responseTimeMs' | 'responseBody'
    > = {
      requestId,
      environment: process.env.NODE_ENV ?? null,
      orgId: req.user?.organization ?? null,
      clientIp: this.extractClientIp(req),
      headers: headers as Record<string, unknown>,
      userId: req.user?.id ?? null,
      token: req.headers.authorization ?? null,
      startAt: startAt.toISOString(),
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
      tap(() => {
        const res = httpCtx.getResponse<Response>();
        const endAt = new Date();
        const payload: WriteHttpLogPayload = {
          ...base,
          endAt: endAt.toISOString(),
          statusCode: res.statusCode,
          responseTimeMs: endAt.getTime() - startAt.getTime(),
          responseBody: undefined,
        };
        this.queueService.enqueueHttpLog(requestId, payload);
        this.logger.log(
          this.formatLine(requestId, req.method, requestPath, res.statusCode, payload.responseTimeMs, req.user?.id),
        );
      }),
      catchError((err) => {
        const endAt = new Date();
        const status = (err as { status?: number }).status ?? 500;
        const payload: WriteHttpLogPayload = {
          ...base,
          endAt: endAt.toISOString(),
          statusCode: status,
          responseTimeMs: endAt.getTime() - startAt.getTime(),
          responseBody: {
            message: (err as Error).message,
            stack: (err as Error).stack?.split('\n').slice(0, 3).join('\n'),
          },
        };
        this.queueService.enqueueHttpLog(requestId, payload);
        this.logger.error(
          this.formatLine(requestId, req.method, requestPath, status, payload.responseTimeMs, req.user?.id, (err as Error).message),
        );
        throw err;
      }),
    );
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
