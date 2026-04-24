import 'dotenv/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import axios from 'axios';
import type { Request, Response } from 'express';
import * as swaggerUi from 'swagger-ui-express';
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

type OpenApiDoc = Record<string, any>;

function mergeTags(a: OpenApiDoc[] = [], b: OpenApiDoc[] = []): OpenApiDoc[] {
  const byName = new Map<string, OpenApiDoc>();
  for (const t of a) if (t?.name) byName.set(t.name, t);
  for (const t of b) if (t?.name) byName.set(t.name, t);
  return Array.from(byName.values());
}

async function buildMergedSpec(
  gatewaySpec: OpenApiDoc,
  upstreamBaseUrl: string,
  port: number,
  logger: Logger,
): Promise<OpenApiDoc> {
  let upstream: OpenApiDoc | null = null;
  try {
    const { data } = await axios.get<OpenApiDoc>(
      `${upstreamBaseUrl.replace(/\/$/, '')}/docs-json`,
      { timeout: 5000 },
    );
    upstream = data;
  } catch (err) {
    logger.warn(
      `Upstream OpenAPI spec unavailable (${(err as Error).message}); serving gateway-only spec`,
    );
    return {
      ...gatewaySpec,
      servers: [
        { url: `http://localhost:${port}`, description: 'via API Gateway' },
      ],
    };
  }

  return {
    openapi: upstream.openapi ?? gatewaySpec.openapi ?? '3.0.0',
    info: {
      title: 'API Gateway + Upstream (Wazoo)',
      description:
        'All endpoints route through the gateway at ' +
        `http://localhost:${port}. One Authorize applies everywhere.`,
      version: gatewaySpec.info?.version ?? '0.1',
    },
    servers: [
      { url: `http://localhost:${port}`, description: 'via API Gateway' },
    ],
    tags: mergeTags(upstream.tags ?? [], gatewaySpec.tags ?? []),
    // Gateway paths win on conflict (they override upstream)
    paths: { ...(upstream.paths ?? {}), ...(gatewaySpec.paths ?? {}) },
    components: {
      ...(upstream.components ?? {}),
      ...(gatewaySpec.components ?? {}),
      schemas: {
        ...(upstream.components?.schemas ?? {}),
        ...(gatewaySpec.components?.schemas ?? {}),
      },
      securitySchemes: {
        ...(upstream.components?.securitySchemes ?? {}),
        ...(gatewaySpec.components?.securitySchemes ?? {}),
      },
    },
    security: gatewaySpec.security ?? upstream.security,
  };
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

  const expressInstance = app.getHttpAdapter().getInstance();
  let cachedMergedSpec: Record<string, unknown> | null = null;
  let cachedAt = 0;

  expressInstance.get(
    '/docs-json-merged',
    async (_req: Request, res: Response) => {
      if (
        !cachedMergedSpec ||
        Date.now() - cachedAt > UPSTREAM_SPEC_TTL_MS
      ) {
        cachedMergedSpec = await buildMergedSpec(
          document as unknown as OpenApiDoc,
          upstreamBaseUrl,
          port,
          logger,
        );
        cachedAt = Date.now();
      }
      res.json(cachedMergedSpec);
    },
  );

  // Also expose the gateway-only spec for debugging
  expressInstance.get('/docs-json', (_req: Request, res: Response) => {
    res.json(document);
  });

  // Mount Swagger UI manually at /docs and point it to the merged spec URL.
  // We bypass SwaggerModule.setup() because it embeds the gateway-only spec
  // inline, which Swagger UI prefers over any URL we set.
  expressInstance.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: {
        url: '/docs-json-merged',
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );

  await app.listen(port);

  logger.log('=========================================');
  logger.log('  API GATEWAY');
  logger.log('=========================================');
  logger.log(`HTTP Server:  ENABLED (port ${port})`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
