import express from 'express';
import { notesController } from '../controllers/notesController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Notepad lists and edit routing
router.get('/notes', requireAuth, notesController.getNotes);
router.post('/notes', requireAuth, notesController.createNote);
router.patch('/notes/:id', requireAuth, notesController.updateNote);
router.delete('/notes/:id', requireAuth, notesController.deleteNote);

// Whiteboard drawings and strokes routing
router.get('/sketches', requireAuth, notesController.getSketches);
router.post('/sketches', requireAuth, notesController.createSketch);
router.patch('/sketches/:id', requireAuth, notesController.updateSketch);
router.delete('/sketches/:id', requireAuth, notesController.deleteSketch);

export default router;
export { router as notesRouter };
