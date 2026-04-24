export type TrafficSummary = {
  windowStart: string;
  windowEnd: string;
  totalRequests: number;
  uniqueIps: number;
  uniqueUsers: number;
  statusBreakdown: Record<string, number>;
  topIpsByRequests: Array<{ ip: string; count: number }>;
  topIpsBy4xx: Array<{ ip: string; count: number; total: number }>;
  topPaths: Array<{ path: string; count: number }>;
  authFailureRate: number;
  suspiciousPaths: Array<{ path: string; ip: string | null; pattern: string }>;
  userAgents: {
    distinct: number;
    top: Array<{ ua: string; count: number }>;
  };
};

export class AiAnalysis {
  id: number;
  createdAt: Date;
  windowStart: Date;
  windowEnd: Date;
  requestsAnalyzed: number;
  riskScore: number;
  verdict: string;
  flaggedIps: string[];
  flaggedUserIds: number[];
  recommendations: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  trafficSummary: TrafficSummary;
  rawResponse: Record<string, unknown> | null;
}
