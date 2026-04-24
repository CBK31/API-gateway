import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpLogEntity } from '../httpLog/infrastructure/persistance/relational/entities/httpLog.entity';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisCron } from './ai-analysis.cron';
import { AiAnalysisService } from './ai-analysis.service';
import { AiClientService } from './services/ai-client.service';
import { TrafficSummaryService } from './services/traffic-summary.service';
import { RelationalAiAnalysisPersistenceModule } from './infrastructure/persistance/relational/relational-persistence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HttpLogEntity]),
    RelationalAiAnalysisPersistenceModule,
  ],
  controllers: [AiAnalysisController],
  providers: [
    AiAnalysisService,
    AiClientService,
    TrafficSummaryService,
    AiAnalysisCron,
  ],
  exports: [AiAnalysisService],
})
export class AiAnalysisModule {}
