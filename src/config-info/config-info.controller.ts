import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigInfoService, SafeGatewayConfig } from './config-info.service';

@ApiBearerAuth()
@ApiTags('Config')
@Controller({ path: 'config', version: '1' })
export class ConfigInfoController {
  constructor(private readonly service: ConfigInfoService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Read the gateway's currently-effective configuration (secrets stripped).",
  })
  read(): SafeGatewayConfig {
    return this.service.build();
  }
}
