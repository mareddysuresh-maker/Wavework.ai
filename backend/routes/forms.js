import express from 'express';
import { formsController } from '../controllers/formsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Protected admin builder routes
router.get('/forms', requireAuth, formsController.getForms);
router.post('/forms', requireAuth, formsController.createForm);

// Unprotected public form routing
router.get('/forms/public/:slug', formsController.getPublicForm);
router.post('/forms/public/:slug/submit', formsController.submitPublicForm);

export default router;
