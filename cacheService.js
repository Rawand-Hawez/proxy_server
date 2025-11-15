const redis = require('redis');
const crypto = require('crypto');

class CacheService {
  constructor(databaseService, options = {}) {
    this.db = databaseService;
    this.redisClient = null;
    this.redisEnabled = false;
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour
    this.cachePrefix = options.cachePrefix || 'proxy_server:';
    this.fallbackToDB = options.fallbackToDB !== false; // Default true
    this.redisConfig = options.redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
    };
  }

  async initialize() {
    // Skip Redis if environment variables are not set
    if (!process.env.REDIS_HOST) {
      console.log('Redis not configured, using database-only caching');
      this.redisEnabled = false;
      this.startCleanupTimer();
      return;
    }

    try {
      // Try to connect to Redis
      this.redisClient = redis.createClient({
        socket: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          reconnectStrategy: false, // Disable auto-reconnect
        },
        password: this.redisConfig.password,
        database: this.redisConfig.db,
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        this.redisEnabled = false;
      });

      this.redisClient.on('connect', () => {
        console.log('Connected to Redis');
        this.redisEnabled = true;
      });

      this.redisClient.on('end', () => {
        console.log('Redis connection ended');
        this.redisEnabled = false;
      });

      await this.redisClient.connect();
      
      // Test Redis connection
      await this.redisClient.ping();
      console.log('Redis cache service initialized successfully');
      
    } catch (error) {
      console.warn('Redis connection failed, falling back to database caching:', error.message);
      this.redisEnabled = false;
      if (this.redisClient) {
        try {
          await this.redisClient.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        this.redisClient = null;
      }
    }

    // Initialize cleanup timer
    this.startCleanupTimer();
  }

  // Generate cache key from endpoint and parameters
  generateCacheKey(endpoint, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    const keyData = `${endpoint}:${paramString}`;
    return this.cachePrefix + crypto.createHash('md5').update(keyData).digest('hex');
  }

  // Get data from cache
  async get(key) {
    try {
      if (this.redisEnabled && this.redisClient) {
        const data = await this.redisClient.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } else if (this.fallbackToDB) {
        return await this.db.getCache(key);
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set data in cache
  async set(key, data, ttl = null) {
    try {
      const ttlSeconds = ttl || this.defaultTTL;
      const dataString = JSON.stringify(data);

      if (this.redisEnabled && this.redisClient) {
        await this.redisClient.setEx(key, ttlSeconds, dataString);
        return true;
      } else if (this.fallbackToDB) {
        return await this.db.setCache('generic', key, data, ttlSeconds);
      }
      return false;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Delete data from cache
  async del(key) {
    try {
      if (this.redisEnabled && this.redisClient) {
        await this.redisClient.del(key);
        return true;
      } else if (this.fallbackToDB) {
        // For database fallback, we need to implement delete in database service
        // This is a simplified version - in a real implementation you'd want to track keys
        console.warn('Database cache delete not fully implemented');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Clear all cache entries with a specific pattern
  async clearPattern(pattern) {
    try {
      if (this.redisEnabled && this.redisClient) {
        const keys = await this.redisClient.keys(this.cachePrefix + pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
        return keys.length;
      } else if (this.fallbackToDB) {
        // For database fallback, clear expired cache entries
        return await this.db.clearExpiredCache();
      }
      return 0;
    } catch (error) {
      console.error('Cache clear pattern error:', error);
      return 0;
    }
  }

  // Cache wrapper for API endpoints
  async cacheWrapper(key, ttl, fetchFunction) {
    try {
      // Try to get from cache first
      let data = await this.get(key);
      
      if (data !== null) {
        console.log(`Cache HIT for key: ${key}`);
        return {
          data,
          fromCache: true,
          cached: true
        };
      }

      console.log(`Cache MISS for key: ${key}, fetching fresh data`);
      
      // Fetch fresh data
      const startTime = Date.now();
      data = await fetchFunction();
      const fetchTime = Date.now() - startTime;

      // Store in cache if we got data
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
        console.log(`Cached data for key: ${key} (fetch time: ${fetchTime}ms)`);
      }

      return {
        data,
        fromCache: false,
        fetchTime,
        cached: true
      };
    } catch (error) {
      console.error('Cache wrapper error:', error);
      // If cache fails, try to fetch directly
      try {
        const data = await fetchFunction();
        return {
          data,
          fromCache: false,
          cached: false,
          error: error.message
        };
      } catch (fetchError) {
        console.error('Fetch function also failed:', fetchError);
        throw fetchError;
      }
    }
  }

  // Smart cache key generation for different endpoint types
  generateEndpointCacheKey(req, additionalParams = {}) {
    const endpoint = req.path;
    const method = req.method;
    const queryParams = { ...req.query, ...additionalParams };
    
    // Include body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
      queryParams.body = req.body;
    }

    return this.generateCacheKey(`${method}:${endpoint}`, queryParams);
  }

  // Get cache statistics
  async getStats() {
    const stats = {
      redis: {
        enabled: this.redisEnabled,
        connected: this.redisEnabled && this.redisClient?.isReady || false,
      },
      fallback: {
        enabled: this.fallbackToDB,
        type: 'database'
      },
      config: {
        defaultTTL: this.defaultTTL,
        cachePrefix: this.cachePrefix
      }
    };

    try {
      if (this.redisEnabled && this.redisClient?.isReady) {
        const redisInfo = await this.redisClient.info('memory');
        const dbInfo = await this.redisClient.dbSize();
        
        stats.redis.memory = this.parseRedisInfo(redisInfo);
        stats.redis.dbSize = dbInfo;
      }
      
      // Get database stats if available
      if (this.fallbackToDB) {
        stats.database = await this.db.getDatabaseStats();
      }
    } catch (error) {
      console.error('Error getting cache stats:', error);
    }

    return stats;
  }

  // Parse Redis INFO command output
  parseRedisInfo(infoString) {
    const lines = infoString.split('\n');
    const info = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        info[key.trim()] = value.trim();
      }
    }
    
    return info;
  }

  // Health check for cache service
  async healthCheck() {
    const health = {
      status: 'healthy',
      redis: {
        enabled: this.redisEnabled,
        connected: false
      },
      database: {
        available: false
      },
      timestamp: new Date().toISOString()
    };

    try {
      // Test Redis
      if (this.redisEnabled && this.redisClient?.isReady) {
        await this.redisClient.ping();
        health.redis.connected = true;
      }
      
      // Test database
      if (this.fallbackToDB && this.db?.initialized) {
        await this.db.getQuery('SELECT 1');
        health.database.available = true;
      }

      if (!health.redis.connected && !health.database.available) {
        health.status = 'unhealthy';
      }
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }

  // Start automatic cleanup timer
  startCleanupTimer() {
    // Clean up every 30 minutes
    setInterval(async () => {
      try {
        if (this.fallbackToDB) {
          await this.db.cleanup();
        }
      } catch (error) {
        console.error('Cache cleanup error:', error);
      }
    }, 30 * 60 * 1000);
  }

  // Graceful shutdown
  async shutdown() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      console.log('Cache service shutdown complete');
    } catch (error) {
      console.error('Error during cache service shutdown:', error);
    }
  }

  // Predefined cache strategies for different endpoints
  getCacheStrategy(endpoint, method = 'GET') {
    const strategies = {
      // TopCare APIs - cache for 30 minutes
      '/api/': { ttl: 1800, priority: 'medium' },
      
      // Erbil Avenue APIs - cache for 30 minutes
      '/erbil-avenue/': { ttl: 1800, priority: 'medium' },
      
      // Odoo endpoints - cache for 3 Hrs
      '/odoo/': { ttl: 10800, priority: 'high' },
      
      // Data extraction endpoints - cache for 3 Hrs
      '/extract/': { ttl: 10800, priority: 'low' },
      
      // Health check - cache for 1 minute
      '/': { ttl: 60, priority: 'low' },
    };

    // Find matching strategy
    for (const [pattern, config] of Object.entries(strategies)) {
      if (endpoint.startsWith(pattern)) {
        return config;
      }
    }

    // Default strategy
    return { ttl: 300, priority: 'medium' }; // 5 minutes
  }

  // Conditional caching based on response size and frequency
  async smartCache(endpoint, data, frequency = 1) {
    const dataSize = JSON.stringify(data).length;
    const shouldCache = frequency > 1 || dataSize < 1024 * 1024; // Cache if accessed multiple times or under 1MB
    
    if (!shouldCache) {
      return false;
    }

    const strategy = this.getCacheStrategy(endpoint);
    return strategy.ttl;
  }
}

module.exports = CacheService;