import { HttpLog } from '../../domain/httpLog';
import { FilterHttpLogDto, SortHttpLogDto } from '../../dto/query-httpLog.dto';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';

export abstract class HttpLogRepository {
  abstract create(
    data: Omit<HttpLog, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<HttpLog>;

  abstract createMany(
    data: Omit<HttpLog, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[],
  ): Promise<void>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterHttpLogDto | null;
    sortOptions?: SortHttpLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<HttpLog[]>;

  abstract findOne(id: HttpLog['id']): Promise<NullableType<HttpLog>>;
}
