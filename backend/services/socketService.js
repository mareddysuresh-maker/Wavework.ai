import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisService, isRedisAvailable } from './redisService.js';
import { dbService } from './db.js';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

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
  const pubClient = redisService.getPubClient();
  const subClient = redisService.getSubClient();

  if (pubClient && subClient) {
    try {
      console.log('[Socket.io] Binding @socket.io/redis-adapter...');
      io.adapter(createAdapter(pubClient, subClient));
    } catch (err) {
      console.warn('[Socket.io] Fallback standard memory adapter: setup failed:', err.message);
    }

    // 1. Establish Redis Pub/Sub Wildcard pattern subscription on our subscriber connection
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
  } else {
    console.log('[Socket.io] Redis is offline. Standard in-memory adapter is active.');
  }

  async function isAuthorizedForRoom(userId, roomName) {
    if (!userId || !roomName) return false;
    
    // Format 1: user:userId (e.g. user notifications heartbeat)
    if (roomName.startsWith('user:')) {
      const targetUserId = roomName.split(':')[1];
      return userId === targetUserId;
    }
    
    // Format 2: dm:u1:u2
    if (roomName.startsWith('dm:')) {
      const parts = roomName.split(':');
      return parts.includes(userId);
    }
    
    // Format 3: group:channelId or channel:channelId
    if (roomName.startsWith('group:') || roomName.startsWith('channel:')) {
      const channelId = roomName.split(':')[1];
      try {
        const channels = await dbService.getCollection('channels');
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return false;
        
        let memberIds = [];
        if (typeof channel.memberIds === 'string') {
          memberIds = JSON.parse(channel.memberIds || '[]');
        } else if (Array.isArray(channel.memberIds)) {
          memberIds = channel.memberIds;
        }
        
        return memberIds.includes(userId);
      } catch (err) {
        return false;
      }
    }
    
    return false;
  }

  // Register Handshake Auth Middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      logger.error(`[Socket.io Handshake Error] Connection rejected: No authentication token supplied for socket ${socket.id}`);
      return next(new Error("Unauthorized"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch (err) {
      logger.error(`[Socket.io Handshake Error] Connection rejected: Invalid JWT token supplied for socket ${socket.id}: ${err.message}`);
      next(new Error("Unauthorized"));
    }
  });

  // Socket Connection Pipeline
  io.on('connection', (socket) => {
    let connectedUserId = null;
    let currentWorkspaceId = 'w-1';

    console.log(`[Socket.io] Socket connected: ${socket.id}`);

    // Join Rooms
    socket.on('room:join', async (roomName) => {
      const userId = socket.data.user?.id;
      if (!userId) return socket.emit("error", { message: "Unauthorized" });

      const isMember = await isAuthorizedForRoom(userId, roomName);
      if (!isMember) {
        console.warn(`[Socket.io] Blocked join room request for ${roomName} from unauthorized user ${userId}`);
        return socket.emit("error", { message: "Access denied" });
      }

      socket.join(roomName);
      console.log(`[Socket.io] Socket ${socket.id} (user: ${userId}) joined room: ${roomName}`);
    });

    socket.on('room:leave', (roomName) => {
      socket.leave(roomName);
      console.log(`[Socket.io] Socket ${socket.id} left room: ${roomName}`);
    });

    // 3. Presence Heatbeat
    socket.on('user:heartbeat', async ({ userId, workspaceId }) => {
      const authenticatedUserId = socket.data.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== userId) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const targetWorkspaceId = workspaceId || 'w-1';
      if (currentWorkspaceId && currentWorkspaceId !== targetWorkspaceId) {
        socket.leave(`workspace:${currentWorkspaceId}`);
      }

      connectedUserId = userId;
      currentWorkspaceId = targetWorkspaceId;
      
      socket.join(`user:${userId}`); // Join user-specific room for direct notifications
      socket.join(`workspace:${currentWorkspaceId}`); // Join workspace room for collaborative updates
      
      // Update Redis presence
      await redisService.setUserHeartbeat(currentWorkspaceId, userId);

      // Instantly push presence update after reception
      const activeIds = await redisService.getOnlineUsers(currentWorkspaceId);
      io.emit('presence:update', activeIds);
    });

    // 5. Typing Indicators
    socket.on('typing:start', async ({ roomId, userId, userName }) => {
      const authenticatedUserId = socket.data.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== userId) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const isMember = await isAuthorizedForRoom(authenticatedUserId, roomId);
      if (!isMember) {
        return socket.emit("error", { message: "Access denied" });
      }

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
