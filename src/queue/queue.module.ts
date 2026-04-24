import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AllConfigType } from '../config/config.type';
import { QUEUE_NAMES } from './constants/queue-names.constant';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const redisUrl = configService.getOrThrow('queue.redisUrl', {
          infer: true,
        });
        const prefix = configService.getOrThrow('queue.prefix', {
          infer: true,
        });
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            username: url.username || undefined,
            db: url.pathname && url.pathname !== '/'
              ? Number(url.pathname.slice(1))
              : 0,
          },
          prefix,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.HTTP_LOGS }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
