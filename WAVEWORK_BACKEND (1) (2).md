# WaveWork.ai — Complete Backend Architecture Plan
> No Firebase. No shortcuts. PostgreSQL + Prisma + JWT. Production-grade. Every feature planned.

---

## 1. TECH STACK & WHY

| Layer | Tool | Why This, Not Something Else |
|---|---|---|
| Runtime | Node.js 20 LTS | Non-blocking I/O ideal for real-time; same language as frontend |
| Framework | Express.js | Minimal, composable, battle-tested; full control over middleware chain |
| Language | TypeScript | Catch bugs at compile time; Prisma + TypeScript = fully typed DB layer |
| Auth | JWT (jsonwebtoken) + bcryptjs | Own your auth fully; no external dependency; works offline |
| Database | PostgreSQL 16 | Relational data with complex joins; ACID transactions; best for task hierarchies |
| ORM | Prisma 5 | Type-safe queries; auto-generated client; migration management |
| Real-time | Socket.io 4 | WebSocket with auto-fallback; rooms, namespaces, Redis adapter |
| Pub/Sub + Cache | Redis 7 (ioredis) | Socket.io multi-server adapter; typing indicators; presence; message cache |
| File Storage | MinIO | S3-compatible; self-hosted; swap to Cloudflare R2/AWS S3 in prod with zero code change |
| Email | Nodemailer + Gmail SMTP | Invite emails, task alerts, notifications; free; reliable |
| Validation | Zod | Schema-first validation on all API inputs; shared types with frontend |
| Rate Limiting | express-rate-limit | Protect all endpoints from abuse |
| File Parsing | Multer | Handle multipart/form-data file uploads in memory before sending to MinIO |
| Process Manager | PM2 (production only) | Zero-downtime restarts; cluster mode; log management |

---

## 2. HIERARCHY (The Heart of the App)

WaveWork mirrors the exact ClickUp 6-level hierarchy:

```
WORKSPACE  (your entire organization — one per company)
  └── SPACE  (departments / teams / functions — e.g. "Engineering", "Marketing")
        └── FOLDER  (optional grouping layer — e.g. "Q3 Projects", "Client A")
              └── LIST  (a project or workflow — e.g. "Sprint 1", "Campaign Tasks")
                    └── TASK  (unit of work — has status, assignee, due date, priority)
                          └── SUBTASK  (child task inside a task)
```

**Key rules:**
- Tasks CANNOT exist outside a List
- Folders are OPTIONAL — Lists can live directly inside Spaces
- Every level can be private or shared
- Each Space has its own custom statuses, colors, and member permissions
- Drag-and-drop reordering works at every level

---

## 3. DATABASE SCHEMA

### 3.1 Users & Auth

```
User
  id            CUID (PK)
  email         String UNIQUE
  passwordHash  String
  displayName   String
  avatarUrl     String?
  isOnline      Boolean default false
  lastSeen      DateTime
  createdAt     DateTime

RefreshToken
  id        CUID (PK)
  userId    FK → User
  token     String UNIQUE
  expiresAt DateTime
  createdAt DateTime
```

**How auth works:**
- On login: issue accessToken (15min) + refreshToken (7 days)
- accessToken sent in Authorization header on every request
- refreshToken stored in httpOnly cookie
- On expiry: client hits /api/auth/refresh silently
- No session table needed — stateless JWT

---

### 3.2 Workspace & Members

```
Workspace
  id        CUID (PK)
  name      String
  slug      String UNIQUE (url-safe name)
  logoUrl   String?
  ownerId   FK → User
  createdAt DateTime

WorkspaceMember
  id          CUID (PK)
  workspaceId FK → Workspace
  userId      FK → User
  role        Enum: OWNER | ADMIN | MEMBER | GUEST
  joinedAt    DateTime
  UNIQUE(workspaceId, userId)
```

---

### 3.3 Spaces

