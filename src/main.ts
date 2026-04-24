import 'dotenv/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import axios from 'axios';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllConfigType } from './config/config.type';
import { HttpLogInterceptor } from './utils/interceptors/httpLog.interceptor';
import { HttpLogsService } from './httpLog/httpLog.service';
import { RequestIdInterceptor } from './utils/interceptors/request-id.interceptor';
import { TransformInterceptor } from './utils/interceptors/transform.interceptor';
import validationOptions from './utils/validation-options';

const UPSTREAM_SPEC_TTL_MS = 60_000;

function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return fallback;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`, err.stack);
  });

  const app = await NestFactory.create(AppModule, { snapshot: true });
  app.enableShutdownHooks();

  const configService = app.get(ConfigService<AllConfigType>);

  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    { exclude: ['/'] },
  );
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe(validationOptions));

  const requestIdInterceptor = new RequestIdInterceptor();
  const httpLogInterceptor = new HttpLogInterceptor(app.get(HttpLogsService), {
    enabled: parseEnvBoolean(process.env.ENABLE_HTTP_REQUEST_LOGS, true),
    skipPathPrefixes: (
      process.env.HTTP_LOG_SKIP_PATH_PREFIXES ??
      '/docs,/api/v1/health,/api/v1/http-logs,/favicon.ico'
    )
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0),
  });

  app.useGlobalInterceptors(
    requestIdInterceptor,
    httpLogInterceptor,
    new TransformInterceptor(),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'].join(', '),
    credentials: true,
  });

  const options = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('Security / traffic gateway in front of the Orelea backend')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options);

  const port = configService.getOrThrow('app.port', { infer: true });
  const upstreamBaseUrl = configService.getOrThrow('proxy.upstreamBaseUrl', {
    infer: true,
  });

  // Serve Wazoo's OpenAPI spec through the gateway with servers[] rewritten
  // so "Try it out" calls land on us, not directly on the upstream.
  const expressInstance = app.getHttpAdapter().getInstance();
  let cachedUpstreamSpec: Record<string, unknown> | null = null;
  let cachedAt = 0;

  expressInstance.get(
    '/docs-upstream-json',
    async (_req: Request, res: Response) => {
      const now = Date.now();
      if (!cachedUpstreamSpec || now - cachedAt > UPSTREAM_SPEC_TTL_MS) {
        try {
          const { data } = await axios.get<Record<string, unknown>>(
            `${upstreamBaseUrl.replace(/\/$/, '')}/docs-json`,
            { timeout: 5000 },
          );
          data.servers = [
            {
              url: `http://localhost:${port}`,
              description: 'via API Gateway',
            },
          ];
          cachedUpstreamSpec = data;
          cachedAt = now;
        } catch (err) {
          return res.status(502).json({
            status: 'error',
            message: 'Upstream OpenAPI spec unavailable',
            detail: (err as Error).message,
          });
        }
      }
      return res.json(cachedUpstreamSpec);
    },
  );

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      urls: [
        { url: '/docs-json', name: 'Gateway (own routes)' },
        { url: '/docs-upstream-json', name: 'Upstream (Wazoo) via gateway' },
      ],
    },
  });

  await app.listen(port);

  logger.log('=========================================');
  logger.log('  API GATEWAY');
  logger.log('=========================================');
  logger.log(`HTTP Server:  ENABLED (port ${port})`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
