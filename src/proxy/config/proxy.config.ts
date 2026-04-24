import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsUrl, Min } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { ProxyConfig } from './proxy-config.type';

class EnvironmentVariablesValidator {
  @IsUrl({ require_tld: false })
  @IsOptional()
  UPSTREAM_BASE_URL: string;

  @IsInt()
  @Min(100)
  @IsOptional()
  UPSTREAM_TIMEOUT_MS: number;
}

export default registerAs<ProxyConfig>('proxy', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    upstreamBaseUrl: process.env.UPSTREAM_BASE_URL ?? 'http://localhost:3000',
    timeoutMs: process.env.UPSTREAM_TIMEOUT_MS
      ? parseInt(process.env.UPSTREAM_TIMEOUT_MS, 10)
      : 30000,
  };
});
