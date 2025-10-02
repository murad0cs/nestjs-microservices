import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'OK',
      service: 'Payment Service',
      timestamp: new Date().toISOString(),
    };
  }
}