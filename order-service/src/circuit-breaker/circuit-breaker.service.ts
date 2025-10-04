import { Injectable, Logger } from '@nestjs/common';
const CircuitBreaker = require('opossum');

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  name?: string;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, any>();

  createBreaker<T>(
    name: string,
    action: (...args: any[]) => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): any {
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      return existingBreaker;
    }

    const defaultOptions = {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 10000, // Count errors over 10 seconds
      rollingCountBuckets: 10, // Number of buckets to track
      name,
    };

    const breaker = new CircuitBreaker(action, { ...defaultOptions, ...options });

    // Circuit breaker event listeners
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker ${name} is OPEN - stopping requests`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker ${name} is HALF-OPEN - testing with single request`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker ${name} is CLOSED - normal operation resumed`);
    });

    breaker.on('fire', () => {
      this.logger.debug(`Circuit breaker ${name} fired a request`);
    });

    breaker.on('failure', (error) => {
      this.logger.error(`Circuit breaker ${name} request failed: ${error.message}`);
    });

    breaker.on('timeout', () => {
      this.logger.error(`Circuit breaker ${name} request timed out`);
    });

    breaker.on('reject', () => {
      this.logger.warn(`Circuit breaker ${name} rejected request - circuit is open`);
    });

    breaker.on('success', (result) => {
      this.logger.debug(`Circuit breaker ${name} request succeeded`);
    });

    // Fallback function when circuit is open
    breaker.fallback((error, args) => {
      this.logger.warn(`Circuit breaker ${name} fallback triggered: ${error?.message || 'Circuit open'}`);
      return {
        error: true,
        message: `Service temporarily unavailable (Circuit breaker ${name} is open)`,
        circuitBreakerStatus: typeof breaker.stats === 'function' ? breaker.stats() : 'unavailable',
      };
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): any {
    return this.breakers.get(name);
  }

  getBreakerStats(name: string): any {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    try {
      return {
        name,
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
        stats: typeof breaker.stats === 'function' ? breaker.stats() : {},
        enabled: breaker.enabled || false,
        warmUp: breaker.warmUp || 0,
        volumeThreshold: breaker.volumeThreshold || 0,
      };
    } catch (error) {
      this.logger.error(`Error getting stats for breaker ${name}:`, error);
      return {
        name,
        state: 'unknown',
        stats: {},
        error: error.message,
      };
    }
  }

  getAllBreakerStats(): any[] {
    const stats: any[] = [];
    for (const [name, breaker] of this.breakers) {
      stats.push(this.getBreakerStats(name));
    }
    return stats;
  }

  resetBreaker(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return false;
    }
    breaker.clearCache();
    breaker.close();
    this.logger.log(`Circuit breaker ${name} has been manually reset`);
    return true;
  }
}