```
Space
  id          CUID (PK)
  workspaceId FK → Workspace
  name        String
  color       String (hex)
  icon        String?
  isPrivate   Boolean default false
  position    Int default 0   ← for drag-and-drop ordering
  createdAt   DateTime

SpaceMember  (only needed if Space is private)
  id        CUID (PK)
  spaceId   FK → Space
  userId    FK → User
  role      Enum: ADMIN | MEMBER

SpaceStatus  (custom statuses per space)
  id        CUID (PK)
  spaceId   FK → Space
  name      String
  color     String
  position  Int
  category  Enum: NOT_STARTED | ACTIVE | DONE | CLOSED
```

---

### 3.4 Folders

```
Folder
  id        CUID (PK)
  spaceId   FK → Space
  name      String
  color     String?
  position  Int default 0
  createdAt DateTime
```

---

### 3.5 Lists

```
List
  id        CUID (PK)
  spaceId   FK → Space    (nullable if inside a folder)
  folderId  FK → Folder?  (nullable if directly in space)
  name      String
  color     String?
  position  Int default 0
  createdAt DateTime
```

---

### 3.6 Tasks & Subtasks

```
Task
  id          CUID (PK)
  listId      FK → List
  parentId    FK → Task?   ← null = top-level task; set = subtask
  title       String
  description String?      ← rich text (stored as plain string or markdown)
  status      String       ← references SpaceStatus name
  priority    Enum: NONE | LOW | MEDIUM | HIGH | URGENT
  assigneeId  FK → User?
  creatorId   FK → User
  dueDate     DateTime?
  startDate   DateTime?
  position    Int default 0
  isArchived  Boolean default false
  createdAt   DateTime
  updatedAt   DateTime

TaskTag
  id     CUID (PK)
  taskId FK → Task
  name   String
  color  String

TaskComment
  id        CUID (PK)
  taskId    FK → Task
  userId    FK → User
  content   String
  createdAt DateTime
  updatedAt DateTime

TaskAttachment
  id        CUID (PK)
  taskId    FK → Task
  userId    FK → User
  fileName  String
  fileKey   String   ← MinIO object key
  fileSize  Int
  mimeType  String
  createdAt DateTime

TaskWatcher
  id     CUID (PK)
  taskId FK → Task
  userId FK → User
  UNIQUE(taskId, userId)
```

---

### 3.7 Invites

```
Invite
  id          CUID (PK)
  workspaceId FK → Workspace
  senderId    FK → User
  receiverId  FK → User?   ← null if not yet registered
  email       String
  token       String UNIQUE
  type        Enum: WORKSPACE | DIRECT_MESSAGE
  status      Enum: PENDING | ACCEPTED | DECLINED | EXPIRED
  expiresAt   DateTime
  createdAt   DateTime
```

---

### 3.8 Chat — Direct Messages

```
DMConversation
  id        CUID (PK)
  createdAt DateTime

DMParticipant
  id             CUID (PK)
  conversationId FK → DMConversation
  userId         FK → User
  lastReadAt     DateTime?   ← for unread count
  UNIQUE(conversationId, userId)

Message
  id               CUID (PK)
  senderId         FK → User
  content          String
  fileKey          String?   ← MinIO key if file attachment
  fileName         String?
  isEdited         Boolean default false
  isDeleted        Boolean default false
  dmConversationId FK → DMConversation?
  channelId        FK → Channel?
  createdAt        DateTime
  updatedAt        DateTime
  ← one of dmConversationId or channelId must be set, never both
```

---

### 3.9 Chat — Channels & Groups

```
Channel
  id          CUID (PK)
  workspaceId FK → Workspace
  name        String
  description String?
  isPrivate   Boolean default false
  createdAt   DateTime

ChannelMember
  id         CUID (PK)
  channelId  FK → Channel
  userId     FK → User
  lastReadAt DateTime?
  joinedAt   DateTime
  UNIQUE(channelId, userId)
```

---

### 3.10 Notifications

