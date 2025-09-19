interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheInvalidationRule {
  pattern: string;
  invalidateOn: string[];
}

class SmartCache {
  private storage: Storage | null;
  private prefix: string = 'irc_cache_';
  
  // Cache invalidation rules
  private invalidationRules: CacheInvalidationRule[] = [
    {
      pattern: 'channels_*',
      invalidateOn: ['channel_created', 'channel_deleted', 'channel_updated']
    },
    {
      pattern: 'categories_*',
      invalidateOn: ['category_created', 'category_deleted', 'category_updated']
    },
    {
      pattern: 'members_*',
      invalidateOn: ['member_joined', 'member_left', 'role_changed']
    },
    {
      pattern: 'unread_*',
      invalidateOn: ['message_sent', 'message_read', 'mention_read']
    }
  ];

  constructor(useSessionStorage = false) {
    this.storage = typeof window !== 'undefined' 
      ? (useSessionStorage ? sessionStorage : localStorage)
      : null;
  }

  /**
   * Set cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    if (!this.storage) return;

    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };

    try {
      this.storage.setItem(
        this.prefix + key, 
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.warn('Cache storage failed:', error);
      // Fallback: clear some old cache if storage is full
      this.cleanup();
    }
  }

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    if (!this.storage) return null;

    try {
      const cached = this.storage.getItem(this.prefix + key);
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
        this.delete(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
      this.delete(key);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    if (!this.storage) return;
    this.storage.removeItem(this.prefix + key);
  }

  /**
   * Smart cache invalidation based on events
   */
  invalidate(event: string): void {
    if (!this.storage) return;

    this.invalidationRules.forEach(rule => {
      if (rule.invalidateOn.includes(event)) {
        this.deleteByPattern(rule.pattern);
      }
    });
  }

  /**
   * Delete cache entries matching pattern
   */
  private deleteByPattern(pattern: string): void {
    if (!this.storage) return;

    const keys = Object.keys(this.storage)
      .filter(key => key.startsWith(this.prefix))
      .map(key => key.substring(this.prefix.length));

    keys.forEach(key => {
      if (this.matchesPattern(key, pattern)) {
        this.delete(key);
      }
    });
  }

  /**
   * Check if key matches pattern with context
   */
  private matchesPattern(key: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(key);
    }
    return key === pattern;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    if (!this.storage) return;

    const keysToDelete: string[] = [];
    
    for (let i = 0; i < this.storage.length; i++) {
      const fullKey = this.storage.key(i);
      if (!fullKey || !fullKey.startsWith(this.prefix)) continue;

      const key = fullKey.substring(this.prefix.length);
      try {
        const cached = this.storage.getItem(fullKey);
        if (!cached) continue;

        const cacheItem: CacheItem<unknown> = JSON.parse(cached);
        if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
          keysToDelete.push(key);
        }
      } catch {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.storage?.removeItem(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalItems: number; totalSize: number; expiredItems: number } {
    if (!this.storage) return { totalItems: 0, totalSize: 0, expiredItems: 0 };

    let totalItems = 0;
    let totalSize = 0;
    let expiredItems = 0;

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.prefix)) continue;

      const value = this.storage.getItem(key);
      if (!value) continue;

      totalItems++;
      totalSize += value.length;

      try {
        const cacheItem: CacheItem<unknown> = JSON.parse(value);
        if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
          expiredItems++;
        }
      } catch {
        expiredItems++;
      }
    }

    return { totalItems, totalSize, expiredItems };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    if (!this.storage) return;

    const keysToDelete: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.storage?.removeItem(key));
  }
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  CATEGORIES: 30 * 60 * 1000,     // 30 minutes
  CHANNELS: 30 * 60 * 1000,       // 30 minutes
  MEMBERS: 5 * 60 * 1000,         // 5 minutes
  ROLES: 5 * 60 * 1000,           // 5 minutes
  USER_PROFILE: 60 * 60 * 1000,   // 1 hour
  UNREAD_COUNTS: 30 * 1000,       // 30 seconds
  MENTIONS: 30 * 1000,            // 30 seconds
  MESSAGES: 2 * 60 * 1000,        // 2 minutes
} as const;

// Export singleton instance
export const cache = new SmartCache(false); // Use localStorage
export const sessionCache = new SmartCache(true); // Use sessionStorage

// Utility functions for common caching patterns
export const cacheHelpers = {
  /**
   * Cached API call wrapper
   */
  async cachedCall<T>(
    cacheKey: string,
    apiCall: () => Promise<T>,
    ttl: number,
    useSessionCache = false
  ): Promise<T> {
    const cacheInstance = useSessionCache ? sessionCache : cache;
    
    // Try cache first
    const cached = cacheInstance.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Make API call and cache result
    const result = await apiCall();
    cacheInstance.set(cacheKey, result, ttl);
    return result;
  },

  /**
   * Generate cache key for user-specific data
   */
  userKey(userId: string, base: string): string {
    return `${base}_user_${userId}`;
  },

  /**
   * Generate cache key for channel-specific data
   */
  channelKey(channelId: string, base: string): string {
    return `${base}_channel_${channelId}`;
  }
};