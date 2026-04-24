import { AiAnalysis } from '../../../../domain/ai-analysis';
import { AiAnalysisEntity } from '../entities/ai-analysis.entity';

export class AiAnalysisMapper {
  static toDomain(raw: AiAnalysisEntity): AiAnalysis {
    const d = new AiAnalysis();
    d.id = raw.id;
    d.createdAt = raw.createdAt;
    d.windowStart = raw.windowStart;
    d.windowEnd = raw.windowEnd;
    d.requestsAnalyzed = raw.requestsAnalyzed;
    d.riskScore = raw.riskScore;
    d.verdict = raw.verdict;
    d.flaggedIps = raw.flaggedIps ?? [];
    d.flaggedUserIds = raw.flaggedUserIds ?? [];
    d.recommendations = raw.recommendations;
    d.model = raw.model;
    d.promptTokens = raw.promptTokens;
    d.completionTokens = raw.completionTokens;
    d.trafficSummary = raw.trafficSummary;
    d.rawResponse = raw.rawResponse;
    return d;
  }

  static toPersistence(
    d: Omit<AiAnalysis, 'id' | 'createdAt'>,
  ): AiAnalysisEntity {
    const e = new AiAnalysisEntity();
    e.windowStart = d.windowStart;
    e.windowEnd = d.windowEnd;
    e.requestsAnalyzed = d.requestsAnalyzed;
    e.riskScore = d.riskScore;
    e.verdict = d.verdict;
    e.flaggedIps = d.flaggedIps ?? [];
    e.flaggedUserIds = d.flaggedUserIds ?? [];
    e.recommendations = d.recommendations;
    e.model = d.model;
    e.promptTokens = d.promptTokens;
    e.completionTokens = d.completionTokens;
    e.trafficSummary = d.trafficSummary;
    e.rawResponse = d.rawResponse;
    return e;
  }
}
