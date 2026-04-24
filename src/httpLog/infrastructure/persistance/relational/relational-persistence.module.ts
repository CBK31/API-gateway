import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpLogEntity } from './entities/httpLog.entity';
import { HttpLogRepository } from '../httpLog.repository';
import { HttpLogsRelationalRepository } from './repositories/httpLog.repository';

@Module({
  imports: [TypeOrmModule.forFeature([HttpLogEntity])],
  providers: [
    {
      provide: HttpLogRepository,
      useClass: HttpLogsRelationalRepository,
    },
  ],
  exports: [HttpLogRepository],
})
export class RelationalHttpLogPersistenceModule {}
