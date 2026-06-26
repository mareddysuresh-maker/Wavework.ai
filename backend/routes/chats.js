import express from 'express';
import { chatsController } from '../controllers/chatsController.js';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit, chatRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/channels', requireAuth, apiRateLimit, chatsController.getChannels);
router.post('/channels', requireAuth, apiRateLimit, chatsController.createChannel);
router.put('/channels/:channelId', requireAuth, apiRateLimit, chatsController.updateChannelSettings);
router.delete('/channels/:channelId', requireAuth, apiRateLimit, chatsController.deleteChannel);
router.get('/channels/:channelId/messages', requireAuth, chatRateLimit, chatsController.getMessagesByChannel);
router.post('/channels/:channelId/messages', requireAuth, chatRateLimit, chatsController.sendMessage);
router.post('/channels/:channelId/read', requireAuth, apiRateLimit, chatsController.markChannelAsRead);


// Message interactions
router.post('/messages/:messageId/react', requireAuth, apiRateLimit, chatsController.toggleReactionOnMessage);
router.post('/messages/:messageId/save', requireAuth, apiRateLimit, chatsController.toggleSaveMessage);

// Chat Request flow (1-on-1 mail invitation accept/decline)
router.get('/chat-requests', requireAuth, apiRateLimit, chatsController.getChatRequests);
router.post('/chat-requests', requireAuth, apiRateLimit, chatsController.createChatRequest);
router.post('/chats/invite', requireAuth, apiRateLimit, chatsController.createChatRequest);
router.post('/chat-requests/:requestId/accept', requireAuth, apiRateLimit, chatsController.acceptChatRequest);
router.post('/chat-requests/:requestId/decline', requireAuth, apiRateLimit, chatsController.declineChatRequest);

// Upload endpoint for file sharing (.docx, .pdf, images etc.)
router.post('/upload', requireAuth, apiRateLimit, chatsController.handleFileUpload);

export default router;
