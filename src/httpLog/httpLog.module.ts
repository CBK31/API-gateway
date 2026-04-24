import { Module } from '@nestjs/common';

import { HttpLogsController } from './httpLog.controller';
import { HttpLogsService } from './httpLog.service';
import { RelationalHttpLogPersistenceModule } from './infrastructure/persistance/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalHttpLogPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [HttpLogsController],
  providers: [HttpLogsService],
  exports: [HttpLogsService, infrastructurePersistenceModule],
})
export class HttpLogsModule {}
