import express from 'express';
import { filesController } from '../controllers/filesController.js';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/files', requireAuth, apiRateLimit, filesController.getFiles);
router.post('/files/:fileId/pin', requireAuth, apiRateLimit, filesController.togglePin);
router.post('/files/:fileId/favorite', requireAuth, apiRateLimit, filesController.toggleFavorite);
router.put('/files/:fileId/alias', requireAuth, apiRateLimit, filesController.updateAlias);

export default router;
