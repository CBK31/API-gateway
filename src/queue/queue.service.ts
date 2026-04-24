import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, QueueName } from './constants/queue-names.constant';
import {
  HTTP_LOG_JOB_NAMES,
  WriteHttpLogPayload,
} from './types/http-log-jobs.types';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Record<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.HTTP_LOGS) private readonly httpLogsQueue: Queue,
  ) {
    this.queues = {
      [QUEUE_NAMES.HTTP_LOGS]: httpLogsQueue,
    };
  }

  /**
   * Fire-and-forget enqueue. Returns the BullMQ promise in case the caller
   * wants to await, but typical callers just `.catch()` to swallow failures
   * so the request path stays fast even when Redis is down.
   */
  async addJob<T>(
    queueName: QueueName,
    jobName: string,
    jobId: string,
    payload: T,
  ): Promise<void> {
    const queue = this.queues[queueName];
    if (!queue) {
      this.logger.warn(`Unknown queue: ${queueName}`);
      return;
    }
    await queue.add(jobName, payload, { jobId });
  }

  enqueueHttpLog(requestId: string, payload: WriteHttpLogPayload): void {
    this.addJob(
      QUEUE_NAMES.HTTP_LOGS,
      HTTP_LOG_JOB_NAMES.WRITE_HTTP_LOG,
      requestId,
      payload,
    ).catch((err) => {
      this.logger.warn(
        `Failed to enqueue http log: ${(err as Error).message}`,
      );
    });
  }
}
