import express from 'express';
import { chatsController } from '../controllers/chatsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/channels', requireAuth, chatsController.getChannels);
router.post('/channels', requireAuth, chatsController.createChannel);
router.put('/channels/:channelId', requireAuth, chatsController.updateChannelSettings);
router.get('/channels/:channelId/messages', requireAuth, chatsController.getMessagesByChannel);
router.post('/channels/:channelId/messages', requireAuth, chatsController.sendMessage);

// Message interactions
router.post('/messages/:messageId/react', requireAuth, chatsController.toggleReactionOnMessage);
router.post('/messages/:messageId/save', requireAuth, chatsController.toggleSaveMessage);

// Chat Request flow (1-on-1 mail invitation accept/decline)
router.get('/chat-requests', requireAuth, chatsController.getChatRequests);
router.post('/chat-requests', requireAuth, chatsController.createChatRequest);
router.post('/chats/invite', requireAuth, chatsController.createChatRequest);
router.post('/chat-requests/:requestId/accept', requireAuth, chatsController.acceptChatRequest);
router.post('/chat-requests/:requestId/decline', requireAuth, chatsController.declineChatRequest);

// Upload endpoint for file sharing (.docx, .pdf, images etc.)
router.post('/upload', requireAuth, chatsController.handleFileUpload);

export default router;
