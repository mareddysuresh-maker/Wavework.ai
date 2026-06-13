/**
 * Controller for Notepad taking and Interactive sketches / whiteboard drawings boards
 */

import { dbService } from '../services/db.js';

export const notesController = {
  // Notepad
  getNotes: async (req, res) => {
    try {
      const notes = await dbService.getCollection('notes');
      // Filter notes by requesting session user
      const filtered = notes.filter(n => n.userId === req.userId);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createNote: async (req, res) => {
    try {
      const { title, content } = req.body;
      const newNote = {
        userId: req.userId,
        title: title || "Untitled Scratchpad",
        content: content || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('notes', newNote);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateNote: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content } = req.body;
      
      const item = await dbService.getItemById('notes', id);
      if (!item) return res.status(404).json({ error: "Note not found." });
      if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden: You are not authorized to update this note." });

      const updates = {
        title: title !== undefined ? title : item.title,
        content: content !== undefined ? content : item.content,
        updatedAt: new Date().toISOString()
      };

      const result = await dbService.updateItem('notes', id, updates);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteNote: async (req, res) => {
    try {
      const { id } = req.params;
      const item = await dbService.getItemById('notes', id);
      if (!item) return res.status(404).json({ error: "Note not found." });
      if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden." });

      await dbService.deleteItem('notes', id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Interactive Sketches Whiteboard
  getSketches: async (req, res) => {
    try {
      const sketches = await dbService.getCollection('sketches');
      const filtered = sketches.filter(s => s.userId === req.userId);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSketch: async (req, res) => {
    try {
      const { title, bg } = req.body;
      const newSketch = {
        userId: req.userId,
        title: title || "New Sketch Design",
        bg: bg || "#ffffff",
        strokes: [],
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('sketches', newSketch);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateSketch: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, strokes, bg } = req.body;

      const item = await dbService.getItemById('sketches', id);
      if (!item) return res.status(404).json({ error: "Sketch layout not found." });
      if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden." });

      const updates = {
        title: title !== undefined ? title : item.title,
        bg: bg !== undefined ? bg : item.bg,
        strokes: strokes !== undefined ? strokes : item.strokes
      };

      const result = await dbService.updateItem('sketches', id, updates);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteSketch: async (req, res) => {
    try {
      const { id } = req.params;
      const item = await dbService.getItemById('sketches', id);
      if (!item) return res.status(404).json({ error: "Sketch not found." });
      if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden." });

      await dbService.deleteItem('sketches', id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
