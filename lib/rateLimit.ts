import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: NextRequest) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  keyGenerator: (request: NextRequest) => {
    // Use IP address as default key
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return ip;
  }
};

export function rateLimit(customConfig?: Partial<RateLimitConfig>) {
  const config = { ...defaultConfig, ...customConfig };
  
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const key = config.keyGenerator!(request);
    const now = Date.now();
    
    // Get or initialize rate limit data for this key
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      rateLimitStore[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }
    
    const limitData = rateLimitStore[key];
    
    // Check if limit exceeded
    if (limitData.count >= config.maxRequests) {
      const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          retryAfter: retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(limitData.resetTime).toISOString()
          }
        }
      );
    }
    
    // Increment counter before processing request
    limitData.count++;
    
    // Process the request
    try {
      const response = await handler(request);
      
      // Add rate limit headers to response
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      headers.set('X-RateLimit-Remaining', (config.maxRequests - limitData.count).toString());
      headers.set('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());
      
      // Create new response with updated headers
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      // If skipFailedRequests is true, decrement the counter
      if (config.skipFailedRequests) {
        limitData.count--;
      }
      throw error;
    }
  };
}

// Specialized rate limiters for different endpoints
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // 10 requests per minute for sensitive operations
});

export const moderateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30 // 30 requests per minute for normal operations
});

export const relaxedRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  maxRequests: 60 // 60 requests per minute for read operations
});