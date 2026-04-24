import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import appConfig from './config/app.config';
import authConfig from './auth/config/auth.config';
import databaseConfig from './database/config/database.config';
import proxyConfig from './proxy/config/proxy.config';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { AuthModule } from './auth/auth.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { HealthModule } from './health/health.module';
import { EchoModule } from './echo/echo.module';
import { HttpLogsModule } from './httpLog/httpLog.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, proxyConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) =>
        new DataSource(options).initialize(),
    }),
    AuthModule,
    // Rate limiting must be imported AFTER AuthModule so JwtGuard runs first
    // and populates req.user before the throttler picks the tracker key.
    RateLimitModule,
    HealthModule,
    EchoModule,
    HttpLogsModule,
    // Catch-all proxy MUST be imported last so explicit gateway routes
    // (health, echo, http-logs) resolve before the wildcard.
    ProxyModule,
  ],
})
export class AppModule {}
