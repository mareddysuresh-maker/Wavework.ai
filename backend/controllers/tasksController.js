/**
 * Controller for ClickUp Workspace Hierarchy: Spaces, Folders, Lists, and Tasks
 */

import { dbService } from '../services/db.js';
import { getSocketIO } from '../services/socketService.js';
import { z } from 'zod';
import { logActivity } from '../utils/activityLogger.js';

const createSpaceSchema = z.object({
  name: z.string().min(1, { message: "Space name is required." }),
  color: z.string().optional(),
  icon: z.string().optional(),
  isPrivate: z.boolean().optional(),
  memberIds: z.array(z.string()).optional()
});

const createFolderSchema = z.object({
  spaceId: z.string().min(1, { message: "spaceId is required." }),
  name: z.string().min(1, { message: "Folder name is required." }),
  color: z.string().optional()
});

const createListSchema = z.object({
  spaceId: z.string().min(1, { message: "spaceId is required." }),
  folderId: z.string().optional(),
  name: z.string().min(1, { message: "List name is required." }),
  customFields: z.array(z.any()).optional()
});

const createTaskSchema = z.object({
  listId: z.string().min(1, { message: "listId is required." }),
  parentTaskId: z.string().optional(),
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  timeEstimate: z.number().optional(),
  customFields: z.record(z.any()).optional(),
  isPersonal: z.boolean().optional()
});

const addCommentSchema = z.object({
  content: z.string().min(1, { message: "Comment content is required." })
});

