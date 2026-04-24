import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TrafficSummary } from '../../../../domain/ai-analysis';

@Entity('ai_analysis')
export class AiAnalysisEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'window_start' })
  windowStart: Date;

  @Column({ type: 'timestamptz', name: 'window_end' })
  windowEnd: Date;

  @Column({ type: 'integer', name: 'requests_analyzed' })
  requestsAnalyzed: number;

  @Index()
  @Column({ type: 'float', name: 'risk_score' })
  riskScore: number;

  @Column({ type: 'text' })
  verdict: string;

  @Column({ type: 'jsonb', name: 'flagged_ips', default: [] })
  flaggedIps: string[];

  @Column({ type: 'jsonb', name: 'flagged_user_ids', default: [] })
  flaggedUserIds: number[];

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'integer', name: 'prompt_tokens', nullable: true })
  promptTokens: number | null;

  @Column({ type: 'integer', name: 'completion_tokens', nullable: true })
  completionTokens: number | null;

  @Column({ type: 'jsonb', name: 'traffic_summary' })
  trafficSummary: TrafficSummary;

  @Column({ type: 'jsonb', name: 'raw_response', nullable: true })
  rawResponse: Record<string, unknown> | null;
}
