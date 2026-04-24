import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalysisEntity } from './entities/ai-analysis.entity';
import { AiAnalysisRepository } from '../ai-analysis.repository';
import { AiAnalysisRelationalRepository } from './repositories/ai-analysis.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AiAnalysisEntity])],
  providers: [
    { provide: AiAnalysisRepository, useClass: AiAnalysisRelationalRepository },
  ],
  exports: [AiAnalysisRepository],
})
export class RelationalAiAnalysisPersistenceModule {}