```
Notification
  id        CUID (PK)
  userId    FK → User
  type      Enum: INVITE_RECEIVED | INVITE_ACCEPTED | TASK_ASSIGNED |
                  TASK_COMMENT | MESSAGE_RECEIVED | MENTION | TASK_DUE
  title     String
  body      String
  link      String?   ← deep link to the relevant page
  isRead    Boolean default false
  createdAt DateTime
```

---

## 4. API ROUTES (Complete List)

### AUTH
```
POST   /api/auth/register          Register new user (email + password)
POST   /api/auth/login             Login → returns accessToken + sets refresh cookie
POST   /api/auth/refresh           Silent token refresh using cookie
POST   /api/auth/logout            Clear refresh token
GET    /api/auth/me                Get current user
PATCH  /api/auth/me                Update display name / avatar
POST   /api/auth/change-password   Change password (requires current password)
```

### WORKSPACE
```
POST   /api/workspaces             Create workspace
GET    /api/workspaces             Get all workspaces for current user
GET    /api/workspaces/:id         Get workspace details + members
PATCH  /api/workspaces/:id         Update name / logo (ADMIN+)
DELETE /api/workspaces/:id         Delete workspace (OWNER only)
GET    /api/workspaces/:id/members Get all members
DELETE /api/workspaces/:id/members/:userId  Remove member (ADMIN+)
PATCH  /api/workspaces/:id/members/:userId  Change member role (OWNER only)
```

### INVITES
```
POST   /api/invites/workspace      Send workspace invite by email
POST   /api/invites/dm             Send DM chat request by email
GET    /api/invites/:token         Get invite details (for accept page, no auth required)
POST   /api/invites/:token/accept  Accept invite
POST   /api/invites/:token/decline Decline invite
GET    /api/invites                Get all pending invites sent by current user
```

### SPACES
```
POST   /api/spaces                 Create space in workspace
GET    /api/spaces?workspaceId=    Get all spaces (user has access to)
GET    /api/spaces/:id             Get space + folders + lists
PATCH  /api/spaces/:id             Update name / color / icon
DELETE /api/spaces/:id             Delete space (cascades all folders, lists, tasks)
PATCH  /api/spaces/:id/reorder     Update position (drag-and-drop)
GET    /api/spaces/:id/members     Get space members (if private)
POST   /api/spaces/:id/members     Add member to private space
DELETE /api/spaces/:id/members/:userId  Remove from private space
GET    /api/spaces/:id/statuses    Get custom statuses for this space
POST   /api/spaces/:id/statuses    Create custom status
PATCH  /api/spaces/:id/statuses/:statusId  Update status
DELETE /api/spaces/:id/statuses/:statusId  Delete status
```

### FOLDERS
```
POST   /api/folders                Create folder inside a space
GET    /api/folders?spaceId=       Get all folders in space
PATCH  /api/folders/:id            Update name / color
DELETE /api/folders/:id            Delete folder (cascades lists + tasks)
PATCH  /api/folders/:id/reorder    Update position
```

### LISTS
```
POST   /api/lists                  Create list (in space or in folder)
GET    /api/lists?spaceId=         Get lists directly in a space
GET    /api/lists?folderId=        Get lists inside a folder
GET    /api/lists/:id              Get list + tasks
PATCH  /api/lists/:id              Update name / color
DELETE /api/lists/:id              Delete list (cascades tasks)
PATCH  /api/lists/:id/reorder      Update position
```

