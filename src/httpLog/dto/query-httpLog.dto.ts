import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { HttpMethod, HttpLog } from '../domain/httpLog';

export class FilterHttpLogDto {
  @ApiPropertyOptional({ enum: HttpMethod })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @ApiPropertyOptional({ example: '/api/v1/echo' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ example: 'echo' })
  @IsOptional()
  @IsString()
  urlController?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  clientIp?: string;
}

export class SortHttpLogDto {
  @IsString()
  orderBy: keyof HttpLog;

  @IsString()
  order: 'ASC' | 'DESC';
}

export class QueryHttpLogDto {
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
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ type: FilterHttpLogDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterHttpLogDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  filters?: FilterHttpLogDto;

  @ApiPropertyOptional({
    type: [SortHttpLogDto],
    example: [{ orderBy: 'createdAt', order: 'DESC' }],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SortHttpLogDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  sort?: SortHttpLogDto[];
}
