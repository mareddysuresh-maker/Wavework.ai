import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD || '';
const redisUrl = process.env.REDIS_URL || `redis://${redisPassword ? `:${redisPassword}@` : ''}${redisHost}:${redisPort}`;

let redisClient = null;
let useRedis = false;
let loggedRateLimiterError = false;

try {
  redisClient = new Redis(redisUrl, { 
    enableOfflineQueue: false, 
    maxRetriesPerRequest: 2 
  });
  
  redisClient.on('error', (err) => {
    if (!loggedRateLimiterError) {
      console.error('Redis connection error (rate limiter):', err.message);
      loggedRateLimiterError = true;
    }
    useRedis = false;
  });
  
  redisClient.on('ready', () => {
    useRedis = true;
    loggedRateLimiterError = false;
    console.log('[Rate Limiter] Redis client is ready.');
  });
} catch (err) {
  console.error('Redis initialization error (rate limiter):', err.message);
}

const authLimiterRedis = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_auth',
  points: 30,
  duration: 900,
  blockDuration: 900,
});

const authLimiterMemory = new RateLimiterMemory({
  keyPrefix: 'rl_auth',
  points: 30,
  duration: 900,
  blockDuration: 900,
});

const apiLimiterRedis = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_api',
  points: 500,
  duration: 60,
});

const apiLimiterMemory = new RateLimiterMemory({
  keyPrefix: 'rl_api',
  points: 500,
  duration: 60,
});

const chatLimiterRedis = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_chat',
  points: 150,
  duration: 60,
});

const chatLimiterMemory = new RateLimiterMemory({
  keyPrefix: 'rl_chat',
  points: 150,
  duration: 60,
});

const createMiddleware = (redisLimiter, memoryLimiter) => async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      await redisLimiter.consume(ip);
      next();
    } catch (rlRejected) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
  } else {
    try {
      await memoryLimiter.consume(ip);
      next();
    } catch (rlRejected) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
  }
};

export const authRateLimit = createMiddleware(authLimiterRedis, authLimiterMemory);
export const apiRateLimit = createMiddleware(apiLimiterRedis, apiLimiterMemory);
export const chatRateLimit = createMiddleware(chatLimiterRedis, chatLimiterMemory);
