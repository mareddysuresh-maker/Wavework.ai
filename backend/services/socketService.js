import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisService, isRedisAvailable } from './redisService.js';
import { dbService } from './db.js';

let io = null;

export function getSocketIO() {
  return io;
}

export function initSocket(httpServer) {
  if (io) return io;

  console.log('[Socket.io] Initializing Socket.io server on Port 3000...');
  
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Allow connections from developers' sandbox
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // 2. Configure Socket.io Redis Adapter (for multi-server instances)
  const isRedis = isRedisAvailable();
  if (isRedis) {
    try {
      const pubClient = redisService.getPubClient();
      const subClient = redisService.getSubClient();
      if (pubClient && subClient) {
        console.log('[Socket.io] Binding @socket.io/redis-adapter...');
        io.adapter(createAdapter(pubClient, subClient));
      }
    } catch (err) {
      console.warn('[Socket.io] Fallback standard memory adapter: setup failed:', err.message);
    }
  } else {
    console.log('[Socket.io] Redis is offline. Standard in-memory adapter is active.');
  }

  // 1. Establish Redis Pub/Sub Wildcard pattern subscription on our subscriber connection
  if (isRedis) {
    const subClient = redisService.getSubClient();
    if (subClient) {
      console.log('[Socket.io Redis PubSub] Listening on pattern psubscribe: channel:*, dm:*, group:*...');
      subClient.psubscribe('channel:*', 'dm:*', 'group:*', (err) => {
        if (err) {
          console.error('[Socket.io Redis PubSub] Pattern subscribe failed:', err.message);
        }
      });

      subClient.on('pmessage', (pattern, channel, messageJson) => {
        if (!['channel:*', 'dm:*', 'group:*'].includes(pattern)) {
          return;
        }
        try {
          const { channelName, message } = JSON.parse(messageJson);
          console.log(`[Socket.io Redis PubSub] Intercepted payload for: ${channelName}`);
          
          // Emit to all sockets who joined this Redis channel name as a socket.io room
          io.to(channelName).emit('message:received', message);
        } catch (error) {
          console.error('[Socket.io Redis PubSub] Broadcast parsing failed:', error.message);
        }
      });
    }
  }

  // Socket Connection Pipeline
  io.on('connection', (socket) => {
    let connectedUserId = null;
    let currentWorkspaceId = 'w-1';

    console.log(`[Socket.io] Socket connected: ${socket.id}`);

    // Join Rooms
    socket.on('room:join', (roomName) => {
      socket.join(roomName);
      console.log(`[Socket.io] Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('room:leave', (roomName) => {
      socket.leave(roomName);
      console.log(`[Socket.io] Socket ${socket.id} left room: ${roomName}`);
    });

    // 3. Presence Heatbeat
    socket.on('user:heartbeat', async ({ userId, workspaceId }) => {
      connectedUserId = userId;
      currentWorkspaceId = workspaceId || 'w-1';
      
      socket.join(`user:${userId}`); // Join user-specific room for direct notifications
      
      // Update Redis presence
      await redisService.setUserHeartbeat(currentWorkspaceId, userId);

      // Instantly push presence update after reception
      const activeIds = await redisService.getOnlineUsers(currentWorkspaceId);
      io.emit('presence:update', activeIds);
    });

    // 5. Typing Indicators
    // Key: typing:{roomId}:{userId} (3s TTL)
    socket.on('typing:start', async ({ roomId, userId, userName }) => {
      await redisService.setUserTyping(roomId, userId, userName);

      // Get latest active typing users in this room
      const typingUsers = await redisService.getActiveTypingUsers(roomId);
      
      // Broadcast update to the specific room
      io.to(roomId).emit('typing:update', { roomId, typingUsers });
    });

    // Handle Client explicit offline
    socket.on('user:offline', async ({ userId, workspaceId }) => {
      if (userId) {
        await redisService.setUserOffline(workspaceId || 'w-1', userId);
        const activeIds = await redisService.getOnlineUsers(workspaceId || 'w-1');
        io.emit('presence:update', activeIds);
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', async () => {
      console.log(`[Socket.io] Socket disconnected: ${socket.id}`);
      if (connectedUserId) {
        // Automatically set user offline on connection drop
        await redisService.setUserOffline(currentWorkspaceId, connectedUserId);
        
        // Broadcast updated presence
        const activeIds = await redisService.getOnlineUsers(currentWorkspaceId);
        io.emit('presence:update', activeIds);
      }
    });
  });

  // Regular periodic presence synchronizer checks every 10 seconds
  setInterval(async () => {
    try {
      const activeIds = await redisService.getOnlineUsers('w-1');
      io.emit('presence:update', activeIds);
    } catch (err) {
      // Swallowed safely
    }
  }, 10000);

  return io;
}
