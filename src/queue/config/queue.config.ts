import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { QueueConfig } from './queue-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  REDIS_URL: string;

  @IsString()
  @IsOptional()
  QUEUE_PREFIX: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  HTTP_LOG_BATCH_SIZE: number;

  @IsInt()
  @Min(100)
  @IsOptional()
  HTTP_LOG_FLUSH_INTERVAL_MS: number;
}

export default registerAs<QueueConfig>('queue', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    prefix: process.env.QUEUE_PREFIX ?? 'api-gateway',
    httpLogBatchSize: process.env.HTTP_LOG_BATCH_SIZE
      ? parseInt(process.env.HTTP_LOG_BATCH_SIZE, 10)
      : 50,
    httpLogFlushIntervalMs: process.env.HTTP_LOG_FLUSH_INTERVAL_MS
      ? parseInt(process.env.HTTP_LOG_FLUSH_INTERVAL_MS, 10)
      : 2000,
  };
});
