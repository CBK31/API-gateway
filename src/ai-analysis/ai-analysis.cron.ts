import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AllConfigType } from '../config/config.type';
import { AiAnalysisService } from './ai-analysis.service';

const CRON_NAME = 'ai-analysis-cron';

@Injectable()
export class AiAnalysisCron implements OnModuleInit {
  private readonly logger = new Logger(AiAnalysisCron.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly scheduler: SchedulerRegistry,
    private readonly service: AiAnalysisService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.getOrThrow('ai.enabled', { infer: true });
    if (!enabled) {
      this.logger.log('AI analysis disabled via AI_ANALYSIS_ENABLED=false');
      return;
    }

    const cronExpr = this.configService.getOrThrow('ai.cron', { infer: true });
    const dryRun = this.configService.getOrThrow('ai.dryRun', { infer: true });

    const job = new CronJob(cronExpr, () => {
      this.service
        .runOnce()
        .catch((err) =>
          this.logger.error(`AI analysis run failed: ${(err as Error).message}`),
        );
    });

    this.scheduler.addCronJob(CRON_NAME, job);
    job.start();

    this.logger.log(
      `AI analysis cron scheduled: "${cronExpr}" (dryRun=${dryRun})`,
    );
  }
}
