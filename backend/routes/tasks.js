import express from 'express';
import { tasksController } from '../controllers/tasksController.js';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();

// Spaces Routes
router.get('/spaces', requireAuth, apiRateLimit, tasksController.getSpaces);
router.post('/spaces', requireAuth, apiRateLimit, tasksController.createSpace);
router.delete('/spaces/:id', requireAuth, apiRateLimit, tasksController.deleteSpace);
router.post('/spaces/:spaceId/members', requireAuth, apiRateLimit, tasksController.addSpaceMember);
router.delete('/spaces/:spaceId/members/me', requireAuth, apiRateLimit, tasksController.leaveSpace);
router.delete('/spaces/:spaceId/members/:userId', requireAuth, apiRateLimit, tasksController.removeSpaceMember);

// Folders Routes
router.get('/spaces/:spaceId/folders', requireAuth, apiRateLimit, tasksController.getFoldersBySpace);
router.post('/folders', requireAuth, apiRateLimit, tasksController.createFolder);

// Lists Routes
router.get('/lists', requireAuth, apiRateLimit, tasksController.getLists);
router.post('/lists', requireAuth, apiRateLimit, tasksController.createList);
router.delete('/lists/:id', requireAuth, apiRateLimit, tasksController.deleteList);

// Tasks Routes
router.get('/tasks', requireAuth, apiRateLimit, tasksController.getTasks);
router.post('/tasks', requireAuth, apiRateLimit, tasksController.createTask);
router.patch('/tasks/:id', requireAuth, apiRateLimit, tasksController.updateTask);
router.delete('/tasks/:id', requireAuth, apiRateLimit, tasksController.deleteTask);
router.patch('/tasks/:id/convert-to-admin-task', requireAuth, apiRateLimit, tasksController.convertToAdminTask);
router.post('/tasks/:id/request-delete', requireAuth, apiRateLimit, tasksController.requestDeleteTask);
router.post('/tasks/:id/decide-delete', requireAuth, apiRateLimit, tasksController.decideDeleteTask);

// Task Comments Routes
router.get('/tasks/:taskId/comments', requireAuth, apiRateLimit, tasksController.getComments);
router.post('/tasks/:taskId/comments', requireAuth, apiRateLimit, tasksController.addComment);

// Dashboard Metrics/Telemetry Routes
router.get('/dashboard/stats', requireAuth, apiRateLimit, tasksController.getMetrics);
router.get('/dashboard/stats/:workspaceId', requireAuth, apiRateLimit, tasksController.getMetrics);

export default router;
