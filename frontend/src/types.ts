export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  color: string;
  timezone: string;
  role: string;
  uid?: string;
}

export interface Space {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  icon: string;
  isPrivate: boolean;
}

export interface Folder {
  id: string;
  spaceId: string;
  name: string;
  color?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'dropdown' | 'rating';
  options?: string[];
}

export interface List {
  id: string;
  spaceId: string;
  folderId?: string;
  name: string;
  createdAt: string;
  customFields?: CustomField[];
}

export interface TaskChecklistItem {
  id: string;
  label: string;
  isChecked: boolean;
}

export interface Task {
  id: string;
  listId: string;
  parentTaskId?: string;
  name: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NONE';
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  order: number;
  tags: string[];
  timeEstimate?: number; // in minutes
  timeTracked?: number; // in minutes
  customFields?: Record<string, any>;
  checklist?: TaskChecklistItem[];
  createdById: string;
  isPersonal?: boolean;
  taskSource?: string;
  assignedById?: string;
  deleteRequestStatus?: string;
  deleteRequestReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  taskId: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isDM: boolean;
  isGroup?: boolean;
  memberIds: string[];
  adminIds?: string[];
  logoUrl?: string;
  unreadCount?: Record<string, number>;
  lastMessageAt?: string;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
  taskId?: string | null;
  savedByIds: string[];
  reactions: MessageReaction[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'ASSIGNMENT' | 'COMMENT' | 'STATUS_CHANGE' | 'MENTIONS' | 'CHAT_SAVE';
  title: string;
  body: string;
  entityId: string;
  entityType: 'TASK' | 'MESSAGE';
  isRead: boolean;
  isSaved?: boolean;
  createdAt: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'dropdown';
  label: string;
  required: boolean;
  options?: string[];
}

export interface Form {
  id: string;
  listId: string;
  name: string;
  description: string;
  slug: string;
  fields: FormField[];
  isPublic: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface Sketch {
  id: string;
  userId: string;
  title: string;
  bg: string;
  strokes: Stroke[];
  createdAt: string;
}

export interface DashboardMetrics {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdueTasks: number;
  completedThisWeek: number;
  memberWorkload: Record<string, number>;
  spaceProgress: Record<string, number>;
}
