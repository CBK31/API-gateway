export type AiConfig = {
  enabled: boolean;
  dryRun: boolean;
  model: string;
  cron: string;
  windowMinutes: number;
  openAiApiKey?: string;
};
