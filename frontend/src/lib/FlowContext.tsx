import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Space, Folder, List, Task, Comment, Channel, Message, Notification, Form, Note, Sketch, DashboardMetrics } from '../types';
import { api } from './api';
import { io } from 'socket.io-client';

export type ViewType = 'DASHBOARD' | 'BOARD' | 'PLANNER' | 'CHAT' | 'INBOX' | 'FORMS' | 'NOTES' | 'WHITEBOARD';

export const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
    
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn("Notification sound blocked or unsupported:", e);
  }
};

interface FlowContextType {
  // State variables
  users: User[];
  activeUser: User | null;
  spaces: Space[];
  selectedSpace: Space | null;
  folders: Folder[];
  lists: List[];
  selectedList: List | null;
  tasks: Task[];
  channels: Channel[];
  selectedChannel: Channel | null;
  messages: Message[];
  inbox: Notification[];
  forms: Form[];
  notes: Note[];
  selectedNote: Note | null;
  sketches: Sketch[];
  selectedSketch: Sketch | null;
  metrics: DashboardMetrics | null;
  currentView: ViewType;
  isLoading: boolean;
  error: string | null;

  // View Controls
  setCurrentView: (view: ViewType) => void;
  setSelectedSpace: (space: Space | null) => void;
  setSelectedList: (list: List | null) => void;
  setSelectedChannel: (channel: Channel | null) => void;
  setSelectedNote: (note: Note | null) => void;
  setSelectedSketch: (sketch: Sketch | null) => void;

