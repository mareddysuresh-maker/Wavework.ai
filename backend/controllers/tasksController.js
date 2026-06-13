/**
 * Controller for ClickUp Workspace Hierarchy: Spaces, Folders, Lists, and Tasks
 */

import { dbService } from '../services/db.js';

// Calculate workspace metrics helper
// Calculate workspace metrics helper
export const calculateMetricsState = async (userId = "u-1") => {
  const tasks = await dbService.getCollection('tasks');
  const users = await dbService.getCollection('users');
  const spaces = await dbService.getCollection('spaces');
  const lists = await dbService.getCollection('lists');

  const activeUserObj = users.find(u => u.id === userId);
  const isAdmin = activeUserObj && (activeUserObj.role === 'ADMIN' || activeUserObj.role === 'OWNER');

  const SEEDED_USER_IDS = ["u-1", "u-2", "u-3", "u-4"];
  const isSeededUser = SEEDED_USER_IDS.includes(userId);

  // Filter spaces, lists, and tasks relative to user
  const visibleSpaces = spaces.filter(s => {
    if (s.workspaceId === "w-1") {
      return isSeededUser;
    }
    return s.workspaceId === userId;
  });

  const visibleSpaceIds = visibleSpaces.map(s => s.id);
  const visibleLists = lists.filter(l => visibleSpaceIds.includes(l.spaceId));
  const visibleListIds = visibleLists.map(l => l.id);
  const allListIds = lists.map(l => l.id);

  const visibleTasks = tasks.filter(t => {
    // Only count tasks of lists that still exist in the database
    if (!allListIds.includes(t.listId)) return false;
    if (isAdmin) {
      return visibleListIds.includes(t.listId) || t.assigneeId === userId || t.createdById === userId;
    } else {
      // Employees only see tasks assigned to them
      return t.assigneeId === userId;
    }
  });

  const totalTasks = visibleTasks.length;
  const todoTasks = visibleTasks.filter(t => t.status === "TODO").length;
  const inProgressTasks = visibleTasks.filter(t => t.status === "IN_PROGRESS").length;
  const inReviewTasks = visibleTasks.filter(t => t.status === "IN_REVIEW").length;
  const completedTasks = visibleTasks.filter(t => t.status === "DONE").length;

  let totalProgress = 0;
  visibleTasks.forEach(t => {
    if (t.status === 'TODO') totalProgress += 0;
    else if (t.status === 'IN_PROGRESS') totalProgress += 25;
    else if (t.status === 'IN_REVIEW') totalProgress += 75;
    else if (t.status === 'DONE') totalProgress += 100;
  });
  const overallCompletionPercentage = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;

  const byStatus = { 
    TODO: todoTasks, 
    IN_PROGRESS: inProgressTasks, 
    IN_REVIEW: inReviewTasks, 
    DONE: completedTasks, 
    CANCELLED: 0 
  };
  const byPriority = { URGENT: 0, HIGH: 0, NORMAL: 0, LOW: 0, NONE: 0 };
  
  let overdueTasks = 0;
  const now = new Date();

  visibleTasks.forEach((task) => {
    if (byPriority[task.priority] !== undefined) {
      byPriority[task.priority]++;
    } else {
      byPriority[task.priority] = 1;
    }

    if (task.dueDate && task.status !== "DONE" && task.status !== "CANCELLED") {
      const due = new Date(task.dueDate);
      if (due < now) {
        overdueTasks++;
      }
    }
  });

  const completedThisWeek = visibleTasks.filter(t => t.status === "DONE").length;

  const memberWorkload = {};
  users.forEach(u => memberWorkload[u.id] = 0);
  visibleTasks.forEach(t => {
    if (t.assigneeId && t.status !== "DONE" && t.status !== "CANCELLED") {
      memberWorkload[t.assigneeId] = (memberWorkload[t.assigneeId] || 0) + 1;
    }
  });

  const spaceProgress = {};
  visibleSpaces.forEach((space) => {
    const listIds = visibleLists.filter(l => l.spaceId === space.id).map(l => l.id);
    const spaceTasks = visibleTasks.filter(t => listIds.includes(t.listId));
    if (spaceTasks.length === 0) {
      spaceProgress[space.id] = 0;
    } else {
      const finished = spaceTasks.filter(t => t.status === "DONE" || t.status === "CANCELLED").length;
      spaceProgress[space.id] = Math.round((finished / spaceTasks.length) * 100);
    }
  });

  return {
    totalTasks,
    todoTasks,
    inProgressTasks,
    inReviewTasks,
    completedTasks,
    overallCompletionPercentage,
    byStatus,
    byPriority,
    overdueTasks,
    completedThisWeek,
    memberWorkload,
    spaceProgress
  };
};

