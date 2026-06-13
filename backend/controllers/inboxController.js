/**
 * Controller for Unified inbox notifications, alerts, and custom user reminders.
 */

import { dbService } from '../services/db.js';

export const inboxController = {
  getInbox: async (req, res) => {
    try {
      const inbox = await dbService.getCollection('notifications');
      const filtered = inbox.filter(n => n.userId === req.userId);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  markRead: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dbService.updateItem('notifications', id, { isRead: true });
      res.json({ success: true, item: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  markAllRead: async (req, res) => {
    try {
      const inbox = await dbService.getCollection('notifications');
      const activeUser = req.userId;

      for (const item of inbox) {
        if (item.userId === activeUser && !item.isRead) {
          await dbService.updateItem('notifications', item.id, { isRead: true });
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  toggleSaveLater: async (req, res) => {
    try {
      const { id } = req.params;
      const item = await dbService.getItemById('notifications', id);
      if (!item) return res.status(404).json({ error: "Notification not found." });

      const updated = await dbService.updateItem('notifications', id, { isSaved: !item.isSaved });
      res.json({ success: true, item: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createReminder: async (req, res) => {
    try {
      const { title, body } = req.body;
      if (!title) return res.status(400).json({ error: "Reminder title is required." });

      const activeUser = req.userId;
      const reminder = {
        userId: activeUser,
        type: "ASSIGNMENT",
        title: `Reminder: ${title}`,
        body: body || "",
        entityId: "reminder",
        entityType: "TASK",
        isRead: false,
        isSaved: true,
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('notifications', reminder);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
