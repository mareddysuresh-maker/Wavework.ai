import { User, Space, Folder, List, Task, Comment, Channel, Message, Notification, Form, Note, Sketch, DashboardMetrics } from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const storedUserId = sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId') || 'u-1';
  const token = sessionStorage.getItem('socketToken') || localStorage.getItem('socketToken');

  const headers = new Headers(options.headers);
  headers.append('Content-Type', 'application/json');
  headers.append('X-Active-User-Id', storedUserId);
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Users
  getPublicUsers: () => request<User[]>('/public/users'),
  getUsers: () => request<User[]>('/users'),
  getActiveUser: () => request<User>('/active-user'),
  switchActiveUser: (userId: string) => {
    sessionStorage.setItem('activeUserId', userId);
    localStorage.setItem('activeUserId', userId);
    return request<{ success: boolean; activeUser: User }>('/active-user/switch', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },
  checkWorkspaceExists: () => request<{ workspaceExists: boolean }>('/auth/workspace-exists'),
  getInvitationById: (id: string) => request<any>(`/auth/invitations/${id}`),
  setupFirstWorkspace: (data: Record<string, any>) => request<{ success: boolean; user: User; token: string; workspaces: any[] }>('/auth/setup-first-workspace', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createWorkspace: (data: Record<string, any>) => request<{ success: boolean; user: User; token: string; workspaces: any[] }>('/auth/create-workspace', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  switchWorkspace: (workspaceId: string) => request<{ success: boolean; user: User; token: string; workspaces: any[] }>('/auth/switch-workspace', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  }),
  signup: (signupData: Record<string, any>) => request<{ success: boolean; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(signupData),
  }),
  login: (loginData: Record<string, any>) => request<{
    token: string; success: boolean; user: User; workspaces?: any[]
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  }),
  forgotPassword: (data: { email: string }) => request<{ success: boolean; message: string; otpForDev?: string; previewUrl?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyResetPassword: (data: Record<string, any>) => request<{ success: boolean; message: string }>('/auth/verify-reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  promoteUser: (id: string) => request<{ success: boolean; user: User }>(`/users/${id}/promote`, { method: 'POST' }),
  demoteUser: (id: string) => request<{ success: boolean; user: User }>(`/users/${id}/demote`, { method: 'POST' }),
  updateUserRole: (id: string, role: string) => request<{ success: boolean; user: User }>(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }),
  deactivateUser: (id: string) => request<{ success: boolean }>(`/users/${id}/deactivate`, { method: 'POST' }),
  deleteUser: (id: string) => request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),


  // Spaces
  getSpaces: () => request<Space[]>('/spaces'),
  createSpace: (space: Partial<Space>) => request<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify(space),
  }),
  deleteSpace: (id: string) => request<{ success: boolean }>(`/spaces/${id}`, {
    method: 'DELETE',
  }),
  addSpaceMember: (spaceId: string, userId: string) => request<Space>(`/spaces/${spaceId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),
  leaveSpace: (spaceId: string) => request<Space>(`/spaces/${spaceId}/members/me`, {
    method: 'DELETE',
  }),
  removeSpaceMember: (spaceId: string, userId: string) => request<Space>(`/spaces/${spaceId}/members/${userId}`, {
    method: 'DELETE',
  }),

  // Folders
  getFolders: (spaceId: string) => request<Folder[]>(`/spaces/${spaceId}/folders`),
  createFolder: (folder: Partial<Folder>) => request<Folder>('/folders', {
    method: 'POST',
    body: JSON.stringify(folder),
  }),

  // Lists
  getLists: () => request<List[]>('/lists'),
  createList: (list: Partial<List>) => request<List>('/lists', {
    method: 'POST',
    body: JSON.stringify(list),
  }),
  deleteList: (id: string) => request<{ success: boolean }>(`/lists/${id}`, {
    method: 'DELETE',
  }),

  // Tasks
  getTasks: () => request<Task[]>('/tasks'),
  createTask: (task: Partial<Task>) => request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }),
  updateTask: (id: string, updates: Partial<Task>) => request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),
  deleteTask: (id: string) => request<{ success: boolean }>(`/tasks/${id}`, {
    method: 'DELETE',
  }),
  convertToAdminTask: (id: string) => request<Task>(`/tasks/${id}/convert-to-admin-task`, {
    method: 'PATCH',
  }),
  requestDeleteTask: (id: string, reason: string) => request<Task>(`/tasks/${id}/request-delete`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  decideDeleteTask: (id: string, action: 'approve' | 'reject') => request<Task>(`/tasks/${id}/decide-delete`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  }),

  // Files Hub
  getFiles: () => request<any[]>('/files'),
  toggleFilePin: (fileId: string) => request<{ success: boolean }>(`/files/${fileId}/pin`, { method: 'POST' }),
  toggleFileFavorite: (fileId: string) => request<{ success: boolean }>(`/files/${fileId}/favorite`, { method: 'POST' }),
  updateFileAlias: (fileId: string, alias: string) => request<{ success: boolean }>(`/files/${fileId}/alias`, {
    method: 'PUT',
    body: JSON.stringify({ alias }),
  }),

  // Task Comments
  getComments: (taskId: string) => request<Comment[]>(`/tasks/${taskId}/comments`),
  addComment: (taskId: string, content: string) => request<Comment>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),

  // Dashboards Metrics Stats
  getDashboardStats: (workspaceId: string = 'w-1') => request<DashboardMetrics>(`/dashboard/stats/${workspaceId}`),

  // Live SSE connection URL builder helper
  getLiveSSEUrl: () => `${API_BASE}/dashboard/live`,

  // Messaging Collaboration Channels
  getChannels: () => request<Channel[]>('/channels'),
  createChannel: (channel: Partial<Channel>) => request<Channel>('/channels', {
    method: 'POST',
    body: JSON.stringify(channel),
  }),
  markChannelAsRead: (channelId: string) => request<Channel>(`/channels/${channelId}/read`, {
    method: 'POST',
  }),
  getMessages: (channelId: string) => request<Message[]>(`/channels/${channelId}/messages`),
  sendMessage: (channelId: string, content: string, options: { parentId?: string | null; taskId?: string | null; attachments?: any[] } = {}) =>
    request<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, ...options }),
    }),
  reactMessage: (messageId: string, emoji: string) => request<Message>(`/messages/${messageId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  }),
  saveMessage: (messageId: string) => request<Message>(`/messages/${messageId}/save`, {
    method: 'POST',
  }),
  inviteToChat: (email: string, name: string, channelId?: string) =>
    request<{ success: boolean; message: string; invitee: User }>('/chats/invite', {
      method: 'POST',
      body: JSON.stringify({ email, name, channelId }),
    }),

  // Unified Inbox Notifications
  getInbox: () => request<Notification[]>('/inbox'),
  markRead: (id: string) => request<{ success: boolean; item: Notification }>(`/inbox/${id}/read`, {
    method: 'PATCH',
  }),
  markAllRead: () => request<{ success: boolean }>('/inbox/read-all', {
    method: 'PATCH',
  }),
  toggleSaveLater: (id: string) => request<{ success: boolean; item: Notification }>(`/inbox/${id}/save-later`, {
    method: 'PATCH',
  }),
  createReminder: (title: string, body?: string) => request<Notification>('/inbox/custom-reminder', {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  }),

  // Portal Request Forms Builder Customizer
  getForms: () => request<Form[]>('/forms'),
  createForm: (form: Partial<Form>) => request<Form>('/forms', {
    method: 'POST',
    body: JSON.stringify(form),
  }),
  getPublicForm: (slug: string) => request<Form>(`/forms/public/${slug}`),
  submitPublicForm: (slug: string, submission: Record<string, any>) =>
    request<{ success: boolean; task: Task }>(`/forms/public/${slug}/submit`, {
      method: 'POST',
      body: JSON.stringify(submission),
    }),

  // Sidebar Notes Sheets Scratchpad
  getNotes: () => request<Note[]>('/notes'),
  createNote: (title?: string, content?: string) => request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  }),
  updateNote: (id: string, updates: { title?: string; content?: string }) => request<Note>(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),
  deleteNote: (id: string) => request<{ success: boolean }>(`/notes/${id}`, {
    method: 'DELETE',
  }),

  // Workspace Interactive Drawing Sketches
  getSketches: () => request<Sketch[]>('/sketches'),
  createSketch: (title?: string, bg?: string) => request<Sketch>('/sketches', {
    method: 'POST',
    body: JSON.stringify({ title, bg }),
  }),
  updateSketch: (id: string, updates: { title?: string; strokes?: any[]; bg?: string }) =>
    request<Sketch>(`/sketches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteSketch: (id: string) => request<{ success: boolean }>(`/sketches/${id}`, {
    method: 'DELETE',
  }),

  // Chat Requests flow (1-on-1 invitations)
  getChatRequests: () => request<any[]>('/chat-requests'),
  sendChatRequest: (email: string, name: string) => request<any>('/chat-requests', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  }),
  acceptChatRequest: (requestId: string) => request<{ success: boolean; channel: Channel }>(`/chat-requests/${requestId}/accept`, {
    method: 'POST',
  }),
  declineChatRequest: (requestId: string) => request<any>(`/chat-requests/${requestId}/decline`, {
    method: 'POST',
  }),

  // Group settings editor
  updateChannelSettings: (channelId: string, updates: {
    name?: string;
    description?: string;
    logoUrl?: string;
    adminIds?: string[];
    memberIds?: string[];
  }) => request<Channel>(`/channels/${channelId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),

  // Base64 document / docx / pdf attachment uploader
  uploadFileAttachment: (fileName: string, fileType: string, fileData: string) =>
    request<{ name: string; url: string; type: string; size: number }>('/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, fileData }),
    }),

  // Pomodoro settings and metrics tracking
  getPomodoroSettings: () => request<any>('/pomodoro/settings'),
  updatePomodoroSettings: (settings: {
    workDuration: number;
    shortBreak: number;
    longBreak: number;
    autoStartTime: boolean;
  }) => request<any>('/pomodoro/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
  getPomodoroSessions: () => request<any[]>('/pomodoro/sessions'),
  createPomodoroSession: (session: { taskId?: string; durationMinutes: number; type: string }) =>
    request<any>('/pomodoro/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),

  // Workspace Settings & Invitations & Activity Logs
  getWorkspaceSettings: () => request<any>('/workspaces/settings'),
  updateWorkspaceSettings: (settings: { name?: string; description?: string; logoUrl?: string }) => request<any>('/workspaces/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),
  getInvitations: () => request<any[]>('/workspaces/invitations'),
  createInvitation: (invitation: { email: string; role: string }) => request<any>('/workspaces/invitations', {
    method: 'POST',
    body: JSON.stringify(invitation)
  }),
  acceptInvitation: (id: string, acceptData: { name: string; password: string }) => request<{ success: boolean; user: User; token: string; workspaces?: any[] }>(`/workspaces/invitations/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify(acceptData)
  }),
  getActivityLogs: () => request<any[]>('/workspaces/activity-logs'),
};
export default api;
