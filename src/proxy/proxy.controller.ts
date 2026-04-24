import {
  All,
  Controller,
  Logger,
  Req,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../config/config.type';
import { SoftJwt } from '../auth/decorators/soft-jwt.decorator';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

const STRIP_REQUEST_HEADERS = new Set<string>([
  ...HOP_BY_HOP_HEADERS,
  'host',
  'content-length',
]);

const STRIP_RESPONSE_HEADERS = new Set<string>([
  ...HOP_BY_HOP_HEADERS,
  'content-length',
  'content-encoding',
]);

@ApiExcludeController()
@SoftJwt()
@Controller({ version: VERSION_NEUTRAL })
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const baseUrl = this.configService.getOrThrow('proxy.upstreamBaseUrl', {
      infer: true,
    });
    const timeoutMs = this.configService.getOrThrow('proxy.timeoutMs', {
      infer: true,
    });

    const upstreamUrl = new URL(req.originalUrl, baseUrl).toString();
    const forwardedHeaders = this.buildForwardHeaders(req);
    const requestId = (req as Request & { request_id?: string }).request_id;

    try {
      const upstream = await firstValueFrom(
        this.http.request<ArrayBuffer>({
          url: upstreamUrl,
          method: req.method as
            | 'GET'
            | 'POST'
            | 'PUT'
            | 'PATCH'
            | 'DELETE'
            | 'OPTIONS'
            | 'HEAD',
          headers: forwardedHeaders,
          data:
            req.method === 'GET' || req.method === 'HEAD'
              ? undefined
              : req.body,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          timeout: timeoutMs,
          maxRedirects: 0,
        }),
      );

      for (const [key, value] of Object.entries(upstream.headers ?? {})) {
        if (value === undefined) continue;
        if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
        res.setHeader(key, value as string | string[] | number);
      }

      res.status(upstream.status);
      const buffer = Buffer.from(upstream.data as ArrayBuffer);
      res.send(buffer);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `[${requestId ?? '-'}] Proxy error ${req.method} ${upstreamUrl}: ${message}`,
      );
      res.status(502).json({
        status: 'error',
        message: 'Bad Gateway — upstream unreachable',
        detail: message,
      });
    }
  }

  private buildForwardHeaders(req: Request): Record<string, string> {
    const out: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
    const existingXff = req.headers['x-forwarded-for'];
    out['x-forwarded-for'] =
      typeof existingXff === 'string' && existingXff.length > 0
        ? `${existingXff}, ${clientIp}`
        : clientIp;
    out['x-forwarded-host'] = req.headers.host ?? '';
    out['x-forwarded-proto'] = req.protocol;

    const requestId = (req as Request & { request_id?: string }).request_id;
    if (requestId) out['x-request-id'] = requestId;

    return out;
  }
}