### TASKS
```
POST   /api/tasks                  Create task in a list
GET    /api/tasks?listId=          Get all tasks in list (with subtasks)
GET    /api/tasks/:id              Get single task full detail
PATCH  /api/tasks/:id              Update any task field
DELETE /api/tasks/:id              Delete task (cascades subtasks)
PATCH  /api/tasks/:id/reorder      Update position (drag-and-drop)
PATCH  /api/tasks/:id/move         Move task to different list

POST   /api/tasks/:id/subtasks     Create subtask
GET    /api/tasks/:id/subtasks     Get subtasks

POST   /api/tasks/:id/comments     Add comment
GET    /api/tasks/:id/comments     Get comments (paginated)
PATCH  /api/tasks/:id/comments/:cid  Edit comment
DELETE /api/tasks/:id/comments/:cid  Delete comment

POST   /api/tasks/:id/watch        Watch task (get notifications)
DELETE /api/tasks/:id/watch        Unwatch task

POST   /api/tasks/:id/attachments  Upload attachment → MinIO
GET    /api/tasks/:id/attachments  Get attachments list
DELETE /api/tasks/:id/attachments/:aid  Delete attachment
```

### CHAT — DIRECT MESSAGES
```
GET    /api/chats                  Get all DM conversations for user
GET    /api/chats/:id              Get conversation details
GET    /api/chats/:id/messages     Get messages (paginated, cursor-based)
POST   /api/chats/:id/messages     Send message (REST fallback if socket fails)
PATCH  /api/chats/:id/messages/:mid  Edit message
DELETE /api/chats/:id/messages/:mid  Delete message
POST   /api/chats/:id/read         Mark conversation as read (update lastReadAt)
GET    /api/chats/unread           Get unread count per conversation
```

### CHANNELS
```
POST   /api/channels               Create channel in workspace
GET    /api/channels?workspaceId=  Get all channels (public + joined private)
GET    /api/channels/:id           Get channel details + members
PATCH  /api/channels/:id           Update name / description (ADMIN+)
DELETE /api/channels/:id           Delete channel
POST   /api/channels/:id/join      Join public channel
DELETE /api/channels/:id/leave     Leave channel
POST   /api/channels/:id/invite    Invite user to private channel
GET    /api/channels/:id/messages  Get messages (paginated, cursor-based)
POST   /api/channels/:id/messages  Send message (REST fallback)
PATCH  /api/channels/:id/messages/:mid  Edit message
DELETE /api/channels/:id/messages/:mid  Delete message
POST   /api/channels/:id/read      Mark as read
GET    /api/channels/unread        Get unread count per channel
```

### FILES / UPLOAD
```
POST   /api/upload/avatar          Upload user avatar → MinIO (returns avatarUrl)
POST   /api/upload/workspace-logo  Upload workspace logo → MinIO
GET    /api/upload/presign/:key    Get presigned URL for file download (1hr expiry)
DELETE /api/upload/:key            Delete file from MinIO
```

### NOTIFICATIONS
```
GET    /api/notifications/stream   SSE stream — server pushes events to client
GET    /api/notifications          Get all notifications (paginated)
PATCH  /api/notifications/:id/read Mark one as read
PATCH  /api/notifications/read-all Mark all as read
DELETE /api/notifications/:id      Delete notification
```

### DASHBOARD / METRICS
```
GET    /api/dashboard?workspaceId= Get workspace metrics:
                                     totalTasks, inProgress, overdue, completed
                                     tasksAssignedToMe, tasksDueToday,
                                     recentActivity, pendingDelegations
```

### PLANNER (Timeline View)
```
GET    /api/planner?workspaceId=   Get all tasks with dates for timeline view
                                     (grouped by assignee or space)
PATCH  /api/planner/tasks/:id/dates  Update start/due date from drag on timeline
```

---

## 5. REAL-TIME SOCKET.IO ARCHITECTURE

### Connection Handshake
```
Client sends JWT accessToken in socket handshake auth:
  socket.auth = { token: "Bearer ..." }

Server on connection:
  1. Verify JWT → get userId
  2. Store userId on socket.data.userId
  3. Auto-join rooms:
     - User personal room: "user:{userId}"
     - All workspaces they belong to: "workspace:{workspaceId}"
     - All channels they're members of: "channel:{channelId}"
     - All DM conversations they're in: "dm:{conversationId}"
  4. Mark user online in Redis: SADD presence:{workspaceId} {userId}
  5. Broadcast to workspace: presence:online { userId }

On disconnect:
  1. Remove from Redis presence sets
  2. Update User.lastSeen in DB
  3. Broadcast to workspace: presence:offline { userId, lastSeen }
```

