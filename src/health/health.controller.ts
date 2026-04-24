import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gateway liveness probe' })
  check(): { status: string } {
    return { status: 'ok' };
  }
}
