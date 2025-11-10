/**
 * Rate Limiter Port - interface for rate limiting operations
 * This abstraction allows us to swap rate limiting implementations
 */

export type RateLimitCategory = 'read' | 'write' | 'writeContent' | 'listDocs' | 'analytics';

export interface RateLimiterPort {
  /**
   * Schedule a function to be executed with rate limiting
   * @param category The rate limit category to apply
   * @param fn The function to execute
   * @returns Promise with the result of the function
   */
  schedule<T>(category: RateLimitCategory, fn: () => Promise<T>): Promise<T>;

  /**
   * Get current number of queued requests
   */
  getQueuedCount(category: RateLimitCategory): number;

  /**
   * Get current number of running requests
   */
  getRunningCount(category: RateLimitCategory): number;

  /**
   * Clear all queued requests for a category
   */
  clearQueue(category: RateLimitCategory): void;
}


