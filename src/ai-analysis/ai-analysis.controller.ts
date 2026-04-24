import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysis } from './domain/ai-analysis';
import { infinityPagination } from '../utils/infinity-pagination';
import { InfinityPaginationResultType } from '../utils/types/infinity-pagination-result.type';
import { NullableType } from '../utils/types/nullable.type';

class ListAiAnalysisQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

@ApiBearerAuth()
@ApiTags('AiAnalysis')
@Controller({ path: 'ai-analysis', version: '1' })
export class AiAnalysisController {
  constructor(private readonly service: AiAnalysisService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List AI traffic-analysis verdicts (newest first)',
  })
  async findAll(
    @Query() query: ListAiAnalysisQueryDto,
  ): Promise<InfinityPaginationResultType<AiAnalysis>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;
    return infinityPagination(
      await this.service.findManyWithPagination({ page, limit }),
      { page, limit },
    );
  }

  @Get('latest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch the most recent AI analysis verdict' })
  findLatest(): Promise<NullableType<AiAnalysis>> {
    return this.service.findLatest();
  }

  @Post('run-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger an AI analysis immediately (admin-style, bypasses cron)',
  })
  runNow(): Promise<NullableType<AiAnalysis>> {
    return this.service.runOnce();
  }
}
