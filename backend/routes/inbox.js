import express from 'express';
import { inboxController } from '../controllers/inboxController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/inbox', requireAuth, inboxController.getInbox);
router.patch('/inbox/:id/read', requireAuth, inboxController.markRead);
router.patch('/inbox/read-all', requireAuth, inboxController.markAllRead);
router.patch('/inbox/:id/save-later', requireAuth, inboxController.toggleSaveLater);
router.post('/inbox/custom-reminder', requireAuth, inboxController.createReminder);

export default router;
