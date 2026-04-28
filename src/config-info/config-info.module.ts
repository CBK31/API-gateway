import { Module } from '@nestjs/common';
import { ConfigInfoController } from './config-info.controller';
import { ConfigInfoService } from './config-info.service';

@Module({
  controllers: [ConfigInfoController],
  providers: [ConfigInfoService],
})
export class ConfigInfoModule {}
