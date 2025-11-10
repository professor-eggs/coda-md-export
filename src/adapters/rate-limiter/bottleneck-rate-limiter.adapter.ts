/**
 * Bottleneck Rate Limiter Adapter - implements RateLimiterPort using Bottleneck
 * 
 * Coda API Rate Limits (as of documentation):
 * - Reading data: 100 requests per 6 seconds
 * - Writing data (POST/PUT/PATCH): 10 requests per 6 seconds
 * - Writing doc content data (POST/PUT/PATCH): 5 requests per 10 seconds
 * - Listing docs: 4 requests per 6 seconds
 * - Reading analytics: 100 requests per 6 seconds
 */

import Bottleneck from 'bottleneck';
import { RateLimiterPort, RateLimitCategory } from '../../domain/ports/rate-limiter.port';

interface RateLimitConfig {
  maxConcurrent: number; // Max concurrent requests
  minTime: number; // Minimum time between requests (ms)
  reservoir: number; // Max requests per reservoir interval
  reservoirRefreshAmount: number; // Requests to add when refreshing
  reservoirRefreshInterval: number; // Interval to refresh reservoir (ms)
}

/**
 * Rate limit configurations for each category
 * Using conservative limits with buffer for safety
 */
const RATE_LIMIT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  // Reading data: 100 req/6s = ~16.67 req/s, use 90 req/6s for safety
  read: {
    maxConcurrent: 5,
    minTime: 0,
    reservoir: 90,
    reservoirRefreshAmount: 90,
    reservoirRefreshInterval: 6000,
  },
  // Writing data: 10 req/6s = ~1.67 req/s, use 9 req/6s for safety
  write: {
    maxConcurrent: 2,
    minTime: 0,
    reservoir: 9,
    reservoirRefreshAmount: 9,
    reservoirRefreshInterval: 6000,
  },
  // Writing doc content: 5 req/10s = 0.5 req/s, use 4 req/10s for safety
  writeContent: {
    maxConcurrent: 1,
    minTime: 0,
    reservoir: 4,
    reservoirRefreshAmount: 4,
    reservoirRefreshInterval: 10000,
  },
  // Listing docs: 4 req/6s = ~0.67 req/s, use 3 req/6s for safety
  listDocs: {
    maxConcurrent: 1,
    minTime: 0,
    reservoir: 3,
    reservoirRefreshAmount: 3,
    reservoirRefreshInterval: 6000,
  },
  // Analytics: Same as read for now
  analytics: {
    maxConcurrent: 5,
    minTime: 0,
    reservoir: 90,
    reservoirRefreshAmount: 90,
    reservoirRefreshInterval: 6000,
  },
};

export class BottleneckRateLimiterAdapter implements RateLimiterPort {
  private readonly limiters: Map<RateLimitCategory, Bottleneck>;

  constructor() {
    this.limiters = new Map();

    // Initialize a limiter for each category
    for (const [category, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
      const limiter = new Bottleneck({
        maxConcurrent: config.maxConcurrent,
        minTime: config.minTime,
        reservoir: config.reservoir,
        reservoirRefreshAmount: config.reservoirRefreshAmount,
        reservoirRefreshInterval: config.reservoirRefreshInterval,
      });

      // Add error handling
      limiter.on('error', (error) => {
        console.error(`[RateLimiter] Error in ${category} limiter:`, error);
      });

      // Note: We don't implement automatic retries here
      // Retries should be handled at the service/application level
      // where we have more context about what should be retried

      this.limiters.set(category as RateLimitCategory, limiter);
    }
  }

  async schedule<T>(category: RateLimitCategory, fn: () => Promise<T>): Promise<T> {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      throw new Error(`Unknown rate limit category: ${category}`);
    }

    return limiter.schedule(fn);
  }

  getQueuedCount(category: RateLimitCategory): number {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      throw new Error(`Unknown rate limit category: ${category}`);
    }

    return limiter.counts().QUEUED;
  }

  getRunningCount(category: RateLimitCategory): number {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      throw new Error(`Unknown rate limit category: ${category}`);
    }

    return limiter.counts().RUNNING;
  }

  clearQueue(category: RateLimitCategory): void {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      throw new Error(`Unknown rate limit category: ${category}`);
    }

    // Stop accepting new jobs and cancel queued ones
    void limiter.stop({ dropWaitingJobs: true });

    // Restart the limiter
    const config = RATE_LIMIT_CONFIGS[category];
    const newLimiter = new Bottleneck({
      maxConcurrent: config.maxConcurrent,
      minTime: config.minTime,
      reservoir: config.reservoir,
      reservoirRefreshAmount: config.reservoirRefreshAmount,
      reservoirRefreshInterval: config.reservoirRefreshInterval,
    });

    this.limiters.set(category, newLimiter);
  }

  /**
   * Clean up all limiters (for testing)
   */
  async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const limiter of this.limiters.values()) {
      promises.push(limiter.stop({ dropWaitingJobs: true }));
    }
    await Promise.all(promises);
  }
}

