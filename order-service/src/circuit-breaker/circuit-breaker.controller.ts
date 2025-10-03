import { Controller, Get, Post, Param, HttpException, HttpStatus } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

@Controller('circuit-breaker')
export class CircuitBreakerController {
  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  @Get('stats')
  getStats() {
    const stats = this.circuitBreakerService.getAllBreakerStats();
    return {
      success: true,
      data: stats,
      summary: {
        total: stats.length,
        open: stats.filter(s => s?.state === 'open').length,
        halfOpen: stats.filter(s => s?.state === 'half-open').length,
        closed: stats.filter(s => s?.state === 'closed').length,
      },
    };
  }

  @Get('stats/:name')
  getBreakerStats(@Param('name') name: string) {
    const stats = this.circuitBreakerService.getBreakerStats(name);
    if (!stats) {
      throw new HttpException(
        `Circuit breaker ${name} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      data: stats,
    };
  }

  @Post('reset/:name')
  resetBreaker(@Param('name') name: string) {
    const result = this.circuitBreakerService.resetBreaker(name);
    if (!result) {
      throw new HttpException(
        `Circuit breaker ${name} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      message: `Circuit breaker ${name} has been reset`,
    };
  }
}