  // Actions Mutators
  switchUser: (userId: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  
  // Spaces & Hierarchy
  createSpace: (name: string, color: string, icon: string, isPrivate: boolean) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  createFolder: (spaceId: string, name: string, color?: string) => Promise<void>;
  createList: (spaceId: string, folderId: string | undefined, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // Tasks
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addTaskComment: (taskId: string, content: string) => Promise<Comment>;

  // Chat
  createChannel: (name: string, description: string, isDM: boolean, memberIds?: string[]) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendComment: (taskId: string, content: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  saveToInbox: (messageId: string) => Promise<void>;
  inviteUser: (email: string, name: string) => Promise<string>;
  onlineUserIds: string[];
  typingUsers: { userId: string; userName: string }[];
  notifyTyping: () => void;

  // Inbox Notifications
  markInboxRead: (id: string) => Promise<void>;
  markInboxAllRead: () => Promise<void>;
  toggleInboxSaveLater: (id: string) => Promise<void>;
  addPersonalReminder: (title: string, body?: string) => Promise<void>;

  // Public Custom Forms Customizer
  publishFormTemplate: (name: string, description: string, fields: any[]) => Promise<void>;

  // Notepad Scratchpads
  createScratchpad: (title?: string, content?: string) => Promise<Note>;
  editScratchpad: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  deleteScratchpad: (id: string) => Promise<void>;

  // Graphics Sketches Whiteboard
  createCanvasSketch: (title?: string, bg?: string) => Promise<Sketch>;
  editCanvasSketch: (id: string, updates: { title?: string; strokes?: any[]; bg?: string }) => Promise<void>;
  deleteCanvasSketch: (id: string) => Promise<void>;

  // Chat request flow & attachments uploader
  chatRequests: any[];
  sendChatRequest: (email: string, name: string) => Promise<void>;
  acceptChatRequest: (requestId: string) => Promise<void>;
  declineChatRequest: (requestId: string) => Promise<void>;
  updateChannelSettings: (channelId: string, updates: any) => Promise<void>;
  uploadFileAttachment: (fileName: string, fileType: string, fileData: string) => Promise<{ name: string; url: string; type: string; size: number }>;

  // Pomodoro Settings and focus history
  pomodoroSettings: any;
  pomodoroSessions: any[];
  updatePomodoroSettings: (settings: any) => Promise<void>;
  createPomodoroSession: (session: { taskId?: string; durationMinutes: number; type: string }) => Promise<void>;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

let globalSocket: any = null;

function getClientSocket() {
  if (!globalSocket) {
    console.log("[Socket.io-Client] Initiating singleton socket client...");
    globalSocket = io({
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });
  }
  return globalSocket;
}

function getSocketRoomName(channel: Channel | null): string {
  if (!channel) return '';
  if (channel.isDM) {
    const sortedUsers = [...(channel.memberIds || [])].sort();
    const u1 = sortedUsers[0] || 'unknown1';
    const u2 = sortedUsers[1] || 'unknown2';
    return `dm:${u1}:${u2}`;
  } else if (channel.isGroup) {
    return `group:${channel.id}`;
  } else {
    return `channel:${channel.id}`;
  }
}

export const FlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpaceState] = useState<Space | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedListState] = useState<List | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannelState] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inbox, setInbox] = useState<Notification[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNoteState] = useState<Note | null>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [selectedSketch, setSelectedSketchState] = useState<Sketch | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Chat requests and Pomodoro tracker state storage
  const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [pomodoroSettings, setPomodoroSettings] = useState<any>(null);
  const [pomodoroSessions, setPomodoroSessions] = useState<any[]>([]);

  // Socket.io real-time states
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);

  // Sync core lists data from API
  const triggerSync = useCallback(async () => {
    try {
      const updatedUsers = await api.getUsers();
      setUsers(updatedUsers);

      const active = await api.getActiveUser();
      setActiveUser(active);

      const updatedSpaces = await api.getSpaces();
      setSpaces(updatedSpaces);

      const updatedLists = await api.getLists();
      setLists(updatedLists);

      const updatedTasks = await api.getTasks();
      setTasks(updatedTasks);

      const updatedChannels = await api.getChannels();
      setChannels(updatedChannels);

      const updatedInbox = await api.getInbox();
      setInbox((prevInbox) => {
        const previousUnreadIds = new Set(prevInbox.filter(item => !item.isRead).map(item => item.id));
        const hasNewUnread = updatedInbox.some(item => !item.isRead && !previousUnreadIds.has(item.id));
        if (hasNewUnread && prevInbox.length > 0) {
          playNotificationSound();
        }
        return updatedInbox;
      });

      const updatedForms = await api.getForms();
      setForms(updatedForms);

      const updatedNotes = await api.getNotes();
      setNotes(updatedNotes);

      const updatedSketches = await api.getSketches();
      setSketches(updatedSketches);

      const dashboardStats = await api.getDashboardStats();
      setMetrics(dashboardStats);

      // Sync active invitations, pomodoro configurations and session progress logs
      const updatedChatReqs = await api.getChatRequests().catch(() => []);
      setChatRequests(updatedChatReqs);

      const pS = await api.getPomodoroSettings().catch(() => null);
      setPomodoroSettings(pS);

      const pSess = await api.getPomodoroSessions().catch(() => []);
      setPomodoroSessions(pSess);
    } catch (err: any) {
      console.warn('Sync notice (FlowUp context data):', err);
      // Suppress setting blocking error state for temporary connection resets during boot restarts
      if (err?.message !== 'Failed to fetch') {
        setError(err?.message || 'Sync failed');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch full lists initially and set up live syncing
  useEffect(() => {
    triggerSync();
    
    // Periodical polling loop to keep dashboard synced as a fallback
    const interval = setInterval(() => {
      triggerSync();
    }, 60000);

    return () => clearInterval(interval);
  }, [triggerSync]);

  // Establish SSE real-time listener for instant task changes and assignments
  useEffect(() => {
    const hasUserId = sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId') || (activeUser && activeUser.id);
    if (!hasUserId) return;

    console.log("[SSE] Connecting to live event stream...");
    const sseUrl = api.getLiveSSEUrl();
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      console.log("[SSE] Real-time event detected. Triggering dynamic sync...");
      triggerSync();
    };

    eventSource.onerror = (err) => {
      console.warn("[SSE] EventSource failed. Fallback polling maintains connection.", err);
    };

    return () => {
      eventSource.close();
      console.log("[SSE] Closed live event stream connection.");
    };
  }, [triggerSync, activeUser?.id]);

  // Establish stable singleton socket connection for real-time sync with heartbeats
  useEffect(() => {
    const activeUserId = activeUser?.id || sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId');
    if (!activeUserId) return;

    const s = getClientSocket();
    s.connect();

    console.log("[Socket.io-Client] Authenticating initial heartbeat...");
    s.emit('user:heartbeat', { userId: activeUserId, workspaceId: 'w-1' });

    // 3. Heartbeat refreshed every 20 seconds
    const interval = setInterval(() => {
      s.emit('user:heartbeat', { userId: activeUserId, workspaceId: 'w-1' });
    }, 20000);

    const handleConnect = () => {
      console.log("[Socket.io-Client] Connected successfully!");
      s.emit('user:heartbeat', { userId: activeUserId, workspaceId: 'w-1' });
      if (selectedChannel) {
        s.emit('room:join', getSocketRoomName(selectedChannel));
      }
    };

    const handlePresence = (onlineIds: string[]) => {
      setOnlineUserIds(onlineIds);
    };

    const handleMessageReceived = (msg: Message) => {
      console.log("[Socket.io-Client] Real-time message received:", msg);
      // Ensure idempotent check to guard against duplicates from multi-instances or re-connections
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleMessageUpdated = (msg: Message) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    };

    const handleTypingUpdate = (payload: { roomId: string; typingUsers: { userId: string; userName: string }[] }) => {
      if (selectedChannel && payload.roomId === getSocketRoomName(selectedChannel)) {
        setTypingUsers((payload.typingUsers || []).filter(u => u.userId !== activeUserId));
      }
    };

    const handleInviteReceived = (invite: any) => {
      console.log("[Socket.io-Client] Real-time invite received:", invite);
      triggerSync();
    };

    const handleInviteAccepted = (channel: Channel) => {
      console.log("[Socket.io-Client] Real-time invite accepted:", channel);
      triggerSync();
      setSelectedChannelState(channel);
      api.getMessages(channel.id).then(setMessages).catch(console.error);
    };

    s.on('connect', handleConnect);
    s.on('presence:update', handlePresence);
    s.on('message:received', handleMessageReceived);
    s.on('message:updated', handleMessageUpdated);
    s.on('typing:update', handleTypingUpdate);
    s.on('invite:received', handleInviteReceived);
    s.on('invite:accepted', handleInviteAccepted);

    return () => {
      clearInterval(interval);
      s.off('connect', handleConnect);
      s.off('presence:update', handlePresence);
      s.off('message:received', handleMessageReceived);
      s.off('message:updated', handleMessageUpdated);
      s.off('typing:update', handleTypingUpdate);
      s.off('invite:received', handleInviteReceived);
      s.off('invite:accepted', handleInviteAccepted);
      s.emit('user:offline', { userId: activeUserId, workspaceId: 'w-1' });
    };
  }, [activeUser?.id, selectedChannel?.id, triggerSync]);

  // Handle joining and leaving rooms cleanly
  useEffect(() => {
    const s = getClientSocket();
    if (!s || !selectedChannel) return;

    const roomName = getSocketRoomName(selectedChannel);
    s.emit('room:join', roomName);
    setTypingUsers([]);

    return () => {
      s.emit('room:leave', roomName);
    };
  }, [selectedChannel?.id]);

  // Notify Typing
  const notifyTyping = () => {
    const s = getClientSocket();
    const activeUserId = activeUser?.id || sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId');
    if (s && selectedChannel && activeUserId) {
      const roomName = getSocketRoomName(selectedChannel);
      s.emit('typing:start', { roomId: roomName, userId: activeUserId, userName: activeUser?.name || 'Someone' });
    }
  };

  // Set selected space wrapper that auto filters lists
  const setSelectedSpace = (space: Space | null) => {
    setSelectedSpaceState(space);
    if (space) {
      // Auto-load lists first inside this space
      const spaceLists = lists.filter(l => l.spaceId === space.id);
      if (spaceLists.length > 0) {
        setSelectedListState(spaceLists[0]);
      } else {
        setSelectedListState(null);
      }
      
      // Auto transition to board view for task inspection
      if (currentView === 'CHAT' || currentView === 'INBOX' || currentView === 'FORMS') {
        setCurrentView('BOARD');
      }
    }
  };

  const setSelectedList = (list: List | null) => {
    setSelectedListState(list);
  };

  const setSelectedChannel = (channel: Channel | null) => {
    setSelectedChannelState(channel);
    if (channel) {
      // Sync messages immediately
      api.getMessages(channel.id).then(setMessages).catch(console.error);
    }
  };

  const setSelectedNote = (note: Note | null) => {
    setSelectedNoteState(note);
  };

  const setSelectedSketch = (sketch: Sketch | null) => {
    setSelectedSketchState(sketch);
  };

  // Sync channel messages when active chat exists
  useEffect(() => {
    if (selectedChannel) {
      const msgInterval = setInterval(() => {
        api.getMessages(selectedChannel.id).then(setMessages).catch(console.error);
      }, 30000);
      return () => clearInterval(msgInterval);
    }
  }, [selectedChannel]);

  // Actions Mutators implementation
  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      await api.switchActiveUser(userId);
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Hierarchy
  const createSpace = async (name: string, color: string, icon: string, isPrivate: boolean) => {
    try {
      const generated = await api.createSpace({ name, color, icon, isPrivate });
      await triggerSync();
      setSelectedSpace(generated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteSpace = async (id: string) => {
    try {
      await api.deleteSpace(id);
      if (selectedSpace?.id === id) {
        setSelectedSpaceState(null);
        setSelectedListState(null);
      }
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createFolder = async (spaceId: string, name: string, color?: string) => {
    try {
      await api.createFolder({ spaceId, name, color });
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createList = async (spaceId: string, folderId: string | undefined, name: string) => {
    try {
      const generated = await api.createList({ spaceId, folderId, name });
      await triggerSync();
      setSelectedList(generated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteList = async (id: string) => {
    try {
      await api.deleteList(id);
      await triggerSync();
      if (selectedList?.id === id) {
        setSelectedList(undefined);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Tasks
  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    try {
      const completedTask = await api.createTask(taskData);
      await triggerSync();
      return completedTask;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      // Optimistic state updates
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } as Task : t));
      await api.updateTask(id, updates);
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setTasks(prev => prev.filter(t => t.id !== id));
      await api.deleteTask(id);
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addTaskComment = async (taskId: string, content: string): Promise<Comment> => {
    try {
      const commentObj = await api.addComment(taskId, content);
      return commentObj;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Instant messaging
  const createChannel = async (name: string, description: string, isDM: boolean, memberIds?: string[], logoUrl?: string) => {
    try {
      const gen = await api.createChannel({ name, description, isPrivate: isDM, isDM, memberIds, logoUrl });
      await triggerSync();
      setSelectedChannel(gen);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedChannel) return;
    try {
      // Send the chat line
      const line = await api.sendMessage(selectedChannel.id, content);
      setMessages(prev => {
        if (prev.some(m => m.id === line.id)) return prev;
        return [...prev, line];
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sendComment = async (taskId: string, content: string) => {
    try {
      await api.addComment(taskId, content);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    try {
      const updated = await api.reactMessage(messageId, emoji);
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveToInbox = async (messageId: string) => {
    try {
      const updated = await api.saveMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      const updatedInbox = await api.getInbox();
      setInbox(updatedInbox);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const inviteUser = async (email: string, name: string): Promise<string> => {
    try {
      const result = await api.inviteToChat(email, name, selectedChannel?.id);
      await triggerSync();
      return result.message;
    } catch (err: any) {
      setError(err.message);
      return `Failed to invite: ${err.message}`;
    }
  };

  // Inbox Notifications
  const markInboxRead = async (id: string) => {
    try {
      setInbox(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      await api.markRead(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markInboxAllRead = async () => {
    try {
      setInbox(prev => prev.map(n => ({ ...n, isRead: true })));
      await api.markAllRead();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleInboxSaveLater = async (id: string) => {
    try {
      await api.toggleSaveLater(id);
      const updated = await api.getInbox();
      setInbox(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addPersonalReminder = async (title: string, body?: string) => {
    try {
      await api.createReminder(title, body);
      const updated = await api.getInbox();
      setInbox(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Custom Forms
  const publishFormTemplate = async (name: string, description: string, fields: any[]) => {
    try {
      if (!selectedList) throw new Error('Choose a list first in sidebar directory before publishing custom forms');
      await api.createForm({
        listId: selectedList.id,
        name,
        description,
        fields,
      });
      await triggerSync();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Scratchpad stickies notes
  const createScratchpad = async (title?: string, content?: string): Promise<Note> => {
    try {
      const response = await api.createNote(title, content);
      await triggerSync();
      setSelectedNote(response);
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const editScratchpad = async (id: string, updates: { title?: string; content?: string }) => {
    try {
      // Optimistic updates
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } as Note : n));
      if (selectedNote?.id === id) {
        setSelectedNoteState(prev => prev ? { ...prev, ...updates } as Note : null);
      }
      await api.updateNote(id, updates);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteScratchpad = async (id: string) => {
    try {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNote?.id === id) setSelectedNoteState(null);
      await api.deleteNote(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Paintings Whiteboard
  const createCanvasSketch = async (title?: string, bg?: string): Promise<Sketch> => {
    try {
      const response = await api.createSketch(title, bg);
      await triggerSync();
      setSelectedSketch(response);
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const editCanvasSketch = async (id: string, updates: { title?: string; strokes?: any[]; bg?: string }) => {
    try {
      setSketches(prev => prev.map(s => s.id === id ? { ...s, ...updates } as Sketch : s));
      if (selectedSketch?.id === id) {
        setSelectedSketchState(prev => prev ? { ...prev, ...updates } as Sketch : null);
      }
      await api.updateSketch(id, updates);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteCanvasSketch = async (id: string) => {
    try {
      setSketches(prev => prev.filter(s => s.id !== id));
      if (selectedSketch?.id === id) setSelectedSketchState(null);
      await api.deleteSketch(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Chat invitations flow
  const sendChatRequest = async (email: string, name: string) => {
    try {
      await api.sendChatRequest(email, name);
      const reqs = await api.getChatRequests();
      setChatRequests(reqs);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const acceptChatRequest = async (requestId: string) => {
    try {
      const res = await api.acceptChatRequest(requestId);
      const reqs = await api.getChatRequests();
      setChatRequests(reqs);
      
      await triggerSync();
      if (res.channel) {
        setSelectedChannel(res.channel);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const declineChatRequest = async (requestId: string) => {
    try {
      await api.declineChatRequest(requestId);
      const reqs = await api.getChatRequests();
      setChatRequests(reqs);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Group settings update action
  const updateChannelSettings = async (channelId: string, updates: any) => {
    try {
      const result = await api.updateChannelSettings(channelId, updates);
      setChannels(prev => prev.map(ch => ch.id === channelId ? result : ch));
      if (selectedChannel?.id === channelId) {
        setSelectedChannelState(result);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Upload attachment document or photo
  const uploadFileAttachment = async (fileName: string, fileType: string, fileData: string) => {
    try {
      return await api.uploadFileAttachment(fileName, fileType, fileData);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Pomodoro focus trackers actions
  const updatePomodoroSettings = async (settings: any) => {
    try {
      const result = await api.updatePomodoroSettings(settings);
      setPomodoroSettings(result);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createPomodoroSession = async (session: { taskId?: string; durationMinutes: number; type: string }) => {
    try {
      const result = await api.createPomodoroSession(session);
      setPomodoroSessions(prev => [result, ...prev]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Bidirectional routing via url hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#/')) return;
      
      const parts = hash.substring(2).split('?');
      const viewPath = parts[0] as ViewType;
      const queryStr = parts[1] || '';
      
      const params = new URLSearchParams(queryStr);
      const spaceId = params.get('space');
      const listId = params.get('list');
      const channelId = params.get('channel');
      const noteId = params.get('note');
      const sketchId = params.get('sketch');

      const validViews: ViewType[] = ['DASHBOARD', 'BOARD', 'PLANNER', 'CHAT', 'INBOX', 'FORMS', 'NOTES', 'WHITEBOARD'];
      if (validViews.includes(viewPath) && viewPath !== currentView) {
        setCurrentView(viewPath);
      }
      
      if (spaces.length > 0 && spaceId) {
        const found = spaces.find(s => s.id === spaceId) || null;
        if (found && found.id !== selectedSpace?.id) {
          setSelectedSpaceState(found);
        }
      }
      if (lists.length > 0 && listId) {
        const found = lists.find(l => l.id === listId) || null;
        if (found && found.id !== selectedList?.id) {
          setSelectedListState(found);
        }
      }
      if (channels.length > 0 && channelId) {
        const found = channels.find(c => c.id === channelId) || null;
        if (found && found.id !== selectedChannel?.id) {
          setSelectedChannelState(found);
        }
      }
      if (notes.length > 0 && noteId) {
        const found = notes.find(n => n.id === noteId) || null;
        if (found && found.id !== selectedNote?.id) {
          setSelectedNoteState(found);
        }
      }
      if (sketches.length > 0 && sketchId) {
        const found = sketches.find(sk => sk.id === sketchId) || null;
        if (found && found.id !== selectedSketch?.id) {
          setSelectedSketchState(found);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (spaces.length > 0 || lists.length > 0 || channels.length > 0) {
      handleHashChange();
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [spaces, lists, channels, notes, sketches]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSpace) params.set('space', selectedSpace.id);
    if (selectedList) params.set('list', selectedList.id);
    if (selectedChannel) params.set('channel', selectedChannel.id);
    if (selectedNote) params.set('note', selectedNote.id);
    if (selectedSketch) params.set('sketch', selectedSketch.id);
    
    const query = params.toString();
    const newHash = `#/${currentView}${query ? '?' + query : ''}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, [currentView, selectedSpace?.id, selectedList?.id, selectedChannel?.id, selectedNote?.id, selectedSketch?.id]);

  return (
    <FlowContext.Provider value={{
      users, activeUser, spaces, selectedSpace, folders, lists, selectedList, tasks,
      channels, selectedChannel, messages, inbox, forms, notes, selectedNote, sketches,
      selectedSketch, metrics, currentView, isLoading, error,
      chatRequests, pomodoroSettings, pomodoroSessions,
      onlineUserIds, typingUsers, notifyTyping,
      setCurrentView, setSelectedSpace, setSelectedList, setSelectedChannel, setSelectedNote, setSelectedSketch,
      switchUser, triggerSync,
      createSpace, deleteSpace, createFolder, createList, deleteList,
      createTask, updateTask, deleteTask, addTaskComment,
      createChannel, sendMessage, sendComment, reactToMessage, saveToInbox, inviteUser,
      markInboxRead, markInboxAllRead, toggleInboxSaveLater, addPersonalReminder,
      publishFormTemplate,
      createScratchpad, editScratchpad, deleteScratchpad,
      createCanvasSketch, editCanvasSketch, deleteCanvasSketch,
      sendChatRequest, acceptChatRequest, declineChatRequest, updateChannelSettings, uploadFileAttachment,
      updatePomodoroSettings, createPomodoroSession
    }}>
      {children}
    </FlowContext.Provider>
  );
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (context === undefined) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context;
};