### DM Events
```
CLIENT → SERVER:
  dm:send           { conversationId, content, fileKey?, fileName? }
  dm:typing         { conversationId }
  dm:stop_typing    { conversationId }
  dm:read           { conversationId }
  dm:edit           { messageId, content }
  dm:delete         { messageId }

SERVER → CLIENT (to room "dm:{conversationId}"):
  dm:message        { message: MessageObject }
  dm:typing         { userId, conversationId }
  dm:stop_typing    { userId, conversationId }
  dm:read           { userId, conversationId, lastReadAt }
  dm:message_edited { messageId, content, updatedAt }
  dm:message_deleted { messageId }
```

### Channel Events
```
CLIENT → SERVER:
  channel:send        { channelId, content, fileKey?, fileName? }
  channel:typing      { channelId }
  channel:stop_typing { channelId }
  channel:edit        { messageId, content }
  channel:delete      { messageId }

SERVER → CLIENT (to room "channel:{channelId}"):
  channel:message        { message: MessageObject }
  channel:typing         { userId, channelId }
  channel:stop_typing    { userId, channelId }
  channel:message_edited { messageId, content, updatedAt }
  channel:message_deleted { messageId }
```

### Task Events (broadcast to workspace room)
```
SERVER → CLIENT (to room "workspace:{workspaceId}"):
  task:created   { task: TaskObject }
  task:updated   { taskId, changes: Partial<Task> }
  task:deleted   { taskId, listId }
  task:moved     { taskId, fromListId, toListId, position }
  task:comment   { taskId, comment: CommentObject }
  task:assigned  { taskId, assigneeId, assigneeName }
```

### Invite Events
```
SERVER → CLIENT (to room "user:{userId}"):
  invite:received  { invite: InviteObject }   ← pushed to User B instantly
  invite:accepted  { invite: InviteObject, conversation?: DMConversation }
  invite:declined  { inviteId }
```

### Notification Events
```
SERVER → CLIENT (to room "user:{userId}"):
  notification:new   { notification: NotificationObject }
```

### Presence Heartbeat
```
Client pings every 20 seconds: presence:heartbeat { workspaceId }
Server refreshes Redis TTL: EXPIRE presence:{workspaceId}:{userId} 30
```

---

## 6. DM INVITE FLOW (Zero-Reload, Instant)

```
STEP 1 — User A clicks "+ New Message" → types User B's email

STEP 2 — POST /api/invites/dm
  Server:
    - Creates Invite record (status: PENDING, type: DM)
    - Sends email via Nodemailer (link: https://wavework.ai/invite/{token})
    - If User B is already registered AND online:
        emit invite:received to room "user:{userBId}"
        (User B sees real-time notification in app)

STEP 3 — User B clicks link in email OR in-app notification
    GET /api/invites/{token}
    Returns: { sender: { name, avatar }, workspace, type }
    User B sees "Karthik wants to chat with you" accept/decline UI

STEP 4 — User B clicks Accept
    POST /api/invites/{token}/accept
    Server:
      - Creates DMConversation
      - Creates 2 DMParticipant records
      - Sets Invite.status = ACCEPTED
      - Creates Notification for User A (type: INVITE_ACCEPTED)
      - Emits invite:accepted to room "user:{userAId}"
        → User A's sidebar updates in real-time, new chat appears

STEP 5 — Both users can chat
    - Socket.io events flow through Redis Pub/Sub
    - Messages persist to PostgreSQL
    - Redis caches last 50 messages per conversation
    - Zero page reload at any step
```

---

## 7. SPACES FEATURE PLAN (Step by Step)

