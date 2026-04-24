import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { HttpLogEntity } from '../entities/httpLog.entity';
import { HttpLogMapper } from '../mappers/httpLog.mapper';
import { HttpLog } from '../../../../domain/httpLog';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { HttpLogRepository } from '../../httpLog.repository';
import {
  FilterHttpLogDto,
  SortHttpLogDto,
} from '../../../../dto/query-httpLog.dto';

@Injectable()
export class HttpLogsRelationalRepository implements HttpLogRepository {
  constructor(
    @InjectRepository(HttpLogEntity)
    private readonly httpLogRepository: Repository<HttpLogEntity>,
  ) {}

  async create(
    data: Omit<HttpLog, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<HttpLog> {
    const persistenceModel = HttpLogMapper.toPersistence(data);
    const saved = await this.httpLogRepository.save(
      this.httpLogRepository.create(persistenceModel),
    );
    return HttpLogMapper.toDomain(saved);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterHttpLogDto | null;
    sortOptions?: SortHttpLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<HttpLog[]> {
    const where: FindOptionsWhere<HttpLogEntity> = {};

    if (filterOptions) {
      if (filterOptions.method) where.method = filterOptions.method;
      if (filterOptions.url) where.url = filterOptions.url;
      if (filterOptions.statusCode) where.statusCode = filterOptions.statusCode;
      if (filterOptions.userId) where.userId = filterOptions.userId;
      if (filterOptions.urlController)
        where.urlController = filterOptions.urlController;
      if (filterOptions.clientIp) where.clientIp = filterOptions.clientIp;
    }

    const entities = await this.httpLogRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.reduce(
        (acc, sort) => ({ ...acc, [sort.orderBy]: sort.order }),
        {},
      ) ?? { createdAt: 'DESC' },
    });

    return entities.map(HttpLogMapper.toDomain);
  }

  async findOne(id: HttpLog['id']): Promise<NullableType<HttpLog>> {
    const entity = await this.httpLogRepository.findOne({ where: { id } });
    return entity ? HttpLogMapper.toDomain(entity) : null;
  }
}
