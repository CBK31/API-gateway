import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { AllConfigType } from '../../config/config.type';
import { QUEUE_NAMES } from '../../queue/constants/queue-names.constant';
import {
  HTTP_LOG_JOB_NAMES,
  HttpLogJobName,
  WriteHttpLogPayload,
} from '../../queue/types/http-log-jobs.types';
import { HttpLogRepository } from '../infrastructure/persistance/httpLog.repository';
import { HttpLog, HttpMethod } from '../domain/httpLog';

@Processor(QUEUE_NAMES.HTTP_LOGS, { concurrency: 1 })
export class HttpLogProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(HttpLogProcessor.name);
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private buffer: WriteHttpLogPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly httpLogRepository: HttpLogRepository,
    configService: ConfigService<AllConfigType>,
  ) {
    super();
    this.batchSize = configService.getOrThrow('queue.httpLogBatchSize', {
      infer: true,
    });
    this.flushIntervalMs = configService.getOrThrow(
      'queue.httpLogFlushIntervalMs',
      { infer: true },
    );
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) =>
        this.logger.error(`Flush failed: ${err.message}`, err.stack),
      );
    }, this.flushIntervalMs);

    this.logger.log(
      `HttpLog processor ready — batch=${this.batchSize}, flushMs=${this.flushIntervalMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush().catch((err) =>
      this.logger.error(`Final flush failed: ${err.message}`, err.stack),
    );
  }

  async process(
    job: Job<WriteHttpLogPayload, unknown, HttpLogJobName>,
  ): Promise<void> {
    switch (job.name) {
      case HTTP_LOG_JOB_NAMES.WRITE_HTTP_LOG:
        this.buffer.push(job.data);
        if (this.buffer.length >= this.batchSize) {
          await this.flush();
        }
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const domainObjects: Omit<
      HttpLog,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    >[] = batch.map((p) => ({
      requestId: p.requestId,
      environment: p.environment ?? undefined,
      orgId: p.orgId ?? undefined,
      clientIp: p.clientIp ?? undefined,
      userId: p.userId ?? undefined,
      headers: p.headers ?? undefined,
      token: p.token ?? undefined,
      startAt: p.startAt ? new Date(p.startAt) : null,
      endAt: p.endAt ? new Date(p.endAt) : null,
      method: p.method as HttpMethod,
      url: p.url,
      query: p.query,
      routeParams: p.routeParams,
      statusCode: p.statusCode,
      requestBody: p.requestBody,
      responseTimeMs: p.responseTimeMs,
      responseBody: p.responseBody,
      rawUrl: p.rawUrl,
      urlVersion: p.urlVersion,
      urlController: p.urlController,
      urlEndPoint: p.urlEndPoint,
    }));

    try {
      await this.httpLogRepository.createMany(domainObjects);
      this.logger.debug(`Flushed ${batch.length} http logs`);
    } catch (err) {
      this.logger.error(
        `Batch insert failed (${batch.length} rows): ${(err as Error).message}`,
      );
      // Put them back so BullMQ's retry + next flush re-tries
      this.buffer.unshift(...batch);
      throw err;
    }
  }
}
