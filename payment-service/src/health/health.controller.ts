import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
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
