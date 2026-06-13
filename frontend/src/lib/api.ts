import { User, Space, Folder, List, Task, Comment, Channel, Message, Notification, Form, Note, Sketch, DashboardMetrics } from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Read active user ID from session state (per-tab) first, then local state if switching
  const storedUserId = sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId') || 'u-1';
  
  const headers = new Headers(options.headers);
  headers.append('Content-Type', 'application/json');
  headers.append('X-Active-User-Id', storedUserId);

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
  signup: (signupData: Record<string, any>) => request<{ success: boolean; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(signupData),
  }),
  login: (loginData: Record<string, any>) => request<{ success: boolean; user: User }>('/auth/login', {
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

  // Spaces
  getSpaces: () => request<Space[]>('/spaces'),
  createSpace: (space: Partial<Space>) => request<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify(space),
  }),
  deleteSpace: (id: string) => request<{ success: boolean }>(`/spaces/${id}`, {
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
  getMessages: (channelId: string) => request<Message[]>(`/channels/${channelId}/messages`),
  sendMessage: (channelId: string, content: string, options: { parentId?: string | null; taskId?: string | null } = {}) => 
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
};
export default api;
