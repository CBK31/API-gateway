export type QueueConfig = {
  redisUrl: string;
  prefix: string;
  httpLogBatchSize: number;
  httpLogFlushIntervalMs: number;
};