### What Spaces Must Do
1. Create / rename / delete / reorder spaces in the sidebar
2. Set color and icon per space
3. Toggle private (only visible to invited members)
4. Per-space custom task statuses (different from other spaces)
5. Per-space member permissions (who can create/edit/delete)
6. Each space shows folders + lists in a tree sidebar

### What Happens When You Open a Space
1. GET /api/spaces/:id
   Returns: space metadata + all folders + all lists (flat, client sorts by position)
2. Sidebar renders tree: Space → Folders → Lists
3. Clicking a List loads tasks in that list's view
4. Views available per list: Kanban Board, List, Calendar, Timeline

### Task Views
```
KANBAN BOARD VIEW
  - Columns = task statuses (from SpaceStatus)
  - Drag task card to different column = PATCH /api/tasks/:id (update status)
  - Drag card within column = PATCH /api/tasks/:id/reorder (update position)
  - Socket broadcasts task:updated to workspace room instantly

LIST VIEW
  - Traditional table of tasks
  - Sort by: status, priority, due date, assignee, created date
  - Group by: status, assignee, priority

CALENDAR VIEW
  - Shows tasks with due dates as calendar events
  - Click to open task
  - Drag to change due date = PATCH /api/tasks/:id

TIMELINE (PLANNER) VIEW
  - Gantt-style horizontal bars for tasks with start + due dates
  - Drag bar to change dates = PATCH /api/planner/tasks/:id/dates
  - Group by assignee or list
```

---

## 8. DASHBOARD METRICS PLAN

The dashboard (Workspace Metrics Core as seen in UI) needs:

```
GET /api/dashboard?workspaceId=:id

Returns:
{
  totalTasks: number,
  inProgress: number,
  overdue: number,           ← tasks where dueDate < now AND status != DONE
  completed: number,
  
  assignedToMe: Task[],      ← top 5 tasks assigned to current user
  dueSoon: Task[],           ← tasks due in next 3 days
  
  pendingDelegations: {      ← tasks with no assignee in user's spaces
    count: number,
    tasks: Task[]
  },
  
  recentActivity: {          ← last 10 task creates/updates across workspace
    type: 'created' | 'updated' | 'completed',
    task: Task,
    user: User,
    at: DateTime
  }[]
}
```

This is computed fresh on each request using Prisma aggregates and WHERE clauses. No caching needed at this stage.

---

## 9. REDIS USAGE PLAN

```
1. SOCKET.IO ADAPTER
   Package: @socket.io/redis-adapter
   Purpose: Sync socket rooms across multiple server instances
   How: createAdapter(pubClient, subClient) — two separate ioredis connections

2. PRESENCE TRACKING
   Key: presence:{workspaceId}
   Type: Redis Set (SADD / SREM / SMEMBERS)
   TTL: Per-user key expires in 30s (refreshed by heartbeat)
   Use: Show green dots next to online users in sidebar

3. TYPING INDICATORS
   Key: typing:{roomId}:{userId}
   Type: Redis String with TTL 3 seconds
   Set on dm:typing / channel:typing events
   Auto-expires — no manual cleanup needed

4. MESSAGE CACHE (last 50 per room)
   Key: messages:{roomId}
   Type: Redis List (LPUSH + LTRIM 0 49)
   TTL: 1 hour
   Use: Load chat view instantly from Redis; fall back to DB for history

5. RATE LIMIT STORE
   Package: rate-limit-redis
   Key: rl:{ip}:{route}
   Use: Prevent brute force on /api/auth/login
```

---

## 10. FILE STORAGE PLAN (MinIO)

```
Buckets:
  wavework-uploads   ← all files

Key structure:
  avatars/{userId}/{uuid}.{ext}
  workspace-logos/{workspaceId}/{uuid}.{ext}
  task-attachments/{taskId}/{uuid}-{originalName}
  chat-files/{conversationId}/{uuid}-{originalName}

Upload flow:
  1. Client sends multipart/form-data to POST /api/upload/*
  2. Multer holds file in memory (max 10MB)
  3. Backend streams to MinIO via putObject()
  4. MinIO returns ETag confirmation
  5. Backend saves the object key to DB (NOT the full URL)
  6. To display: GET /api/upload/presign/{key}
     Backend calls presignedGetObject() — returns URL valid for 1 hour
     Client uses this URL directly (signed, secure, time-limited)

Why save key not URL:
  If you save the full URL and later change storage provider,
  all your DB URLs break. Key is provider-agnostic.
```

