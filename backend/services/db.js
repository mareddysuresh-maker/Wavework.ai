/**
 * Database Service for ClickUp FlowUp Application
 * Fully backed by Prisma ORM and synchronized with PostgreSQL/SQLite storage engines
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Get the correct prisma delegate for collection names
function getDelegate(collectionName) {
  switch (collectionName) {
    case 'users': return prisma.user;
    case 'spaces': return prisma.space;
    case 'folders': return prisma.folder;
    case 'lists': return prisma.list;
    case 'tasks': return prisma.task;
    case 'channels': return prisma.channel;
    case 'messages': return prisma.message;
    case 'notifications': return prisma.notification;
    case 'forms': return prisma.form;
    case 'notes': return prisma.note;
    case 'sketches': return prisma.sketch;
    case 'chatRequests': return prisma.chatRequest;
    case 'pomodoroSettings': return prisma.pomodoroSettings;
    case 'pomodoroSessions': return prisma.pomodoroSession;
    case 'workspaces': return prisma.workspace;
    case 'invitations': return prisma.invitation;
    case 'activityLogs': return prisma.activityLog;
    case 'workspaceMemberships': return prisma.workspaceMembership;
    default:
      throw new Error(`Prisma delegate for '${collectionName}' not resolved`);
  }
}

function mapFromPrisma(collectionName, item) {
  if (!item) return null;
  const mapped = { ...item };
  
  if (collectionName === 'users') {
    if (mapped.name) {
      mapped.name = mapped.name
        .replace(' (You)', '')
        .replace(' (Lead UI/UX)', '')
        .replace(' (Product Manager)', '')
        .replace(' (QA Lead)', '');
    }
    if (typeof mapped.fileMetadata === 'string') {
      try { mapped.fileMetadata = JSON.parse(mapped.fileMetadata); } catch (_) { mapped.fileMetadata = []; }
    }
  }
  
  if (collectionName === 'spaces') {
    if (typeof mapped.memberIds === 'string') {
      try { mapped.memberIds = JSON.parse(mapped.memberIds); } catch (_) { mapped.memberIds = []; }
    }
  }
  
  if (collectionName === 'lists') {
    if (typeof mapped.customFields === 'string') {
      try { mapped.customFields = JSON.parse(mapped.customFields); } catch (_) { mapped.customFields = []; }
    }
  }
  if (collectionName === 'tasks') {
    if (typeof mapped.tags === 'string') {
      try { mapped.tags = JSON.parse(mapped.tags); } catch (_) { mapped.tags = []; }
    }
    if (typeof mapped.customFields === 'string') {
      try { mapped.customFields = JSON.parse(mapped.customFields); } catch (_) { mapped.customFields = {}; }
    }
    if (typeof mapped.checklist === 'string') {
      try { mapped.checklist = JSON.parse(mapped.checklist); } catch (_) { mapped.checklist = []; }
    }
  }
  if (collectionName === 'channels') {
    if (typeof mapped.memberIds === 'string') {
      try { mapped.memberIds = JSON.parse(mapped.memberIds); } catch (_) { mapped.memberIds = []; }
    }
    if (typeof mapped.adminIds === 'string') {
      try { mapped.adminIds = JSON.parse(mapped.adminIds); } catch (_) { mapped.adminIds = []; }
    }
    if (typeof mapped.unreadCount === 'string') {
      try { mapped.unreadCount = JSON.parse(mapped.unreadCount); } catch (_) { mapped.unreadCount = {}; }
    }
  }
  if (collectionName === 'messages') {
    if (typeof mapped.savedByIds === 'string') {
      try { mapped.savedByIds = JSON.parse(mapped.savedByIds); } catch (_) { mapped.savedByIds = []; }
    }
    if (typeof mapped.reactions === 'string') {
      try { mapped.reactions = JSON.parse(mapped.reactions); } catch (_) { mapped.reactions = []; }
    }
    if (typeof mapped.attachments === 'string') {
      try { mapped.attachments = JSON.parse(mapped.attachments); } catch (_) { mapped.attachments = []; }
    }
  }
  if (collectionName === 'sketches') {
    if (typeof mapped.strokes === 'string') {
      try { mapped.strokes = JSON.parse(mapped.strokes); } catch (_) { mapped.strokes = []; }
    }
  }
  if (collectionName === 'forms') {
    if (typeof mapped.fields === 'string') {
      try { mapped.fields = JSON.parse(mapped.fields); } catch (_) { mapped.fields = []; }
    }
  }
  return mapped;
}

function mapToPrisma(collectionName, item) {
  if (!item) return null;
  const mapped = { ...item };
  
  if (collectionName === 'lists') {
    if (mapped.customFields !== undefined && typeof mapped.customFields !== 'string') {
      mapped.customFields = JSON.stringify(mapped.customFields);
    }
  }
  if (collectionName === 'tasks') {
    if (mapped.tags !== undefined && typeof mapped.tags !== 'string') {
      mapped.tags = JSON.stringify(mapped.tags);
    }
    if (mapped.customFields !== undefined && typeof mapped.customFields !== 'string') {
      mapped.customFields = JSON.stringify(mapped.customFields);
    }
    if (mapped.checklist !== undefined && typeof mapped.checklist !== 'string') {
      mapped.checklist = JSON.stringify(mapped.checklist);
    }
    
    // Coerce potential nulls or undefined values to non-nullable Prisma Schema expectations
    const stringFields = ['parentTaskId', 'description', 'status', 'priority', 'assigneeId', 'startDate', 'dueDate', 'createdById', 'taskSource', 'assignedById', 'deleteRequestStatus', 'deleteRequestReason'];
    stringFields.forEach(field => {
      if (mapped[field] === null || (field in mapped && mapped[field] === undefined)) {
        mapped[field] = "";
      }
    });
  }
  if (collectionName === 'users') {
    if (mapped.fileMetadata !== undefined && typeof mapped.fileMetadata !== 'string') {
      mapped.fileMetadata = JSON.stringify(mapped.fileMetadata);
    }
  }
  if (collectionName === 'spaces') {
    if (mapped.memberIds !== undefined && typeof mapped.memberIds !== 'string') {
      mapped.memberIds = JSON.stringify(mapped.memberIds);
    }
  }
  if (collectionName === 'channels') {
    if (mapped.memberIds !== undefined && typeof mapped.memberIds !== 'string') {
      mapped.memberIds = JSON.stringify(mapped.memberIds);
    }
    if (mapped.adminIds !== undefined && typeof mapped.adminIds !== 'string') {
      mapped.adminIds = JSON.stringify(mapped.adminIds);
    }
    if (mapped.unreadCount !== undefined && typeof mapped.unreadCount !== 'string') {
      mapped.unreadCount = JSON.stringify(mapped.unreadCount);
    }
  }
  if (collectionName === 'messages') {
    if (mapped.savedByIds !== undefined && typeof mapped.savedByIds !== 'string') {
      mapped.savedByIds = JSON.stringify(mapped.savedByIds);
    }
    if (mapped.reactions !== undefined && typeof mapped.reactions !== 'string') {
      mapped.reactions = JSON.stringify(mapped.reactions);
    }
    if (mapped.attachments !== undefined && typeof mapped.attachments !== 'string') {
      mapped.attachments = JSON.stringify(mapped.attachments);
    }
  }
  if (collectionName === 'sketches') {
    if (mapped.strokes !== undefined && typeof mapped.strokes !== 'string') {
      mapped.strokes = JSON.stringify(mapped.strokes);
    }
  }
  if (collectionName === 'forms') {
    if (mapped.fields !== undefined && typeof mapped.fields !== 'string') {
      mapped.fields = JSON.stringify(mapped.fields);
    }
  }
  return mapped;
}

// Ensure active user ID tracked in local state fallback
let activeUserId = "u-1";

// Seeding standard initial system state on start to bypass empty view modes
const DEFAULT_STATE = {
  users: [
    { id: "u-1", name: "Karthik", email: "mareddykarthikeya@gmail.com", avatarUrl: "K", color: "bg-indigo-600 text-white", timezone: "UTC", role: "SUPER_ADMIN", workspaceId: "w-1" },
    { id: "u-2", name: "Sarah", email: "sarah.designer@flowup.io", avatarUrl: "S", color: "bg-pink-500 text-white", timezone: "EST", role: "ADMIN", workspaceId: "w-1" },
    { id: "u-3", name: "John", email: "john.pm@flowup.io", avatarUrl: "J", color: "bg-amber-500 text-white", timezone: "PST", role: "ADMIN", workspaceId: "w-1" },
    { id: "u-4", name: "Emma", email: "emma.qa@flowup.io", avatarUrl: "E", color: "bg-emerald-500 text-white", timezone: "GMT", role: "EMPLOYEE", workspaceId: "w-1" }
  ],
  spaces: [
    { id: "s-1", workspaceId: "w-1", name: "Core Engineering", color: "#6366f1", icon: "Cpu", isPrivate: false },
    { id: "s-2", workspaceId: "w-1", name: "Design & Copy", color: "#ec4899", icon: "Palette", isPrivate: false },
    { id: "s-3", workspaceId: "w-1", name: "Growth Marketing", color: "#ef4444", icon: "TrendingUp", isPrivate: false }
  ],
  folders: [
    { id: "f-1", spaceId: "s-1", name: "Q3 Core Architecture" },
    { id: "f-2", spaceId: "s-2", name: "V4 Visual Refresh" }
  ],
  lists: [
    { id: "l-1", spaceId: "s-1", folderId: "f-1", name: "Backend Roadmap", createdAt: new Date().toISOString(), customFields: [
      { id: "cf-1", name: "Deployment Target", type: "dropdown", options: ["Staging", "Production", "Alpha-Cluster"] },
      { id: "cf-2", name: "Review Rating", type: "rating" }
    ]},
    { id: "l-2", spaceId: "s-1", folderId: "f-1", name: "Performance & Tracing", createdAt: new Date().toISOString() },
    { id: "l-3", spaceId: "s-2", folderId: "f-2", name: "Client Deliverables", createdAt: new Date().toISOString() },
    { id: "l-4", spaceId: "s-1", name: "Standalone Tech Debt", createdAt: new Date().toISOString() }
  ],
  tasks: [
    {
      id: "t-1",
      listId: "l-1",
      name: "Refactor database schema and add composite index on lists",
      description: "We are seeing slow response times during nested querying of space lists. Need to index listId and status fields on tasks immediately.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      assigneeId: "u-1",
      startDate: "2026-06-05",
      dueDate: "2026-06-12",
      order: 100,
      tags: ["Database", "Optimization"],
      timeEstimate: 180,
      timeTracked: 120,
      customFields: { "cf-1": "Production", "cf-2": 5 },
      checklist: [
        { id: "c-1", label: "Inspect query execution plans", isChecked: true },
        { id: "c-2", label: "Apply Prisma composite constraint migration", isChecked: true },
        { id: "c-3", label: "Verify memory usage metrics under workload", isChecked: false }
      ],
      createdById: "u-3",
      createdAt: new Date(Date.now() - 345600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "t-2",
      listId: "l-1",
      name: "Implement server-sent events for dynamic metric graphs",
      description: "Build an Express SSE pipeline that triggers real-time graph updates to the UI, so that multiple users see task status and completions synchronously.",
      status: "TODO",
      priority: "HIGH",
      assigneeId: "u-1",
      startDate: "2026-06-08",
      dueDate: "2026-06-15",
      order: 200,
      tags: ["Real-time", "SSE"],
      timeEstimate: 240,
      timeTracked: 0,
      customFields: { "cf-1": "Staging", "cf-2": 4 },
      checklist: [
        { id: "cl-1", label: "Build Event stream connection pooler", isChecked: false },
        { id: "cl-2", label: "Connect task editor lifecycle triggers to broadcast", isChecked: false }
      ],
      createdById: "u-3",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "t-3",
      listId: "l-3",
      name: "Create interactive Figma dashboard prototypes for list grouping",
      description: "Review ClickUp 4.0 layout guidelines and draft high-contrast minimalist sidebar designs with collapsible folders.",
      status: "IN_REVIEW",
      priority: "NORMAL",
      assigneeId: "u-2",
      dueDate: "2026-06-10",
      order: 100,
      tags: ["Design-System", "Figma"],
      customFields: {},
      checklist: [],
      createdById: "u-3",
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  channels: [
    { id: "ch-1", workspaceId: "w-1", name: "general", description: "Workspace-wide announcements and team general chat.", isPrivate: false, isDM: false, memberIds: ["u-1", "u-2", "u-3", "u-4"], createdAt: new Date().toISOString() },
    { id: "ch-2", workspaceId: "w-1", name: "engineering", description: "Technical architecture and build discussions.", isPrivate: false, isDM: false, memberIds: ["u-1", "u-4"], createdAt: new Date().toISOString() },
    { id: "ch-3", workspaceId: "w-1", name: "design-sync", description: "Figma and web asset coordination channel.", isPrivate: true, isDM: false, memberIds: ["u-1", "u-2", "u-3"], createdAt: new Date().toISOString() }
  ],
  messages: [
    { id: "m-1", channelId: "ch-1", authorId: "u-3", content: "Good morning team! Hope everyone is excited to sync up. I have updated the sprint plan with the primary database optimization ticket assigned to Karthik.", savedByIds: [], reactions: [], createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
    { id: "m-2", channelId: "ch-1", authorId: "u-2", content: "On it! I have posted the initial design deliverables to our Engineering-Design list. Let me know if the styling fits ClickUp 4.0 look.", savedByIds: [], reactions: [{ emoji: "🚀", userIds: ["u-1"] }], createdAt: new Date(Date.now() - 3600000 * 3).toISOString() },
    { id: "m-3", channelId: "ch-1", authorId: "u-1", content: "Perfect, already taking a look. We'll deploy the schema updates onto Alpha first to capture raw profiling data.", savedByIds: [], reactions: [], createdAt: new Date(Date.now() - 3600000 * 2).toISOString() }
  ],
  notifications: [
    { id: "n-1", userId: "u-1", type: "ASSIGNMENT", title: "New Task Assigned", body: "John assigned you: Refactor database schema and add composite index on lists", entityId: "t-1", entityType: "TASK", isRead: false, isSaved: false, createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
    { id: "n-2", userId: "u-1", type: "MENTIONS", title: "Mentioned in #general", body: "John: @Karthik make sure we test the SSE dynamic metrics under load.", entityId: "m-1", entityType: "MESSAGE", isRead: false, isSaved: false, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() }
  ],
  forms: [
    {
      id: "fo-1",
      listId: "l-1",
      name: "Engineering Request Form",
      description: "Submit technical requests or bugs directly to our Core Engineering team hierarchy.",
      slug: "tech-request",
      isPublic: true,
      createdAt: new Date().toISOString(),
      fields: [
        { id: "fld-1", type: "text", label: "Feature / Bug Short Title", required: true },
        { id: "fld-2", type: "textarea", label: "Description of the requirement", required: true },
        { id: "fld-3", type: "dropdown", label: "Priority Category", required: false, options: ["URGENT", "HIGH", "NORMAL", "LOW"] }
      ]
    }
  ],
  notes: [
    { id: "n-not-1", userId: "u-1", title: "Release Notes v2.4", content: "All migrations were completed successfully. Whiteboard sketch layouts are fully fluid.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  sketches: [
    { id: "sk-1", userId: "u-1", title: "Arch Blueprint", strokes: [], bg: "#ffffff", createdAt: new Date().toISOString() }
  ]
};

async function hashExistingPlaintextPasswords() {
  try {
    const users = await prisma.user.findMany();
    for (const u of users) {
      if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
        const hashedPassword = bcrypt.hashSync(u.password, 10);
        await prisma.user.update({
          where: { id: u.id },
          data: { password: hashedPassword }
        });
        console.log(`[DB SETUP] Hashed plaintext password for user: ${u.email}`);
      }
    }
  } catch (err) {
    console.error("[DB SETUP] Failed to update plain text passwords:", err);
  }
}

async function seedDatabaseIfEmpty() {
  try {
    const spaceCount = await prisma.space.count();
    if (spaceCount === 0) {
      console.log("🌱 Database is empty! Auto-seeding initial beautiful ClickUp clone dataset...");
      
      // Seed users
      const defaultPasswordHash = bcrypt.hashSync("password123", 10);
      for (const u of DEFAULT_STATE.users) {
        try {
          await prisma.user.create({
            data: {
              ...u,
              password: defaultPasswordHash
            }
          });
        } catch (e) {
          console.warn(`User ${u.id} might already exist, skipping...`);
        }
      }
      
      // Seed spaces
      for (const s of DEFAULT_STATE.spaces) {
        try { await prisma.space.create({ data: s }); } catch (e) { console.warn(`Space ${s.id} might already exist.`); }
      }
      
      // Seed folders
      for (const f of DEFAULT_STATE.folders) {
        try { await prisma.folder.create({ data: f }); } catch (e) { console.warn(`Folder ${f.id} might already exist.`); }
      }
      
      // Seed lists
      for (const l of DEFAULT_STATE.lists) {
        try {
          await prisma.list.create({
            data: {
              id: l.id,
              spaceId: l.spaceId,
              folderId: l.folderId || "",
              name: l.name,
              createdAt: l.createdAt,
              customFields: JSON.stringify(l.customFields || [])
            }
          });
        } catch (e) { console.warn(`List ${l.id} might already exist.`); }
      }
      
      // Seed tasks
      for (const t of DEFAULT_STATE.tasks) {
        try {
          await prisma.task.create({
            data: {
              id: t.id,
              listId: t.listId,
              name: t.name,
              description: t.description || "",
              status: t.status || "TODO",
              priority: t.priority || "NORMAL",
              assigneeId: t.assigneeId || "",
              startDate: t.startDate || "",
              dueDate: t.dueDate || "",
              order: t.order || 0,
              tags: JSON.stringify(t.tags || []),
              timeEstimate: t.timeEstimate || 0,
              timeTracked: t.timeTracked || 0,
              customFields: JSON.stringify(t.customFields || {}),
              checklist: JSON.stringify(t.checklist || []),
              createdById: t.createdById || "u-1",
              createdAt: t.createdAt,
              updatedAt: t.updatedAt
            }
          });
        } catch (e) { console.warn(`Task ${t.id} might already exist.`); }
      }
      
      // Seed channels
      for (const ch of DEFAULT_STATE.channels) {
        try {
          await prisma.channel.create({
            data: {
              id: ch.id,
              workspaceId: ch.workspaceId || "w-1",
              name: ch.name,
              description: ch.description || "",
              isPrivate: !!ch.isPrivate,
              isDM: !!ch.isDM,
              isGroup: false,
              memberIds: JSON.stringify(ch.memberIds || []),
              logoUrl: "",
              adminIds: JSON.stringify([]),
              createdAt: ch.createdAt
            }
          });
        } catch (e) { console.warn(`Channel ${ch.id} might already exist.`); }
      }
      
      // Seed messages
      for (const m of DEFAULT_STATE.messages) {
        try {
          await prisma.message.create({
            data: {
              id: m.id,
              channelId: m.channelId,
              authorId: m.authorId,
              content: m.content,
              parentId: m.parentId || "",
              taskId: m.taskId || "",
              savedByIds: JSON.stringify(m.savedByIds || []),
              reactions: JSON.stringify(m.reactions || []),
              attachments: JSON.stringify([]),
              createdAt: m.createdAt
            }
          });
        } catch (e) { console.warn(`Message ${m.id} might already exist.`); }
      }
      
      // Seed notifications
      for (const n of DEFAULT_STATE.notifications) {
        try {
          await prisma.notification.create({
            data: {
              id: n.id,
              userId: n.userId,
              type: n.type,
              title: n.title,
              body: n.body,
              entityId: n.entityId || "",
              entityType: n.entityType || "",
              isRead: !!n.isRead,
              isSaved: !!n.isSaved,
              createdAt: n.createdAt
            }
          });
        } catch (e) { console.warn(`Notification ${n.id} might already exist.`); }
      }
      
      // Seed forms
      for (const fo of DEFAULT_STATE.forms) {
        try {
          await prisma.form.create({
            data: {
              id: fo.id,
              listId: fo.listId,
              name: fo.name,
              description: fo.description || "",
              slug: fo.slug,
              fields: JSON.stringify(fo.fields || []),
              isPublic: !!fo.isPublic,
              createdAt: fo.createdAt
            }
          });
        } catch (e) { console.warn(`Form ${fo.id} might already exist.`); }
      }
      
      // Seed notes
      for (const n of DEFAULT_STATE.notes) {
        try {
          await prisma.note.create({
            data: {
              id: n.id,
              userId: n.userId,
              title: n.title || "",
              content: n.content || "",
              createdAt: n.createdAt,
              updatedAt: n.updatedAt
            }
          });
        } catch (e) { console.warn(`Note ${n.id} might already exist.`); }
      }
      
      // Seed sketches
      for (const sk of DEFAULT_STATE.sketches) {
        try {
          await prisma.sketch.create({
            data: {
              id: sk.id,
              userId: sk.userId,
              title: sk.title || "",
              bg: sk.bg || "#ffffff",
              strokes: JSON.stringify(sk.strokes || []),
              createdAt: sk.createdAt
            }
          });
        } catch (e) { console.warn(`Sketch ${sk.id} might already exist.`); }
      }

      try {
        await prisma.pomodoroSettings.create({
          data: {
            id: "ps-1",
            userId: "u-1",
            workDuration: 25,
            shortBreak: 5,
            longBreak: 15,
            autoStartTime: false
          }
        });
      } catch (e) { console.warn(`PomodoroSettings ps-1 might already exist.`); }
      
      console.log("🌻 Database preloaded and online!");
      await migrateRolesAndWorkspaces();
    } else {
      await hashExistingPlaintextPasswords();
      await migrateRolesAndWorkspaces();
    }
  } catch (error) {
    console.error("❌ Seeding database failed:", error);
  }
}

export async function migrateRolesAndWorkspaces() {
  try {
    // 1. Ensure workspace w-1 exists
    const existingWorkspace = await prisma.workspace.findUnique({ where: { id: 'w-1' } });
    if (!existingWorkspace) {
      await prisma.workspace.create({
        data: {
          id: 'w-1',
          name: 'WaveWork Workspace',
          description: 'Central company workspace for WaveWork.ai',
          ownerId: 'u-1',
          createdAt: new Date().toISOString()
        }
      });
      console.log("[DB SETUP] Created default workspace w-1");
    }

    // 2. Migrate users and create memberships
    const users = await prisma.user.findMany();
    for (const u of users) {
      let updatedRole = u.role;
      if (u.role === 'OWNER') {
        updatedRole = 'SUPER_ADMIN';
      } else if (u.role === 'MEMBER') {
        updatedRole = 'EMPLOYEE';
      }
      
      const targetWorkspace = u.workspaceId || 'w-1';
      const activeWorkspace = u.activeWorkspaceId || targetWorkspace;

      await prisma.user.update({
        where: { id: u.id },
        data: { 
          role: updatedRole,
          workspaceId: targetWorkspace,
          activeWorkspaceId: activeWorkspace
        }
      });

      // Create membership record
      const membershipId = `wm-${u.id}-${targetWorkspace}`;
      const existingMembership = await prisma.workspaceMembership.findUnique({
        where: { id: membershipId }
      });
      if (!existingMembership) {
        await prisma.workspaceMembership.create({
          data: {
            id: membershipId,
            userId: u.id,
            workspaceId: targetWorkspace,
            role: updatedRole
          }
        });
        console.log(`[DB SETUP] Created workspace membership for ${u.email} in ${targetWorkspace} with role ${updatedRole}`);
      }
    }
    console.log("[DB SETUP] Rolled out user role and workspace alignment successfully.");
  } catch (err) {
    console.error("[DB SETUP] Role and workspace migration failed:", err);
  }
}

export async function bootstrapWorkspace(workspaceId, ownerId) {
  try {
    console.log(`[BOOTSTRAP] Programmatically bootstrapping default workspace ${workspaceId} for owner ${ownerId}...`);
    
    // 1. Create Workspace
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "My New Workspace",
        ownerId: ownerId,
        createdAt: new Date().toISOString()
      }
    });

    // 2. Create default Space: General
    const spaceId = `s-gen-${Date.now()}`;
    await prisma.space.create({
      data: {
        id: spaceId,
        workspaceId: workspaceId,
        name: "General",
        color: "#6366f1",
        icon: "Cpu",
        isPrivate: false,
        memberIds: JSON.stringify([ownerId])
      }
    });

    // 3. Create default List: Getting Started
    const listId = `l-start-${Date.now()}`;
    await prisma.list.create({
      data: {
        id: listId,
        spaceId: spaceId,
        folderId: "",
        name: "Getting Started",
        createdAt: new Date().toISOString(),
        customFields: "[]"
      }
    });

    // 4. Create default Channel: #general
    const channelId = `ch-gen-${Date.now()}`;
    await prisma.channel.create({
      data: {
        id: channelId,
        workspaceId: workspaceId,
        name: "general",
        description: "Workspace-wide announcements and team general chat.",
        isPrivate: false,
        isDM: false,
        memberIds: JSON.stringify([ownerId]),
        createdAt: new Date().toISOString()
      }
    });

    console.log(`[BOOTSTRAP] Workspace ${workspaceId} bootstrapped successfully.`);
    return { spaceId, listId, channelId };
  } catch (err) {
    console.error("[BOOTSTRAP] Workspace bootstrap failed:", err);
    throw err;
  }
}

// Push seeding asynchronously
seedDatabaseIfEmpty();

async function seedClientDemoUser() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prismaClient = new PrismaClient();
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const hash = bcrypt.hashSync('password123', 10);
    const existing = await prismaClient.user.findUnique({ where: { email: 'client@flowup.io' } });
    if (!existing) {
      await prismaClient.user.create({
        data: {
          id: 'u-client',
          name: 'Client Demo',
          email: 'client@flowup.io',
          password: hash,
          avatarUrl: 'C',
          color: 'bg-emerald-500 text-white',
          role: 'SUPER_ADMIN',
          workspaceId: 'w-1',
          activeWorkspaceId: 'w-1'
        }
      });
      await prismaClient.workspaceMembership.create({
        data: {
          id: 'wm-u-client-w-1',
          userId: 'u-client',
          workspaceId: 'w-1',
          role: 'SUPER_ADMIN',
          createdAt: new Date()
        }
      });
      console.log("[BOOTSTRAP] Client demo user injected successfully.");
    }
  } catch (err) {
    console.error("[BOOTSTRAP] Client demo injection failed:", err);
  }
}
seedClientDemoUser();

export const dbService = {
  getCollection: async (name, filter = {}) => {
    try {
      const delegate = getDelegate(name);
      const softDeleteModels = ['spaces', 'lists', 'tasks', 'channels', 'workspaces'];
      
      let finalFilter = { ...filter };
      if (softDeleteModels.includes(name)) {
        finalFilter = {
          deletedAt: null,
          ...finalFilter
        };
      }
      
      const items = await delegate.findMany({ where: finalFilter });
      return items.map(item => mapFromPrisma(name, item));
    } catch (err) {
      console.error(`Prisma fetch for ${name} failed`, err);
      return [];
    }
  },

  getItemById: async (name, id) => {
    try {
      const delegate = getDelegate(name);
      const item = await delegate.findUnique({ where: { id } });
      if (item && ['spaces', 'lists', 'tasks', 'channels', 'workspaces'].includes(name) && item.deletedAt !== null) {
        return null;
      }
      return mapFromPrisma(name, item);
    } catch (err) {
      console.error(`Prisma find by id for ${name} failed`, err);
      return null;
    }
  },

  insertItem: async (name, item) => {
    const id = item.id || `${name.substring(0,2)}-${Date.now()}`;
    const newItem = { ...item, id };
    const mapped = mapToPrisma(name, newItem);
    
    try {
      const delegate = getDelegate(name);
      const result = await delegate.create({ data: mapped });
      return mapFromPrisma(name, result);
    } catch (err) {
      console.error(`Prisma insert for ${name} failed`, err);
      // Fallback
      return newItem;
    }
  },

  updateItem: async (name, id, updates) => {
    const mappedUpdates = mapToPrisma(name, updates);
    try {
      const delegate = getDelegate(name);
      const result = await delegate.update({
        where: { id },
        data: mappedUpdates
      });
      return mapFromPrisma(name, result);
    } catch (err) {
      console.error(`Prisma update for ${name} failed`, err);
      return null;
    }
  },

  deleteItem: async (name, id) => {
    try {
      const delegate = getDelegate(name);
      await delegate.delete({ where: { id } });
      return true;
    } catch (err) {
      console.error(`Prisma delete for ${name} failed`, err);
      return false;
    }
  },

  getActiveUserId: async () => {
    return activeUserId;
  },

  setActiveUserId: async (userId) => {
    activeUserId = userId;
    return userId;
  }
};
