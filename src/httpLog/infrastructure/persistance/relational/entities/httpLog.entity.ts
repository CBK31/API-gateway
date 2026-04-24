import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { HttpMethod } from '../../../../domain/httpLog';

@Entity('httpLog')
export class HttpLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'uuid', name: 'request_id' })
  requestId: string;

  @Column({ type: 'varchar', length: 20, name: 'environment', nullable: true })
  environment: string | null;

  @Index()
  @Column({ type: 'bigint', name: 'org_id', nullable: true })
  orgId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'client_ip', nullable: true })
  clientIp: string | null;

  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'bigint', nullable: true })
  userId: number | null;

  @Column({ type: 'timestamptz', name: 'start_at', nullable: true })
  startAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'end_at', nullable: true })
  endAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  token: string | null;

  @Column({ type: 'enum', enum: HttpMethod })
  method: HttpMethod;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'jsonb', default: {} })
  query: Record<string, unknown>;

  @Index()
  @Column({ type: 'integer', name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column({ type: 'jsonb', default: {} })
  routeParams: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  requestBody: unknown;

  @Column({ type: 'integer' })
  responseTimeMs: number;

  @Column({ type: 'jsonb', nullable: true })
  responseBody: unknown;

  @Column({ type: 'text', name: 'raw_url' })
  rawUrl: string;

  @Index()
  @Column({ type: 'varchar', name: 'url_version' })
  urlVersion: string;

  @Index()
  @Column({ type: 'varchar', name: 'url_controller' })
  urlController: string;

  @Column({ type: 'text', name: 'url_end_point', nullable: true })
  urlEndPoint: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
