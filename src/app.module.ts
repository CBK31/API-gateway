import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import appConfig from './config/app.config';
import aiConfig from './ai-analysis/config/ai.config';
import authConfig from './auth/config/auth.config';
import databaseConfig from './database/config/database.config';
import proxyConfig from './proxy/config/proxy.config';
import queueConfig from './queue/config/queue.config';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { HealthModule } from './health/health.module';
import { EchoModule } from './echo/echo.module';
import { HttpLogsModule } from './httpLog/httpLog.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        proxyConfig,
        queueConfig,
        aiConfig,
      ],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) =>
        new DataSource(options).initialize(),
    }),
    // QueueModule is @Global — must come before modules that inject QueueService
    QueueModule,
    AuthModule,
    // Rate limiting must be imported AFTER AuthModule so JwtGuard runs first
    // and populates req.user before the throttler picks the tracker key.
    RateLimitModule,
    // Registers the scheduling runtime used by the AI cron job.
    ScheduleModule.forRoot(),
    HealthModule,
    EchoModule,
    HttpLogsModule,
    AiAnalysisModule,
    // Catch-all proxy MUST be imported last so explicit gateway routes
    // (health, echo, http-logs, ai-analysis) resolve before the wildcard.
    ProxyModule,
  ],
})
export class AppModule {}
