import { AppConfig } from './app-config.type';
import { DatabaseConfig } from '../database/config/database-config.type';
import { AuthConfig } from '../auth/config/auth-config.type';
import { ProxyConfig } from '../proxy/config/proxy-config.type';

export type AllConfigType = {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  proxy: ProxyConfig;
};
