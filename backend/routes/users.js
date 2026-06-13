import express from 'express';
import { usersController } from '../controllers/usersController.js';
import { requireAuth } from '../middleware/auth.js';
import { dbService } from '../services/db.js';

const router = express.Router();

// Public simulation support
router.get('/public/users', async (req, res) => {
  try {
    const users = await dbService.getCollection('users');
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', requireAuth, usersController.getUsers);
router.get('/active-user', requireAuth, usersController.getActiveUser);
router.post('/active-user/switch', requireAuth, usersController.switchActiveUser);

// Authentication endpoints
router.post('/auth/signup', usersController.signup);
router.post('/auth/login', usersController.login);
router.post('/auth/forgot-password', usersController.forgotPassword);
router.post('/auth/verify-reset-password', usersController.verifyResetPassword);

// Pomodoro Focus Tracker mappings
router.get('/pomodoro/settings', requireAuth, usersController.getPomodoroSettings);
router.post('/pomodoro/settings', requireAuth, usersController.updatePomodoroSettings);
router.get('/pomodoro/sessions', requireAuth, usersController.getPomodoroSessions);
router.post('/pomodoro/sessions', requireAuth, usersController.createPomodoroSession);

export default router;
