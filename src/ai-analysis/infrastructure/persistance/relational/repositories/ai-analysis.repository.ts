import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAnalysisEntity } from '../entities/ai-analysis.entity';
import { AiAnalysisMapper } from '../mappers/ai-analysis.mapper';
import { AiAnalysis } from '../../../../domain/ai-analysis';
import { AiAnalysisRepository } from '../../ai-analysis.repository';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AiAnalysisRelationalRepository implements AiAnalysisRepository {
  constructor(
    @InjectRepository(AiAnalysisEntity)
    private readonly repo: Repository<AiAnalysisEntity>,
  ) {}

  async create(
    data: Omit<AiAnalysis, 'id' | 'createdAt'>,
  ): Promise<AiAnalysis> {
    const entity = AiAnalysisMapper.toPersistence(data);
    const saved = await this.repo.save(this.repo.create(entity));
    return AiAnalysisMapper.toDomain(saved);
  }

  async findManyWithPagination(
    opts: IPaginationOptions,
  ): Promise<AiAnalysis[]> {
    const rows = await this.repo.find({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return rows.map(AiAnalysisMapper.toDomain);
  }

  async findLatest(): Promise<NullableType<AiAnalysis>> {
    const row = await this.repo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
    return row ? AiAnalysisMapper.toDomain(row) : null;
  }
}
