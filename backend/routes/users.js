import express from 'express';
import { usersController } from '../controllers/usersController.js';
import { requireAuth } from '../middleware/auth.js';
import { dbService } from '../services/db.js';
import { authRateLimit, apiRateLimit } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const pomodoroSettingsSchema = z.object({
  workDuration: z.number().int().min(1).max(180),
  shortBreak: z.number().int().min(1).max(60),
  longBreak: z.number().int().min(1).max(60),
  autoStartTime: z.boolean().optional()
});

const pomodoroSessionSchema = z.object({
  durationMinutes: z.number().int().min(1).max(180),
  type: z.enum(["WORK", "SHORT_BREAK", "LONG_BREAK"]),
  taskId: z.string().optional()
});

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

router.get('/users', requireAuth, apiRateLimit, usersController.getUsers);
router.get('/active-user', requireAuth, apiRateLimit, usersController.getActiveUser);
router.post('/active-user/switch', requireAuth, apiRateLimit, usersController.switchActiveUser);

router.post('/users/:id/promote', requireAuth, apiRateLimit, usersController.promoteToSuperAdmin);
router.post('/users/:id/demote', requireAuth, apiRateLimit, usersController.demoteFromSuperAdmin);
router.patch('/users/:id/role', requireAuth, apiRateLimit, usersController.updateUserRole);
router.post('/users/:id/deactivate', requireAuth, apiRateLimit, usersController.deactivateUser);
router.delete('/users/:id', requireAuth, apiRateLimit, usersController.deleteUser);


// Workspace Settings & Invitations & Activity Logs
router.get('/workspaces/settings', requireAuth, apiRateLimit, usersController.getWorkspaceSettings);
router.put('/workspaces/settings', requireAuth, apiRateLimit, usersController.updateWorkspaceSettings);
router.post('/workspaces/invitations', requireAuth, apiRateLimit, usersController.createInvitation);
router.get('/workspaces/invitations', requireAuth, apiRateLimit, usersController.getInvitations);
router.post('/workspaces/invitations/:id/accept', apiRateLimit, usersController.acceptInvitation);
router.get('/workspaces/activity-logs', requireAuth, apiRateLimit, usersController.getActivityLogs);


// Authentication endpoints
router.get('/auth/workspace-exists', apiRateLimit, usersController.checkWorkspaceExists);
router.get('/auth/invitations/:id', apiRateLimit, usersController.getInvitationById);
router.post('/auth/setup-first-workspace', authRateLimit, usersController.setupFirstWorkspace);
router.post('/auth/create-workspace', requireAuth, authRateLimit, usersController.createWorkspace);
router.post('/auth/switch-workspace', requireAuth, apiRateLimit, usersController.switchWorkspace);
router.post('/auth/signup', authRateLimit, usersController.signup);
router.post('/auth/login', authRateLimit, usersController.login);
router.post('/auth/forgot-password', authRateLimit, usersController.forgotPassword);
router.post('/auth/verify-reset-password', authRateLimit, usersController.verifyResetPassword);

// Pomodoro Focus Tracker mappings
router.get('/pomodoro/settings', requireAuth, apiRateLimit, usersController.getPomodoroSettings);
router.post('/pomodoro/settings', requireAuth, apiRateLimit, validate(pomodoroSettingsSchema), usersController.updatePomodoroSettings);
router.get('/pomodoro/sessions', requireAuth, apiRateLimit, usersController.getPomodoroSessions);
router.post('/pomodoro/sessions', requireAuth, apiRateLimit, validate(pomodoroSessionSchema), usersController.createPomodoroSession);

export default router;
