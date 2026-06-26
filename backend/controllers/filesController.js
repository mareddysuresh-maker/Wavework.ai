import { dbService } from '../services/db.js';
import { getSocketIO } from '../services/socketService.js';

export const filesController = {
  getFiles: async (req, res) => {
    try {
      const userId = req.userId;
      const user = await dbService.getItemById('users', userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      const workspaceId = req.user.workspaceId || 'w-1';
      const isSuper = user.role === 'SUPER_ADMIN';

      // 1. Fetch all spaces, channels, and tasks scoped to workspace
      const spaces = await dbService.getCollection('spaces', { workspaceId });
      const channels = await dbService.getCollection('channels', { workspaceId });
      const tasks = await dbService.getCollection('tasks');
      const messages = await dbService.getCollection('messages');
      const users = await dbService.getCollection('users', { workspaceId });
      const allLists = await dbService.getCollection('lists');

      // 2. Identify visible spaces
      const visibleSpaceIds = spaces.filter(s => {
        if (isSuper) return true;
        return !s.isPrivate || (Array.isArray(s.memberIds) && s.memberIds.includes(userId));
      }).map(s => s.id);

      // 3. Identify visible channels
      const visibleChannelIds = channels.filter(c => {
        if (c.isDM || c.isGroup || c.isPrivate) {
          return Array.isArray(c.memberIds) && c.memberIds.includes(userId);
        }
        return true;
      }).map(c => c.id);

      const visibleListIds = allLists.filter(l => visibleSpaceIds.includes(l.spaceId)).map(l => l.id);

      // 4. Identify visible tasks
      const visibleTasks = tasks.filter(t => {
        if (t.isPersonal) {
          return t.createdById === userId;
        }
        return visibleListIds.includes(t.listId) || t.assigneeId === userId || t.createdById === userId;
      });
      const visibleTaskIds = visibleTasks.map(t => t.id);

      // 5. Gather all attachments from visible messages and tasks
      const filesMap = new Map();

      // Get user metadata map for author details
      const userMap = new Map(users.map(u => [u.id, { name: u.name, color: u.color }]));

      // Gather task attachments
      visibleTasks.forEach(t => {
        const attachments = (t.customFields && Array.isArray(t.customFields.attachments)) ? t.customFields.attachments : [];
        attachments.forEach(att => {
          const fileId = att.objectName || att.url || att.name;
          if (fileId && !filesMap.has(fileId)) {
            const author = userMap.get(t.createdById) || { name: "System User", color: "bg-slate-500 text-white" };
            filesMap.set(fileId, {
              id: fileId,
              name: att.name,
              url: att.url,
              type: att.type || 'application/octet-stream',
              size: att.size || 0,
              uploadedBy: author.name,
              uploadedById: t.createdById,
              uploadedByColor: author.color,
              createdAt: t.createdAt || new Date().toISOString(),
              context: "Task Attachment",
              contextName: t.name || "Task"
            });
          }
        });
      });

      messages.forEach(msg => {
        // Check message visibility
        const isComment = msg.taskId && msg.channelId === 'task-comments';
        const isChannelVisible = visibleChannelIds.includes(msg.channelId);
        const isTaskVisible = isComment && visibleTaskIds.includes(msg.taskId);

        if (isChannelVisible || isTaskVisible) {
          const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
          attachments.forEach(att => {
            const fileId = att.objectName || att.name;
            if (fileId && !filesMap.has(fileId)) {
              const author = userMap.get(msg.authorId) || { name: "System User", color: "bg-slate-500 text-white" };
              filesMap.set(fileId, {
                id: fileId,
                name: att.name,
                url: att.url,
                type: att.type || 'application/octet-stream',
                size: att.size || 0,
                uploadedBy: author.name,
                uploadedById: msg.authorId,
                uploadedByColor: author.color,
                createdAt: msg.createdAt,
                context: isComment ? "Task Comment" : "Chat Channel",
                contextName: isComment ? (tasks.find(t => t.id === msg.taskId)?.name || "Task") : (channels.find(c => c.id === msg.channelId)?.name || "Channel")
              });
            }
          });
        }
      });

      // 6. Merge with user-specific fileMetadata (pins, favorites, aliases)
      const userMeta = Array.isArray(user.fileMetadata) ? user.fileMetadata : [];
      const userMetaMap = new Map(userMeta.map(m => [m.fileId, m]));

      const allFiles = Array.from(filesMap.values()).map(file => {
        const meta = userMetaMap.get(file.id) || {};
        return {
          ...file,
          isPinned: !!meta.isPinned,
          isFavorite: !!meta.isFavorite,
          alias: meta.alias || ""
        };
      });

      // Sort by creation date descending
      allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(allFiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  togglePin: async (req, res) => {
    try {
      const userId = req.userId;
      const fileId = req.params.fileId;

      const user = await dbService.getItemById('users', userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      let userMeta = Array.isArray(user.fileMetadata) ? [...user.fileMetadata] : [];
      const index = userMeta.findIndex(m => m.fileId === fileId);

      if (index > -1) {
        userMeta[index].isPinned = !userMeta[index].isPinned;
      } else {
        userMeta.push({ fileId, isPinned: true, isFavorite: false, alias: "" });
      }

      // Cleanup item if it has no metadata left
      const cleanMeta = userMeta.filter(m => m.isPinned || m.isFavorite || m.alias);

      await dbService.updateItem('users', userId, { fileMetadata: cleanMeta });
      res.json({ success: true, fileMetadata: cleanMeta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  toggleFavorite: async (req, res) => {
    try {
      const userId = req.userId;
      const fileId = req.params.fileId;

      const user = await dbService.getItemById('users', userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      let userMeta = Array.isArray(user.fileMetadata) ? [...user.fileMetadata] : [];
      const index = userMeta.findIndex(m => m.fileId === fileId);

      if (index > -1) {
        userMeta[index].isFavorite = !userMeta[index].isFavorite;
      } else {
        userMeta.push({ fileId, isPinned: false, isFavorite: true, alias: "" });
      }

      const cleanMeta = userMeta.filter(m => m.isPinned || m.isFavorite || m.alias);

      await dbService.updateItem('users', userId, { fileMetadata: cleanMeta });
      res.json({ success: true, fileMetadata: cleanMeta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateAlias: async (req, res) => {
    try {
      const userId = req.userId;
      const fileId = req.params.fileId;
      const { alias } = req.body;

      const user = await dbService.getItemById('users', userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      let userMeta = Array.isArray(user.fileMetadata) ? [...user.fileMetadata] : [];
      const index = userMeta.findIndex(m => m.fileId === fileId);

      if (index > -1) {
        userMeta[index].alias = alias || "";
      } else {
        userMeta.push({ fileId, isPinned: false, isFavorite: false, alias: alias || "" });
      }

      const cleanMeta = userMeta.filter(m => m.isPinned || m.isFavorite || m.alias);

      await dbService.updateItem('users', userId, { fileMetadata: cleanMeta });
      res.json({ success: true, fileMetadata: cleanMeta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