export const tasksController = {
  // Spaces
  getSpaces: async (req, res) => {
    try {
      const spaces = await dbService.getCollection('spaces');
      const userId = req.userId;
      const SEEDED_USER_IDS = ["u-1", "u-2", "u-3", "u-4"];
      const isSeededUser = SEEDED_USER_IDS.includes(userId);

      const visibleSpaces = spaces.filter(s => {
        if (s.workspaceId === "w-1") {
          return isSeededUser;
        }
        return s.workspaceId === userId;
      });

      res.json(visibleSpaces);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSpace: async (req, res) => {
    try {
      const { name, color, icon, isPrivate } = req.body;
      if (!name) return res.status(400).json({ error: "Space name is required." });
      
      const newSpace = {
        name,
        workspaceId: req.userId,
        color: color || "#7C3AED",
        icon: icon || "Cpu",
        isPrivate: !!isPrivate
      };

      const result = await dbService.insertItem('spaces', newSpace);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteSpace: async (req, res) => {
    try {
      const spaceId = req.params.id;
      await dbService.deleteItem('spaces', spaceId);
      
      // Clean up cascade
      const folders = await dbService.getCollection('folders');
      const lists = await dbService.getCollection('lists');
      const tasks = await dbService.getCollection('tasks');
      
      for (const f of folders) {
        if (f.spaceId === spaceId) await dbService.deleteItem('folders', f.id);
      }
      for (const l of lists) {
        if (l.spaceId === spaceId) {
          await dbService.deleteItem('lists', l.id);
          // Cascading delete tasks belonging to this deleted list
          for (const t of tasks) {
            if (t.listId === l.id) {
              await dbService.deleteItem('tasks', t.id);
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Folders
  getFoldersBySpace: async (req, res) => {
    try {
      const folders = await dbService.getCollection('folders');
      const filtered = folders.filter(f => f.spaceId === req.params.spaceId);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createFolder: async (req, res) => {
    try {
      const { spaceId, name, color } = req.body;
      if (!spaceId || !name) {
        return res.status(400).json({ error: "spaceId and folder name are required." });
      }

      const newFolder = { spaceId, name, color };
      const result = await dbService.insertItem('folders', newFolder);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Lists
  getLists: async (req, res) => {
    try {
      const lists = await dbService.getCollection('lists');
      const spaces = await dbService.getCollection('spaces');
      const userId = req.userId;
      const SEEDED_USER_IDS = ["u-1", "u-2", "u-3", "u-4"];
      const isSeededUser = SEEDED_USER_IDS.includes(userId);

      const visibleSpaceIds = spaces.filter(s => {
        if (s.workspaceId === "w-1") {
          return isSeededUser;
        }
        return s.workspaceId === userId;
      }).map(s => s.id);

      const visibleLists = lists.filter(l => visibleSpaceIds.includes(l.spaceId));
      res.json(visibleLists);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createList: async (req, res) => {
    try {
      const { spaceId, folderId, name, customFields } = req.body;
      if (!spaceId || !name) {
        return res.status(400).json({ error: "spaceId and list name are required." });
      }

      const newList = {
        spaceId,
        folderId,
        name,
        createdAt: new Date().toISOString(),
        customFields: customFields || []
      };

      const result = await dbService.insertItem('lists', newList);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteList: async (req, res) => {
    try {
      const listId = req.params.id;
      await dbService.deleteItem('lists', listId);
      
      // Clean up tasks in this list
      const tasks = await dbService.getCollection('tasks');
      for (const t of tasks) {
        if (t.listId === listId) {
          await dbService.deleteItem('tasks', t.id);
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Tasks
  getTasks: async (req, res) => {
    try {
      const tasks = await dbService.getCollection('tasks');
      const spaces = await dbService.getCollection('spaces');
      const lists = await dbService.getCollection('lists');
      const users = await dbService.getCollection('users');
      const userId = req.userId;

      const activeUserObj = users.find(u => u.id === userId);
      const isAdmin = activeUserObj && (activeUserObj.role === 'ADMIN' || activeUserObj.role === 'OWNER');

      const SEEDED_USER_IDS = ["u-1", "u-2", "u-3", "u-4"];
      const isSeededUser = SEEDED_USER_IDS.includes(userId);

      const visibleSpaceIds = spaces.filter(s => {
        if (s.workspaceId === "w-1") {
          return isSeededUser;
        }
        return s.workspaceId === userId;
      }).map(s => s.id);

      const visibleListIds = lists.filter(l => visibleSpaceIds.includes(l.spaceId)).map(l => l.id);
      const allListIds = lists.map(l => l.id);

      const visibleTasks = tasks.filter(t => {
        // Only return tasks of lists that still exist in the database
        if (!allListIds.includes(t.listId)) return false;
        if (isAdmin) {
          return visibleListIds.includes(t.listId) || t.assigneeId === userId || t.createdById === userId;
        } else {
          // Employees strictly see tasks assigned to them only
          return t.assigneeId === userId;
        }
      });

      res.json(visibleTasks.sort((a,b) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createTask: async (req, res) => {
    try {
      const { listId, parentTaskId, name, description, priority, assigneeId, startDate, dueDate, tags, timeEstimate, customFields, status } = req.body;
      if (!listId || !name) {
        return res.status(400).json({ error: "listId and task name are required." });
      }

      const tasks = await dbService.getCollection('tasks');
      const maxOrder = tasks.filter(t => t.listId === listId).reduce((max, t) => t.order > max ? t.order : max, 0);

      const activeUser = req.userId;
      const newTask = {
        listId,
        parentTaskId,
        name,
        description: description || "",
        status: status || "TODO",
        priority: priority || "NONE",
        assigneeId: assigneeId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        order: maxOrder + 100,
        tags: tags || [],
        timeEstimate: timeEstimate || 0,
        timeTracked: 0,
        customFields: customFields || {},
        checklist: [],
        createdById: activeUser,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const task = await dbService.insertItem('tasks', newTask);

      // Create notification for assignee
      if (assigneeId) {
        await dbService.insertItem('notifications', {
          userId: assigneeId,
          type: "ASSIGNMENT",
          title: "Task Assigned",
          body: `Task assigned: ${newTask.name}`,
          entityId: task.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          createdAt: new Date().toISOString()
        });
      }

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const oldTask = await dbService.getItemById('tasks', taskId);
      if (!oldTask) return res.status(404).json({ error: "Task not found." });

      const updates = { ...req.body, updatedAt: new Date().toISOString() };
      const updated = await dbService.updateItem('tasks', taskId, updates);

      // Create notification for new assignee assignment
      const newAssigneeId = req.body.assigneeId;
      if (newAssigneeId && oldTask.assigneeId !== newAssigneeId) {
        await dbService.insertItem('notifications', {
          userId: newAssigneeId,
          type: "ASSIGNMENT",
          title: "Task Assigned",
          body: `You have been assigned to: ${oldTask.name}`,
          entityId: taskId,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          createdAt: new Date().toISOString()
        });
      }

      // Create notification for status updates
      if (req.body.status && oldTask.status !== req.body.status && oldTask.assigneeId) {
        await dbService.insertItem('notifications', {
          userId: oldTask.assigneeId,
          type: "STATUS_CHANGE",
          title: "Task Status Updated",
          body: `"${oldTask.name}" moved from ${oldTask.status} to ${req.body.status}`,
          entityId: oldTask.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          createdAt: new Date().toISOString()
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteTask: async (req, res) => {
    try {
      const success = await dbService.deleteItem('tasks', req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Comments
  getComments: async (req, res) => {
    try {
      const messages = await dbService.getCollection('messages');
      const comments = messages.filter(m => m.taskId === req.params.taskId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addComment: async (req, res) => {
    try {
      const { content } = req.body;
      const taskId = req.params.taskId;
      if (!content) return res.status(400).json({ error: "Comment content is required." });

      const task = await dbService.getItemById('tasks', taskId);
      if (!task) return res.status(404).json({ error: "Task not found." });

      const newComment = {
        channelId: "task-comments",
        authorId: req.userId,
        content,
        taskId,
        savedByIds: [],
        reactions: [],
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('messages', newComment);

      // Create inbox item for the task assignee about a comment
      if (task.assigneeId) {
        await dbService.insertItem('notifications', {
          userId: task.assigneeId,
          type: "COMMENT",
          title: "New Task Comment",
          body: `Comment on "${task.name}": "${content.slice(0, 30)}..."`,
          entityId: task.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          createdAt: new Date().toISOString()
        });
      }

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Metrics Stats
  getMetrics: async (req, res) => {
    try {
      const m = await calculateMetricsState(req.userId);
      res.json(m);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
