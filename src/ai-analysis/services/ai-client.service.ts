import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AllConfigType } from '../../config/config.type';
import { TrafficSummary } from '../domain/ai-analysis';

export type AiVerdict = {
  riskScore: number;
  verdict: string;
  flaggedIps: string[];
  flaggedUserIds: number[];
  recommendations: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  rawResponse: Record<string, unknown> | null;
};

const SYSTEM_PROMPT = `You are a security analyst reviewing API gateway traffic.

Analyze the traffic summary below. Rate overall risk from 0.0 (normal) to 1.0
(active attack). Identify IPs or user ids that look malicious.

Signals to weigh:
- Bursts of requests from one IP (possible scraping / DoS)
- High 401/403 rate, especially on /auth/ paths (credential brute force)
- Suspicious URL patterns (SQL injection, path traversal, XSS probes, env probes)
- Many distinct users from the same IP (possible session hijacking)
- Auth endpoint failure rate > 30%
- Repeated 429s (abuse)

Respond with ONLY a JSON object matching this shape. No extra prose.

{
  "riskScore": <number 0.0-1.0>,
  "verdict": "<one paragraph plain-English assessment>",
  "flaggedIps": [<string>, ...],
  "flaggedUserIds": [<integer>, ...],
  "recommendations": "<concrete actions to take, or empty string>"
}`;

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async analyze(summary: TrafficSummary): Promise<AiVerdict> {
    const dryRun = this.configService.getOrThrow('ai.dryRun', { infer: true });
    const model = this.configService.getOrThrow('ai.model', { infer: true });

    if (dryRun) {
      return this.dryRunVerdict(summary);
    }

    const apiKey = this.configService.get('ai.openAiApiKey', { infer: true });
    if (!apiKey) {
      this.logger.warn(
        'AI_ANALYSIS_DRY_RUN=false but OPENAI_API_KEY is missing — falling back to dry-run',
      );
      return this.dryRunVerdict(summary);
    }

    if (!this.client) {
      this.client = new OpenAI({ apiKey });
    }

    const completion = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Traffic summary:\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content ?? '{}';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn(`Failed to parse LLM JSON; falling back. Raw: ${text.slice(0, 200)}`);
      parsed = {};
    }

    return {
      riskScore: this.clamp(Number(parsed.riskScore ?? 0), 0, 1),
      verdict: String(parsed.verdict ?? 'No verdict'),
      flaggedIps: Array.isArray(parsed.flaggedIps)
        ? parsed.flaggedIps.map(String)
        : [],
      flaggedUserIds: Array.isArray(parsed.flaggedUserIds)
        ? parsed.flaggedUserIds
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n))
        : [],
      recommendations:
        typeof parsed.recommendations === 'string'
          ? parsed.recommendations
          : null,
      model,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      rawResponse: completion as unknown as Record<string, unknown>,
    };
  }

  private dryRunVerdict(_summary: TrafficSummary): AiVerdict {
    return {
      riskScore: 0,
      verdict:
        'dry-run: summary captured but no LLM call was made. Set AI_ANALYSIS_DRY_RUN=false to enable real analysis.',
      flaggedIps: [],
      flaggedUserIds: [],
      recommendations: null,
      model: 'dry-run',
      promptTokens: null,
      completionTokens: null,
      rawResponse: null,
    };
  }

  private clamp(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.min(Math.max(n, min), max);
  }
}
