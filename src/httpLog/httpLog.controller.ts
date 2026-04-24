import {
  Controller,
  HttpStatus,
  HttpCode,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { HttpLog } from './domain/httpLog';
import { HttpLogsService } from './httpLog.service';
import { QueryHttpLogDto } from './dto/query-httpLog.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { InfinityPaginationResultType } from '../utils/types/infinity-pagination-result.type';
import { NullableType } from '../utils/types/nullable.type';

@ApiBearerAuth()
@ApiTags('HttpLogs')
@Controller({
  path: 'http-logs',
  version: '1',
})
export class HttpLogsController {
  constructor(private readonly service: HttpLogsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List captured HTTP logs (paginated, newest first)' })
  async findAll(
    @Query() query: QueryHttpLogDto,
  ): Promise<InfinityPaginationResultType<HttpLog>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.service.findManyWithPagination({
        filterOptions: query?.filters ?? null,
        sortOptions: query?.sort ?? null,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch a single HTTP log by id' })
  @ApiParam({ name: 'id', type: Number, required: true })
  findOne(@Param('id') id: HttpLog['id']): Promise<NullableType<HttpLog>> {
    return this.service.findOne(id);
  }
}