// Calculate workspace metrics helper
export const calculateMetricsState = async (userId = "u-1") => {
  const users = await dbService.getCollection('users');
  const activeUserObj = users.find(u => u.id === userId);
  const userWorkspaceId = activeUserObj ? (activeUserObj.activeWorkspaceId || activeUserObj.workspaceId || "w-1") : "w-1";

  const memberships = await dbService.getCollection('workspaceMemberships', { workspaceId: userWorkspaceId });
  const memberUserIds = memberships.map(m => m.userId);
  const workspaceUsers = users.filter(u => memberUserIds.includes(u.id));
  const spaces = await dbService.getCollection('spaces', { workspaceId: userWorkspaceId });
  const allLists = await dbService.getCollection('lists');
  
  const visibleSpaceIds = spaces.map(s => s.id);
  const visibleLists = allLists.filter(l => visibleSpaceIds.includes(l.spaceId));
  const visibleListIds = visibleLists.map(l => l.id);

  let allTasks = await dbService.getCollection('tasks');

  let visibleTasks = allTasks.filter(t => {
    if (t.isPersonal) return false;
    return visibleListIds.includes(t.listId);
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
  workspaceUsers.forEach(u => memberWorkload[u.id] = 0);
  visibleTasks.forEach(t => {
    if (t.assigneeId && t.status !== "DONE" && t.status !== "CANCELLED") {
      memberWorkload[t.assigneeId] = (memberWorkload[t.assigneeId] || 0) + 1;
    }
  });

  const spaceProgress = {};
  spaces.forEach((space) => {
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
  // Spaces
  getSpaces: async (req, res) => {
    try {
      const userId = req.userId;
      const workspaceId = req.user.workspaceId || 'w-1';
      const allSpaces = await dbService.getCollection('spaces', { workspaceId });
      
      const isSuperOrAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';
      
      const visibleSpaces = allSpaces.filter(s => {
        if (isSuperOrAdmin) return true;
        if (!s.isPrivate) return true;
        return Array.isArray(s.memberIds) && s.memberIds.includes(userId);
      });

      res.json(visibleSpaces);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSpace: async (req, res) => {
    try {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({ error: "Access denied: Employees cannot create spaces." });
      }

      const parseResult = createSpaceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { name, color, icon, isPrivate, memberIds } = parseResult.data;
      const workspaceId = req.user.workspaceId || 'w-1';
      
      // Always include the creator in the space
      let finalMemberIds = Array.isArray(memberIds) ? [...memberIds] : [];
      if (!finalMemberIds.includes(req.userId)) {
        finalMemberIds.push(req.userId);
      }

      const newSpace = {
        name,
        workspaceId,
        color: color || "#7C3AED",
        icon: icon || "Cpu",
        isPrivate: !!isPrivate,
        memberIds: finalMemberIds
      };

      const result = await dbService.insertItem('spaces', newSpace);
      await logActivity(req.userId, workspaceId, 'SPACE_CREATED', { spaceId: result.id, name });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteSpace: async (req, res) => {
    try {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({ error: "Access denied: Employees cannot delete spaces." });
      }

      const spaceId = req.params.id;
      const space = await dbService.getItemById('spaces', spaceId);
      if (!space) return res.status(404).json({ error: "Space not found." });

      const workspaceId = req.user.workspaceId || 'w-1';
      if (space.workspaceId !== workspaceId) {
        return res.status(403).json({ error: "Access denied: Space belongs to a different workspace." });
      }

      await dbService.updateItem('spaces', spaceId, {
        deletedAt: new Date().toISOString(),
        deletedById: req.userId
      });
      
      // Cascade lists & tasks
      const lists = await dbService.getCollection('lists', { spaceId });
      for (const l of lists) {
        await dbService.updateItem('lists', l.id, {
          deletedAt: new Date().toISOString(),
          deletedById: req.userId
        });
        const tasks = await dbService.getCollection('tasks', { listId: l.id });
        for (const t of tasks) {
          await dbService.updateItem('tasks', t.id, {
            deletedAt: new Date().toISOString(),
            deletedById: req.userId
          });
        }
      }

      await logActivity(req.userId, workspaceId, 'SPACE_DELETED', { spaceId, name: space.name });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addSpaceMember: async (req, res) => {
    try {
      const spaceId = req.params.spaceId;
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required." });

      const caller = req.user;
      const isCallerAdmin = caller && (caller.role === 'SUPER_ADMIN' || caller.role === 'ADMIN');
      if (!isCallerAdmin) {
        return res.status(403).json({ error: "Admin permissions required to add space members." });
      }

      const space = await dbService.getItemById('spaces', spaceId);
      if (!space || space.workspaceId !== (caller.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Space not found or unauthorized." });
      }

      let members = Array.isArray(space.memberIds) ? [...space.memberIds] : [];
      if (!members.includes(userId)) {
        members.push(userId);
      }

      const updated = await dbService.updateItem('spaces', spaceId, { memberIds: members });
      
      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${caller.workspaceId || 'w-1'}`).emit("space:membership-updated", { spaceId, memberIds: members });
      }

      await logActivity(req.userId, caller.workspaceId || 'w-1', 'SPACE_MEMBER_ADDED', { spaceId, memberId: userId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  removeSpaceMember: async (req, res) => {
    try {
      const spaceId = req.params.spaceId;
      const targetUserId = req.params.userId;

      const caller = req.user;
      const isSelf = req.userId === targetUserId;
      const isCallerAdmin = caller && (caller.role === 'SUPER_ADMIN' || caller.role === 'ADMIN');

      if (!isSelf && !isCallerAdmin) {
        return res.status(403).json({ error: "Admin permissions required to remove space members." });
      }

      const space = await dbService.getItemById('spaces', spaceId);
      if (!space || space.workspaceId !== (caller.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Space not found or unauthorized." });
      }

      let members = Array.isArray(space.memberIds) ? [...space.memberIds] : [];
      members = members.filter(id => id !== targetUserId);

      const updated = await dbService.updateItem('spaces', spaceId, { memberIds: members });

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${caller.workspaceId || 'w-1'}`).emit("space:membership-updated", { spaceId, memberIds: members });
      }

      await logActivity(req.userId, caller.workspaceId || 'w-1', 'SPACE_MEMBER_REMOVED', { spaceId, memberId: targetUserId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  leaveSpace: async (req, res) => {
    try {
      const spaceId = req.params.spaceId;
      const userId = req.userId;

      const space = await dbService.getItemById('spaces', spaceId);
      if (!space || space.workspaceId !== (req.user.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Space not found or unauthorized." });
      }

      let members = Array.isArray(space.memberIds) ? [...space.memberIds] : [];
      members = members.filter(id => id !== userId);

      const updated = await dbService.updateItem('spaces', spaceId, { memberIds: members });

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("space:membership-updated", { spaceId, memberIds: members });
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'SPACE_LEFT', { spaceId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Folders
  getFoldersBySpace: async (req, res) => {
    try {
      const filtered = await dbService.getCollection('folders', { spaceId: req.params.spaceId });
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createFolder: async (req, res) => {
    try {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({ error: "Access denied: Employees cannot create folders." });
      }

      const parseResult = createFolderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { spaceId, name, color } = parseResult.data;
      const space = await dbService.getItemById('spaces', spaceId);
      if (!space || space.workspaceId !== (req.user.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Space not found or unauthorized." });
      }

      const newFolder = { spaceId, name, color };
      const result = await dbService.insertItem('folders', newFolder);
      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'FOLDER_CREATED', { spaceId, folderId: result.id, name });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Lists
  getLists: async (req, res) => {
    try {
      const userId = req.userId;
      const workspaceId = req.user.workspaceId || 'w-1';
      const spaces = await dbService.getCollection('spaces', { workspaceId });
      const isSuperOrAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';

      const visibleSpaceIds = spaces.filter(s => {
        if (isSuperOrAdmin) return true;
        if (!s.isPrivate) return true;
        return Array.isArray(s.memberIds) && s.memberIds.includes(userId);
      }).map(s => s.id);

      const allLists = await dbService.getCollection('lists');
      const visibleLists = allLists.filter(l => visibleSpaceIds.includes(l.spaceId));
      res.json(visibleLists);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createList: async (req, res) => {
    try {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({ error: "Access denied: Employees cannot create lists." });
      }

      const parseResult = createListSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { spaceId, folderId, name, customFields } = parseResult.data;
      const space = await dbService.getItemById('spaces', spaceId);
      if (!space || space.workspaceId !== (req.user.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Space not found or unauthorized." });
      }

      const newList = {
        spaceId,
        folderId: folderId || "",
        name,
        createdAt: new Date().toISOString(),
        customFields: customFields || []
      };

      const result = await dbService.insertItem('lists', newList);
      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'LIST_CREATED', { spaceId, listId: result.id, name });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteList: async (req, res) => {
    try {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({ error: "Access denied: Employees cannot delete lists." });
      }

      const listId = req.params.id;
      const list = await dbService.getItemById('lists', listId);
      if (!list) return res.status(404).json({ error: "List not found." });

      const space = await dbService.getItemById('spaces', list.spaceId);
      if (!space || space.workspaceId !== (req.user.workspaceId || 'w-1')) {
        return res.status(404).json({ error: "Unauthorized access to list." });
      }

      await dbService.updateItem('lists', listId, {
        deletedAt: new Date().toISOString(),
        deletedById: req.userId
      });

      // Soft delete tasks in this list
      const tasks = await dbService.getCollection('tasks', { listId });
      for (const t of tasks) {
        await dbService.updateItem('tasks', t.id, {
          deletedAt: new Date().toISOString(),
          deletedById: req.userId
        });
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'LIST_DELETED', { listId, name: list.name });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Tasks
  getTasks: async (req, res) => {
    try {
      const userId = req.userId;
      const workspaceId = req.user.workspaceId || 'w-1';
      const spaces = await dbService.getCollection('spaces', { workspaceId });
      const isSuperOrAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';

      const visibleSpaceIds = spaces.filter(s => {
        if (isSuperOrAdmin) return true;
        if (!s.isPrivate) return true;
        return Array.isArray(s.memberIds) && s.memberIds.includes(userId);
      }).map(s => s.id);

      const allLists = await dbService.getCollection('lists');
      const visibleListIds = allLists.filter(l => visibleSpaceIds.includes(l.spaceId)).map(l => l.id);

      let allTasks = await dbService.getCollection('tasks');

      let visibleTasks = allTasks.filter(t => {
        if (t.isPersonal) {
          return t.createdById === userId;
        }
        return visibleListIds.includes(t.listId) || t.assigneeId === userId || t.createdById === userId;
      });

      res.json(visibleTasks.sort((a,b) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createTask: async (req, res) => {
    try {
      const parseResult = createTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { listId, parentTaskId, name, description, priority, assigneeId, startDate, dueDate, tags, timeEstimate, customFields, status, isPersonal } = parseResult.data;

      const tasks = await dbService.getCollection('tasks', { listId });
      const maxOrder = tasks.reduce((max, t) => t.order > max ? t.order : max, 0);

      const statusMap = {
        'TODO': 25,
        'IN_PROGRESS': 50,
        'IN_REVIEW': 75,
        'DONE': 100
      };
      const initialStatus = status || "TODO";
      const progress = statusMap[initialStatus] || 25;

      const activeUser = req.userId;
      const creator = req.user;
      const isCreatorAdmin = creator.role === 'SUPER_ADMIN' || creator.role === 'ADMIN';

      let finalTaskSource = "admin_assigned";
      let finalAssignedById = "";
      let finalAssigneeId = assigneeId || "";

      if (isPersonal) {
        finalTaskSource = "self_assigned";
        finalAssigneeId = activeUser;
        finalAssignedById = activeUser;
      } else if (!isCreatorAdmin) {
        finalAssigneeId = activeUser;
        finalTaskSource = "self_assigned";
        finalAssignedById = "";
      } else {
        finalTaskSource = "admin_assigned";
        finalAssignedById = activeUser;
      }

      const newTask = {
        listId,
        parentTaskId: parentTaskId || "",
        name,
        description: description || "",
        status: initialStatus,
        priority: priority || "NONE",
        assigneeId: finalAssigneeId,
        startDate: startDate || "",
        dueDate: dueDate || "",
        order: maxOrder + 100,
        tags: tags || [],
        timeEstimate: timeEstimate || 0,
        timeTracked: 0,
        customFields: customFields || {},
        checklist: [],
        createdById: activeUser,
        progress,
        isPersonal: !!isPersonal,
        taskSource: finalTaskSource,
        assignedById: finalAssignedById,
        deleteRequestStatus: "",
        deleteRequestReason: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const task = await dbService.insertItem('tasks', newTask);

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:created", task);
      }

      // Create notification for assignee
      if (finalAssigneeId && finalAssigneeId !== activeUser) {
        const notification = await dbService.insertItem('notifications', {
          userId: finalAssigneeId,
          type: "ASSIGNMENT",
          title: "Task Assigned",
          body: `Task assigned: ${newTask.name} by ${creator.name}`,
          entityId: task.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        if (io) {
          io.to(`user:${finalAssigneeId}`).emit("notification:received", notification);
        }
      }

      // Employee self-assignment alert
      if (!isCreatorAdmin && !isPersonal) {
        const users = await dbService.getCollection('users');
        const workspaceAdmins = users.filter(u => u.workspaceId === (req.user.workspaceId || 'w-1') && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN'));
        for (const admin of workspaceAdmins) {
          const notification = await dbService.insertItem('notifications', {
            userId: admin.id,
            type: "TASK_ALERT",
            title: "Employee Task Self-Assignment",
            body: `${creator.name} created and self-assigned task: "${name}"`,
            entityId: task.id,
            entityType: "TASK",
            isRead: false,
            isSaved: false,
            workspaceId: req.user.workspaceId || 'w-1',
            createdAt: new Date().toISOString()
          });
          if (io) {
            io.to(`user:${admin.id}`).emit("notification:received", notification);
          }
        }
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_CREATED', { taskId: task.id, name: task.name, source: finalTaskSource });

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

      // Only the assigned employee can change the task status progression
      if (req.body.status && oldTask.status !== req.body.status) {
        if (oldTask.assigneeId !== req.userId) {
          return res.status(403).json({ error: "Only the assigned employee can change the task status." });
        }
      }

      // Restrict Employee editing: block reassigning, deleting, and editing management fields
      if (req.user.role === 'EMPLOYEE') {
        const restrictedFields = ['assigneeId', 'priority', 'timeEstimate', 'timeTracked', 'customFields', 'isPersonal', 'taskSource', 'assignedById', 'dueDate', 'startDate'];
        for (const field of restrictedFields) {
          if (req.body[field] !== undefined && req.body[field] !== oldTask[field]) {
            return res.status(403).json({ error: `Access denied: Employees cannot modify management field '${field}'.` });
          }
        }
      }

      const updates = { ...req.body, updatedAt: new Date().toISOString() };

      if (req.body.status) {
        const statusMap = {
          'TODO': 25,
          'IN_PROGRESS': 50,
          'IN_REVIEW': 75,
          'DONE': 100
        };
        updates.progress = statusMap[req.body.status] || 25;
      }

      const updated = await dbService.updateItem('tasks', taskId, updates);

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:updated", updated);
      }

      // Create notification for new assignee assignment
      const newAssigneeId = req.body.assigneeId;
      if (newAssigneeId && oldTask.assigneeId !== newAssigneeId) {
        const notification = await dbService.insertItem('notifications', {
          userId: newAssigneeId,
          type: "ASSIGNMENT",
          title: "Task Assigned",
          body: `You have been assigned to: ${oldTask.name} by ${req.user.name}`,
          entityId: taskId,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        if (io) {
          io.to(`user:${newAssigneeId}`).emit("notification:received", notification);
        }
      }

      // Create notification for status updates
      if (req.body.status && oldTask.status !== req.body.status && oldTask.assigneeId) {
        const notification = await dbService.insertItem('notifications', {
          userId: oldTask.assigneeId,
          type: "STATUS_CHANGE",
          title: "Task Status Updated",
          body: `"${oldTask.name}" moved from ${oldTask.status} to ${req.body.status}`,
          entityId: oldTask.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        if (io) {
          io.to(`user:${oldTask.assigneeId}`).emit("notification:received", notification);
        }
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_UPDATED', { taskId, updates: Object.keys(req.body) });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const user = req.user;
      const task = await dbService.getItemById('tasks', taskId);
      if (!task) return res.status(404).json({ error: "Task not found." });

      const isCallerAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

      if (!isCallerAdmin) {
        if (task.taskSource === 'admin_assigned' && task.deleteRequestStatus !== 'approved') {
          return res.status(403).json({ error: "You cannot delete tasks assigned by Admin. Click 'Request Delete' if you need to remove this task." });
        }
      }

      // Soft delete
      const success = await dbService.updateItem('tasks', taskId, {
        deletedAt: new Date(),
        deletedById: req.userId
      });

      if (success) {
        const io = getSocketIO();
        if (io) {
          io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:deleted", taskId);
        }
        await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_DELETED', { taskId, name: task.name });
      }
      res.json({ success: !!success });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  requestDeleteTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: "Reason for deletion is required." });

      const task = await dbService.getItemById('tasks', taskId);
      if (!task) return res.status(404).json({ error: "Task not found." });

      const updated = await dbService.updateItem('tasks', taskId, {
        deleteRequestStatus: 'pending',
        deleteRequestReason: reason,
        updatedAt: new Date().toISOString()
      });

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:updated", updated);
      }

      // Notify admins
      const users = await dbService.getCollection('users');
      const admins = users.filter(u => u.workspaceId === (req.user.workspaceId || 'w-1') && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN'));
      
      const caller = req.user;

      for (const admin of admins) {
        const notification = await dbService.insertItem('notifications', {
          userId: admin.id,
          type: "DELETE_REQUEST",
          title: "Delete Request",
          body: `${caller.name} has requested to delete task: "${task.name}"`,
          entityId: taskId,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        if (io) {
          io.to(`user:${admin.id}`).emit("notification:received", notification);
        }
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_DELETE_REQUESTED', { taskId, name: task.name, reason });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  decideDeleteTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { action } = req.body;
      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'." });
      }

      const caller = req.user;
      const isCallerAdmin = caller && (caller.role === 'SUPER_ADMIN' || caller.role === 'ADMIN');
      if (!isCallerAdmin) {
        return res.status(403).json({ error: "Admin permissions required to approve/reject task deletion." });
      }

      const task = await dbService.getItemById('tasks', taskId);
      if (!task) return res.status(404).json({ error: "Task not found." });

      const nextStatus = action === 'approve' ? 'approved' : 'rejected';
      const updated = await dbService.updateItem('tasks', taskId, {
        deleteRequestStatus: nextStatus,
        updatedAt: new Date().toISOString()
      });

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:updated", updated);
      }

      if (task.assigneeId) {
        const notification = await dbService.insertItem('notifications', {
          userId: task.assigneeId,
          type: "STATUS_CHANGE",
          title: action === 'approve' ? "Delete Request Approved" : "Delete Request Rejected",
          body: action === 'approve' 
            ? `Your delete request for "${task.name}" was approved.` 
            : `Your delete request for "${task.name}" was rejected.`,
          entityId: taskId,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        if (io) {
          io.to(`user:${task.assigneeId}`).emit("notification:received", notification);
        }
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_DELETE_RESOLVED', { taskId, action });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  convertToAdminTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const caller = req.user;
      const isCallerAdmin = caller && (caller.role === 'SUPER_ADMIN' || caller.role === 'ADMIN');
      if (!isCallerAdmin) {
        return res.status(403).json({ error: "Admin privileges required to convert task." });
      }

      const task = await dbService.getItemById('tasks', taskId);
      if (!task) return res.status(404).json({ error: "Task not found." });

      const updated = await dbService.updateItem('tasks', taskId, {
        taskSource: 'admin_assigned',
        assignedById: req.userId,
        updatedAt: new Date().toISOString()
      });

      const io = getSocketIO();
      if (io) {
        io.to(`workspace:${req.user.workspaceId || 'w-1'}`).emit("task:updated", updated);
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'TASK_CONVERTED_TO_ADMIN', { taskId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Comments
  getComments: async (req, res) => {
    try {
      const comments = await dbService.getCollection('messages', { taskId: req.params.taskId });
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addComment: async (req, res) => {
    try {
      const parseResult = addCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { content } = parseResult.data;
      const taskId = req.params.taskId;

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

      if (task.assigneeId) {
        const notification = await dbService.insertItem('notifications', {
          userId: task.assigneeId,
          type: "COMMENT",
          title: "New Task Comment",
          body: `Comment on "${task.name}": "${content.slice(0, 30)}..."`,
          entityId: task.id,
          entityType: "TASK",
          isRead: false,
          isSaved: false,
          workspaceId: req.user.workspaceId || 'w-1',
          createdAt: new Date().toISOString()
        });
        const io = getSocketIO();
        if (io) {
          io.to(`user:${task.assigneeId}`).emit("notification:received", notification);
        }
      }

      await logActivity(req.userId, req.user.workspaceId || 'w-1', 'COMMENT_CREATED', { taskId, commentId: result.id });
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
