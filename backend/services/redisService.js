import Redis from 'ioredis';

const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD || undefined;

const redisOptions = {
  host,
  port,
  password,
  retryStrategy: (times) => {
    // Spacer connection retries to 10 seconds to eliminate CPU cycling under offline conditions
    return 10000;
  },
  maxRetriesPerRequest: null, // Critical requirement for @socket.io/redis-adapter
};

let redisClient = null;
let pubClient = null;
let subClient = null;
let redisConnected = false;

// Track connection error logs to avoid spamming process stdout/stderr
const loggedErrors = new Set();

export function isRedisAvailable() {
  return redisConnected && redisClient && redisClient.status === 'ready';
}

export function initRedis() {
  if (redisClient) return { redisClient, pubClient, subClient };

  try {
    console.log(`[Redis] Attempting connection to Redis at ${host}:${port}...`);
    
    redisClient = new Redis(redisOptions);
    pubClient = new Redis(redisOptions);
    subClient = new Redis(redisOptions);

    const handleError = (label) => (err) => {
      const errKey = `${label}:${err.code || err.message}`;
      if (!loggedErrors.has(errKey)) {
        console.warn(`[Redis] ${label} connection issue (silent in-memory fallback active):`, err.message);
        loggedErrors.add(errKey);
      }
      redisConnected = false;
    };

    redisClient.on('error', handleError('Client'));
    pubClient.on('error', handleError('PubClient'));
    subClient.on('error', handleError('SubClient'));

    redisClient.on('connect', () => {
      // Don't issue multiple connect prints if already acknowledged
      const hasLoggedConnect = loggedErrors.has('connect');
      if (!hasLoggedConnect) {
        console.log('[Redis] Core client initiated connection sequence.');
        loggedErrors.add('connect');
      }
    });

    redisClient.on('ready', () => {
      redisConnected = true;
      console.log('[Redis] Connection established. Core client is ready.');
      loggedErrors.clear(); // Reset warning caches for graceful reconnect logging
    });

    return { redisClient, pubClient, subClient };
  } catch (error) {
    console.error('[Redis] Early initialization failure:', error.message);
    redisConnected = false;
    return { redisClient: null, pubClient: null, subClient: null };
  }
}

// Ensure initial configuration
initRedis();

// High-Fidelity Local Stateful Fallbacks (Activated when Redis is offline)
const fallbackPresenceHeartbeats = new Map(); // key: workspaceId:userId -> expiration timestamp
const fallbackPresenceSets = new Map(); // key: workspaceId -> Set of userIds
const fallbackMessagesCache = new Map(); // key: channelId -> array of messages
const fallbackTypingMap = new Map(); // key: channelId:userId -> expiration timestamp

