import { Injectable } from '@nestjs/common';

import { HttpLogRepository } from './infrastructure/persistance/httpLog.repository';
import { HttpLog } from './domain/httpLog';
import { FilterHttpLogDto, SortHttpLogDto } from './dto/query-httpLog.dto';
import { NullableType } from '../utils/types/nullable.type';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class HttpLogsService {
  constructor(private readonly httpLogRepository: HttpLogRepository) {}

  create(
    data: Omit<HttpLog, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<HttpLog> {
    return this.httpLogRepository.create(data);
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterHttpLogDto | null;
    sortOptions?: SortHttpLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<HttpLog[]> {
    return this.httpLogRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findOne(id: HttpLog['id']): Promise<NullableType<HttpLog>> {
    return this.httpLogRepository.findOne(id);
  }
}
