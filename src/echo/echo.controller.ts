import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Echo')
@Controller({
  path: 'echo',
  version: '1',
})
export class EchoController {
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Echo back the JSON body (used for testing logging)',
  })
  @ApiBody({
    schema: { type: 'object', additionalProperties: true },
    examples: {
      simple: { value: { message: 'hello' } },
      withSecrets: {
        value: {
          username: 'alice',
          password: 'super-secret',
          card_number: '4242424242424242',
        },
      },
    },
  })
  echo(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }
}
