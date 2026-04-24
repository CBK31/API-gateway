import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { AiAnalysisRepository } from './infrastructure/persistance/ai-analysis.repository';
import { AiClientService } from './services/ai-client.service';
import { TrafficSummaryService } from './services/traffic-summary.service';
import { AiAnalysis } from './domain/ai-analysis';
import { NullableType } from '../utils/types/nullable.type';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly trafficSummary: TrafficSummaryService,
    private readonly aiClient: AiClientService,
    private readonly repo: AiAnalysisRepository,
  ) {}

  async runOnce(): Promise<AiAnalysis | null> {
    const enabled = this.configService.getOrThrow('ai.enabled', { infer: true });
    if (!enabled) {
      this.logger.debug('AI analysis disabled — skipping');
      return null;
    }

    const windowMinutes = this.configService.getOrThrow('ai.windowMinutes', {
      infer: true,
    });

    const windowEnd = new Date();
    const windowStart = new Date(
      windowEnd.getTime() - windowMinutes * 60 * 1000,
    );

    const { summary, rowCount } = await this.trafficSummary.summarize(
      windowStart,
      windowEnd,
    );

    if (rowCount === 0) {
      this.logger.log(
        `No traffic in window [${windowStart.toISOString()}, ${windowEnd.toISOString()}) — skipping`,
      );
      return null;
    }

    const verdict = await this.aiClient.analyze(summary);

    const saved = await this.repo.create({
      windowStart,
      windowEnd,
      requestsAnalyzed: rowCount,
      riskScore: verdict.riskScore,
      verdict: verdict.verdict,
      flaggedIps: verdict.flaggedIps,
      flaggedUserIds: verdict.flaggedUserIds,
      recommendations: verdict.recommendations,
      model: verdict.model,
      promptTokens: verdict.promptTokens,
      completionTokens: verdict.completionTokens,
      trafficSummary: summary,
      rawResponse: verdict.rawResponse,
    });

    this.logger.log(
      `AI analysis #${saved.id} — ${rowCount} requests, risk=${verdict.riskScore}, model=${verdict.model}`,
    );
    return saved;
  }

  findManyWithPagination(opts: IPaginationOptions): Promise<AiAnalysis[]> {
    return this.repo.findManyWithPagination(opts);
  }

  findLatest(): Promise<NullableType<AiAnalysis>> {
    return this.repo.findLatest();
  }
}
