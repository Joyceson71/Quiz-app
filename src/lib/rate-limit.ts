export class RateLimit {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public check(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];
    
    // Filter out old timestamps
    const validTimestamps = timestamps.filter(time => now - time < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validTimestamps.push(now);
    this.requests.set(ip, validTimestamps);
    
    return true;
  }
}

// Global rate limiter instance (e.g. 100 requests per minute)
export const globalRateLimiter = new RateLimit(100, 60000);
