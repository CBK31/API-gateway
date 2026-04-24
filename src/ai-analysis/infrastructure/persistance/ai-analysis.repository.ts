import { AiAnalysis } from '../../domain/ai-analysis';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';

export abstract class AiAnalysisRepository {
  abstract create(
    data: Omit<AiAnalysis, 'id' | 'createdAt'>,
  ): Promise<AiAnalysis>;

  abstract findManyWithPagination(
    opts: IPaginationOptions,
  ): Promise<AiAnalysis[]>;

  abstract findLatest(): Promise<NullableType<AiAnalysis>>;
}