export const redisService = {
  getClient: () => redisClient,
  getPubClient: () => pubClient,
  getSubClient: () => subClient,

  // Pub/Sub Channels Resolver
  resolvePubSubChannel: (channel) => {
    if (!channel) return '';
    if (channel.isDM) {
      const sortedUsers = [...(channel.memberIds || [])].sort();
      const u1 = sortedUsers[0] || 'unknown1';
      const u2 = sortedUsers[1] || 'unknown2';
      return `dm:${u1}:${u2}`;
    } else if (channel.isGroup) {
      return `group:${channel.id}`;
    } else {
      return `channel:${channel.id}`;
    }
  },

  // 1. Publish to Redis Pub/Sub
  publishMessage: async (channelObj, messageObj) => {
    if (!isRedisAvailable()) return false;
    try {
      const channelName = redisService.resolvePubSubChannel(channelObj);
      if (!channelName) return false;
      
      console.log(`[Redis Pub] Publishing message to channel: ${channelName}`);
      await pubClient.publish(channelName, JSON.stringify({
        channelName,
        message: messageObj
      }));
      return true;
    } catch (err) {
      console.error('[Redis Pub] Publish error:', err.message);
      return false;
    }
  },

  // 3. Presence Tracking (Online/Away/Offline)
  setUserHeartbeat: async (workspaceId, userId) => {
    if (isRedisAvailable()) {
      try {
        const key = `presence_heartbeat:${workspaceId}:${userId}`;
        await redisClient.set(key, 'online', 'EX', 30);
        await redisClient.sadd(`presence:${workspaceId}`, userId);
        return;
      } catch (err) {
        console.warn('[Redis Presence] Set heartbeat error:', err.message);
      }
    }

    // Stateful Memory Fallback
    const now = Date.now();
    fallbackPresenceHeartbeats.set(`${workspaceId}:${userId}`, now + 30000); // 30s TTL
    if (!fallbackPresenceSets.has(workspaceId)) {
      fallbackPresenceSets.set(workspaceId, new Set());
    }
    fallbackPresenceSets.get(workspaceId).add(userId);
  },

  setUserOffline: async (workspaceId, userId) => {
    if (isRedisAvailable()) {
      try {
        const key = `presence_heartbeat:${workspaceId}:${userId}`;
        await redisClient.del(key);
        await redisClient.srem(`presence:${workspaceId}`, userId);
        return;
      } catch (err) {
        console.warn('[Redis Presence] Set offline error:', err.message);
      }
    }

    // Stateful Memory Fallback
    fallbackPresenceHeartbeats.delete(`${workspaceId}:${userId}`);
    if (fallbackPresenceSets.has(workspaceId)) {
      fallbackPresenceSets.get(workspaceId).delete(userId);
    }
  },

  getOnlineUsers: async (workspaceId) => {
    if (isRedisAvailable()) {
      try {
        const members = await redisClient.smembers(`presence:${workspaceId}`);
        if (!members || members.length === 0) return [];

        const activeIds = [];
        const pipeline = redisClient.pipeline();

        for (const userId of members) {
          pipeline.exists(`presence_heartbeat:${workspaceId}:${userId}`);
        }

        const results = await pipeline.exec();

        for (let i = 0; i < members.length; i++) {
          const userId = members[i];
          const exists = results[i][1]; // result of exists command
          if (exists) {
            activeIds.push(userId);
          } else {
            // clean up expired user from set
            await redisClient.srem(`presence:${workspaceId}`, userId).catch(() => {});
          }
        }

        return activeIds;
      } catch (err) {
        console.warn('[Redis Presence] Get online users error:', err.message);
      }
    }

    // Stateful Memory Fallback
    const now = Date.now();
    const activeIds = [];
    const set = fallbackPresenceSets.get(workspaceId);
    if (set) {
      for (const userId of set) {
        const exp = fallbackPresenceHeartbeats.get(`${workspaceId}:${userId}`);
        if (exp && exp > now) {
          activeIds.push(userId);
        } else {
          set.delete(userId);
          fallbackPresenceHeartbeats.delete(`${workspaceId}:${userId}`);
        }
      }
    }
    return activeIds;
  },

  // 4. Message Caching (LPUSH + LTRIM, 1 hour TTL)
  cacheMessage: async (channelId, messageObj) => {
    if (isRedisAvailable()) {
      try {
        const cacheKey = `messages:${channelId}`;
        await redisClient.lpush(cacheKey, JSON.stringify(messageObj));
        await redisClient.ltrim(cacheKey, 0, 49); // Cache last 50 messages
        await redisClient.expire(cacheKey, 3600); // 1 hour TTL
        return;
      } catch (err) {
        console.warn('[Redis Cache] Cache message error:', err.message);
      }
    }

    // Stateful Memory Fallback
    if (!fallbackMessagesCache.has(channelId)) {
      fallbackMessagesCache.set(channelId, []);
    }
    const list = fallbackMessagesCache.get(channelId);
    list.unshift(messageObj);
    if (list.length > 50) {
      list.length = 50;
    }
  },

  invalidateMessagesCache: async (channelId) => {
    if (isRedisAvailable()) {
      try {
        const cacheKey = `messages:${channelId}`;
        await redisClient.del(cacheKey);
        return;
      } catch (err) {
        console.warn('[Redis Cache] Invalidate error:', err.message);
      }
    }

    // Stateful Memory Fallback
    fallbackMessagesCache.delete(channelId);
  },

  getCachedMessages: async (channelId) => {
    if (isRedisAvailable()) {
      try {
        const cacheKey = `messages:${channelId}`;
        const list = await redisClient.lrange(cacheKey, 0, -1);
        if (list && list.length > 0) {
          // Since we LPUSH'ed them, they are in reverse order. Re-reverse to restore chronological order.
          return list.map(m => JSON.parse(m)).reverse();
        }
        return null;
      } catch (err) {
        console.warn('[Redis Cache] Fetch error:', err.message);
      }
    }

    // Stateful Memory Fallback
    const list = fallbackMessagesCache.get(channelId);
    if (list && list.length > 0) {
      return [...list].reverse();
    }
    return null;
  },

  saveMessagesCollectionCache: async (channelId, messagesList) => {
    if (isRedisAvailable()) {
      try {
        const cacheKey = `messages:${channelId}`;
        await redisClient.del(cacheKey);
        
        const last50 = messagesList.slice(-50);
        for (const msg of last50) {
          await redisClient.lpush(cacheKey, JSON.stringify(msg));
        }
        await redisClient.ltrim(cacheKey, 0, 49);
        await redisClient.expire(cacheKey, 3600);
        return;
      } catch (err) {
        console.warn('[Redis Cache] Save list error:', err.message);
      }
    }

    // Stateful Memory Fallback
    if (messagesList && messagesList.length > 0) {
      const last50 = [...messagesList].slice(-50);
      fallbackMessagesCache.set(channelId, last50.reverse());
    }
  },

  // 5. Typing Indicators (3 seconds TTL)
  setUserTyping: async (channelId, userId, userName) => {
    if (isRedisAvailable()) {
      try {
        const typingKey = `typing:${channelId}:${userId}`;
        await redisClient.set(typingKey, userName || 'Someone', 'EX', 3);
        return;
      } catch (err) {
        console.warn('[Redis Typing] Set error:', err.message);
      }
    }

    // Stateful Memory Fallback
    const expiresAt = Date.now() + 3000;
    fallbackTypingMap.set(`${channelId}:${userId}`, { userName: userName || 'Someone', expiresAt });
  },

  getActiveTypingUsers: async (channelId) => {
    if (isRedisAvailable()) {
      try {
        // Find keys matching pattern
        const keys = await redisClient.keys(`typing:${channelId}:*`);
        if (!keys || keys.length === 0) return [];

        const typingUsers = [];
        for (const key of keys) {
          const userId = key.split(':').pop();
          const userName = await redisClient.get(key);
          typingUsers.push({ userId, userName });
        }
        return typingUsers;
      } catch (err) {
        console.warn('[Redis Typing] Fetch error:', err.message);
      }
    }

    // Stateful Memory Fallback
    const now = Date.now();
    const typingUsers = [];
    for (const [key, value] of fallbackTypingMap.entries()) {
      if (key.startsWith(`${channelId}:`)) {
        const expiresAt = typeof value === 'object' ? value.expiresAt : value;
        const userName = typeof value === 'object' ? value.userName : 'Someone';
        if (expiresAt > now) {
          const userId = key.split(':').pop();
          typingUsers.push({ userId, userName });
        } else {
          fallbackTypingMap.delete(key);
        }
      }
    }
    return typingUsers;
  }
};
