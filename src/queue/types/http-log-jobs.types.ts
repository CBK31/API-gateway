import { HttpMethod } from '../../httpLog/domain/httpLog';

export const HTTP_LOG_JOB_NAMES = {
  WRITE_HTTP_LOG: 'write-http-log',
} as const;

export type HttpLogJobName =
  (typeof HTTP_LOG_JOB_NAMES)[keyof typeof HTTP_LOG_JOB_NAMES];

/**
 * Redis serialises JSON; Date instances do NOT survive the round trip.
 * All timestamps are ISO strings on the wire; the processor parses them back.
 */
export type WriteHttpLogPayload = {
  requestId: string;
  environment?: string | null;
  orgId?: number | null;
  clientIp?: string | null;
  headers?: Record<string, unknown> | null;
  userId?: number | null;
  token?: string | null;
  startAt: string; // ISO
  endAt: string; // ISO
  method: HttpMethod;
  url: string;
  query: Record<string, unknown>;
  routeParams: Record<string, unknown>;
  statusCode: number | null;
  requestBody: unknown;
  responseTimeMs: number;
  responseBody: unknown;
  rawUrl: string;
  urlVersion: string;
  urlController: string;
  urlEndPoint: string;
};
