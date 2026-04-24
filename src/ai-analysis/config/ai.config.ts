import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { AiConfig } from './ai-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  AI_ANALYSIS_ENABLED: string;

  @IsString()
  @IsOptional()
  AI_ANALYSIS_DRY_RUN: string;

  @IsString()
  @IsOptional()
  AI_ANALYSIS_MODEL: string;

  @IsString()
  @IsOptional()
  AI_ANALYSIS_CRON: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  AI_ANALYSIS_WINDOW_MINUTES: number;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY: string;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const s = value.trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
}

export default registerAs<AiConfig>('ai', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    enabled: parseBool(process.env.AI_ANALYSIS_ENABLED, true),
    dryRun: parseBool(process.env.AI_ANALYSIS_DRY_RUN, true),
    model: process.env.AI_ANALYSIS_MODEL ?? 'gpt-4o-mini',
    cron: process.env.AI_ANALYSIS_CRON ?? '*/5 * * * *',
    windowMinutes: process.env.AI_ANALYSIS_WINDOW_MINUTES
      ? parseInt(process.env.AI_ANALYSIS_WINDOW_MINUTES, 10)
      : 5,
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  };
});
