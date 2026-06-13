import express from 'express';
import { tasksController } from '../controllers/tasksController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Spaces Routes
router.get('/spaces', requireAuth, tasksController.getSpaces);
router.post('/spaces', requireAuth, tasksController.createSpace);
router.delete('/spaces/:id', requireAuth, tasksController.deleteSpace);

// Folders Routes
router.get('/spaces/:spaceId/folders', requireAuth, tasksController.getFoldersBySpace);
router.post('/folders', requireAuth, tasksController.createFolder);

// Lists Routes
router.get('/lists', requireAuth, tasksController.getLists);
router.post('/lists', requireAuth, tasksController.createList);
router.delete('/lists/:id', requireAuth, tasksController.deleteList);

// Tasks Routes
router.get('/tasks', requireAuth, tasksController.getTasks);
router.post('/tasks', requireAuth, tasksController.createTask);
router.patch('/tasks/:id', requireAuth, tasksController.updateTask);
router.delete('/tasks/:id', requireAuth, tasksController.deleteTask);

// Task Comments Routes
router.get('/tasks/:taskId/comments', requireAuth, tasksController.getComments);
router.post('/tasks/:taskId/comments', requireAuth, tasksController.addComment);

// Dashboard Metrics/Telemetry Routes
router.get('/dashboard/stats', requireAuth, tasksController.getMetrics);
router.get('/dashboard/stats/:workspaceId', requireAuth, tasksController.getMetrics);

export default router;