---

## 11. EMAIL TEMPLATES

### Workspace Invite
```
Subject: {senderName} invited you to {workspaceName} on WaveWork.ai
Body:
  {senderName} has invited you to join the "{workspaceName}" workspace.
  [Accept Invitation]  →  https://wavework.ai/invite/{token}
  Link expires in 7 days.
```

### DM Chat Request
```
Subject: {senderName} wants to connect with you on WaveWork.ai
Body:
  {senderName} sent you a direct message request.
  [Accept & Chat]  →  https://wavework.ai/invite/{token}
  Link expires in 48 hours.
```

### Task Assigned
```
Subject: You've been assigned: {taskTitle}
Body:
  {assignerName} assigned you a task in {spaceName} / {listName}:
  📌 {taskTitle}
  Priority: {priority}  |  Due: {dueDate}
  [View Task]  →  https://wavework.ai/task/{taskId}
```

### Task Comment Mention
```
Subject: {mentionerName} mentioned you in a comment
Body:
  {mentionerName} mentioned you on task "{taskTitle}"
  "{commentPreview}..."
  [View Comment]  →  https://wavework.ai/task/{taskId}#comment-{commentId}
```

---

## 12. MIDDLEWARE STACK (Every Request Goes Through These)

```
1. cors()               → Allow frontend origin, credentials: true
2. express.json()       → Parse JSON body
3. cookieParser()       → Parse httpOnly refresh token cookie
4. rateLimiter()        → Per-IP rate limits (stricter on auth routes)
5. authenticate()       → Verify JWT accessToken → attach req.user
6. authorizeWorkspace() → Verify user belongs to requested workspace
7. authorizeRole()      → Check user has required role (ADMIN, OWNER, etc.)
8. validateBody(schema) → Zod schema validation on request body
9. errorHandler()       → Catch all errors, return clean JSON response
```

---

## 13. BACKEND FOLDER STRUCTURE

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts       Prisma client singleton
│   │   ├── redis.ts          ioredis pub + sub clients
│   │   ├── minio.ts          MinIO client + bucket init
│   │   └── email.ts          Nodemailer transport
│   │
│   ├── middleware/
│   │   ├── authenticate.ts   JWT verify → req.user
│   │   ├── authorize.ts      Role checks
│   │   ├── validate.ts       Zod body validation
│   │   ├── rateLimiter.ts    Per-route rate limits
│   │   └── errorHandler.ts   Global error catcher
│   │
│   ├── routes/               One file per resource
│   │   ├── auth.ts
│   │   ├── workspaces.ts
│   │   ├── invites.ts
│   │   ├── spaces.ts
│   │   ├── folders.ts
│   │   ├── lists.ts
│   │   ├── tasks.ts
│   │   ├── chats.ts
│   │   ├── channels.ts
│   │   ├── upload.ts
│   │   ├── notifications.ts
│   │   ├── dashboard.ts
│   │   └── planner.ts
│   │
│   ├── controllers/          Business logic, one per route file
│   │   └── (mirrors routes/)
│   │
│   ├── services/             Reusable cross-controller logic
│   │   ├── email.service.ts  Send templated emails
│   │   ├── minio.service.ts  upload / presign / delete
│   │   ├── notification.service.ts  Create + push notifications
│   │   └── sse.service.ts    Manage SSE client connections
│   │
│   ├── socket/
│   │   ├── index.ts          Socket.io init + Redis adapter + auth
│   │   ├── dm.socket.ts      DM message handlers
│   │   ├── channel.socket.ts Channel message handlers
│   │   ├── presence.socket.ts  Online/offline/typing
│   │   └── task.socket.ts    Task update broadcasters
│   │
│   ├── schemas/              Zod schemas for all request bodies
│   │   └── (mirrors routes/)
│   │
│   └── server.ts             Express app + Socket.io + startup
│
├── prisma/
│   └── schema.prisma
│
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 14. BUILD ORDER (What to Build First)

