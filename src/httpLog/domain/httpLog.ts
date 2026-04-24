import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

export class HttpLog {
  @Expose()
  @IsInt()
  @Min(1)
  id: number;

  @Expose()
  @IsString()
  requestId: string;

  @Expose()
  @IsOptional()
  @IsString()
  environment?: string | null;

  @Expose()
  @IsOptional()
  orgId?: number | null;

  @Expose()
  @IsOptional()
  @IsString()
  clientIp?: string | null;

  @Expose()
  @IsOptional()
  headers?: Record<string, unknown> | null;

  @Expose()
  @IsOptional()
  startAt?: Date | null;

  @Expose()
  @IsOptional()
  endAt?: Date | null;

  @Expose()
  @IsEnum(HttpMethod)
  method: HttpMethod;

  @Expose()
  @IsNotEmpty()
  url: string;

  @Expose()
  @IsOptional()
  query?: Record<string, unknown>;

  @Expose()
  @IsOptional()
  routeParams?: Record<string, unknown>;

  @Expose()
  @IsOptional()
  statusCode: number | null;

  @Expose()
  @IsOptional()
  requestBody?: unknown;

  @Expose()
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @Expose()
  @IsOptional()
  token?: string;

  @Expose()
  @IsInt()
  @Min(0)
  responseTimeMs: number;

  @Expose()
  @IsOptional()
  responseBody?: unknown;

  @Expose()
  @IsString()
  rawUrl: string;

  @Expose()
  @IsString()
  urlVersion: string;

  @Expose()
  @IsString()
  urlController: string;

  @Expose()
  @IsOptional()
  @IsString()
  urlEndPoint?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}
