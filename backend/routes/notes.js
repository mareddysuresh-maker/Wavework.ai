import express from 'express';
import { notesController } from '../controllers/notesController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const notepadSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(100000).optional()
});

const canvasSchema = z.object({
  title: z.string().max(255).optional(),
  name: z.string().max(255).optional(),
  bg: z.string().max(50).optional(),
  strokes: z.array(z.any()).optional(),
  data: z.string().max(500000).optional()
});

const router = express.Router();

// Notepad lists and edit routing
router.get('/notes', requireAuth, notesController.getNotes);
router.post('/notes', requireAuth, validate(notepadSchema), notesController.createNote);
router.patch('/notes/:id', requireAuth, validate(notepadSchema), notesController.updateNote);
router.delete('/notes/:id', requireAuth, notesController.deleteNote);

// Whiteboard drawings and strokes routing
router.get('/sketches', requireAuth, notesController.getSketches);
router.post('/sketches', requireAuth, validate(canvasSchema), notesController.createSketch);
router.patch('/sketches/:id', requireAuth, validate(canvasSchema), notesController.updateSketch);
router.delete('/sketches/:id', requireAuth, notesController.deleteSketch);

export default router;
export { router as notesRouter };