```
PHASE 1 — Auth + Foundation (Days 1–2)
  ✅ server.ts (Express setup, middleware chain)
  ✅ Prisma schema + first migration
  ✅ POST /api/auth/register
  ✅ POST /api/auth/login (JWT + refresh cookie)
  ✅ POST /api/auth/refresh
  ✅ GET /api/auth/me
  ✅ authenticate middleware

PHASE 2 — Workspace + Invites (Days 3–4)
  ✅ Workspace CRUD
  ✅ WorkspaceMember management
  ✅ Invite system (send + accept + decline)
  ✅ Nodemailer setup + workspace invite email

PHASE 3 — Spaces (Days 5–7) ← HEART OF THE APP
  ✅ Space CRUD + reorder
  ✅ Folder CRUD + reorder
  ✅ List CRUD + reorder
  ✅ Task CRUD + reorder + move
  ✅ Subtasks
  ✅ Custom statuses per space
  ✅ Task comments
  ✅ Task watchers + assignment notifications (email)
  ✅ Task:updated broadcast via Socket.io

PHASE 4 — Chat (Days 8–10)
  ✅ Socket.io server + Redis adapter
  ✅ Presence (online/offline heartbeat)
  ✅ DM invite flow (request → accept → chat)
  ✅ Real-time DM messages (send, edit, delete, typing)
  ✅ Channel create/join/leave
  ✅ Real-time channel messages
  ✅ Unread counts
  ✅ Message pagination (cursor-based)

PHASE 5 — Files + Dashboard (Days 11–12)
  ✅ MinIO setup + bucket creation
  ✅ Avatar upload
  ✅ Task attachment upload + presigned download
  ✅ Chat file upload
  ✅ Dashboard metrics endpoint
  ✅ Planner / Timeline endpoint

PHASE 6 — Notifications + Polish (Days 13–14)
  ✅ SSE notification stream
  ✅ In-app notifications (all types)
  ✅ Mark read / clear all
  ✅ Email notifications (task assigned, mention, due date)
  ✅ Rate limiting on all routes
  ✅ Error handling cleanup
  ✅ Input validation (Zod) on all routes
```

---

## 15. ENV FILE

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wavework"

# JWT
JWT_SECRET=change_this_to_a_long_random_string_in_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=another_long_random_string
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=wavework-uploads

# Email (Gmail App Password — NOT your real Gmail password)
# Get at: myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx

# App URL (for email links)
APP_URL=http://localhost:5173
```

---

## HOW TO USE THIS DOCUMENT WITH ANTIGRAVITY

When building each phase, give the agent only that phase's section:

```
@AGENT_RULES.md

Task: Build Phase 3 — Spaces for WaveWork.ai backend.
Reference: WAVEWORK_BACKEND.md Section 3.3–3.6 (schema) and Section 4 (routes for spaces, folders, lists, tasks).

Stack: Node.js + Express + TypeScript + Prisma + PostgreSQL + Socket.io

Files to create:
  - src/routes/spaces.ts
  - src/routes/folders.ts
  - src/routes/lists.ts
  - src/routes/tasks.ts
  - src/controllers/space.controller.ts
  - src/controllers/folder.controller.ts
  - src/controllers/list.controller.ts
  - src/controllers/task.controller.ts
  - src/schemas/space.schema.ts
  - src/schemas/task.schema.ts
  (add models to prisma/schema.prisma)

Do not touch auth, chat, or any other existing files.
After completing, list every file modified and explain each change.
```
