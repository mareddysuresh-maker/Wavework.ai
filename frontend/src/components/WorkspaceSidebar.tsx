import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFlow, ViewType } from '../lib/FlowContext';
import { api } from '../lib/api';
import { 
  BarChart2, 
  Kanban, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Inbox, 
  ClipboardList, 
  Plus, 
  Folder as FolderIcon, 
  Hash, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Trash2,
  StickyNote,
  PenTool,
  Users,
  Settings,
  X,
  Mail,
  UserCheck,
  CheckSquare,
  LogOut,
  FolderHeart,
  FolderOpen,
  Info,
  History,
  Building
} from 'lucide-react';

interface WorkspaceSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ isOpen, onClose }) => {
  const {
    users,
    activeUser,
    spaces,
    selectedSpace,
    setSelectedSpace,
    lists,
    selectedList,
    setSelectedList,
    channels,
    selectedChannel,
    setSelectedChannel,
    currentView,
    setCurrentView,
    createSpace,
    deleteSpace,
    createList,
    deleteList,
    switchUser,
    inbox,
    inviteUser,
    createChannel,
    sendChatRequest,
    createTask
  } = useFlow();

  const isSuperAdmin = activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'OWNER';
  const isAdmin = activeUser?.role === 'ADMIN' || activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'OWNER';
  const isEmployee = !isAdmin;

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignSpaceId, setAssignSpaceId] = useState('');
  const [assignListId, setAssignListId] = useState('');
  const [assignPriority, setAssignPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignAttachments, setAssignAttachments] = useState<{name: string, url: string, type: string, size: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
  const [manageMembersSpace, setManageMembersSpace] = useState<any>(null);
  const [manageSpaceMembers, setManageSpaceMembers] = useState<string[]>([]);
  
  // Confirmation states
  const [confirmDeleteSpaceId, setConfirmDeleteSpaceId] = useState<string | null>(null);
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);

  // Workspace switching states
  const [userWorkspaces, setUserWorkspaces] = useState<any[]>([]);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [newWorkspaceNameInput, setNewWorkspaceNameInput] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [newWorkspaceLogo, setNewWorkspaceLogo] = useState('');
  const [workspaceSwitchLoading, setWorkspaceSwitchLoading] = useState(false);

  React.useEffect(() => {
    api.getActiveUser().then(res => {
      if ((res as any).workspaces) {
        setUserWorkspaces((res as any).workspaces);
      }
    }).catch(err => console.error("Failed to load user workspaces:", err));
  }, [activeUser]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceSwitchLoading) return;
    setWorkspaceSwitchLoading(true);
    setShowWorkspaceDropdown(false);
    try {
      const data = await api.switchWorkspace(workspaceId);
      if (data.success) {
        if (data.token) {
          sessionStorage.setItem('socketToken', data.token);
        }
        await switchUser(activeUser.id);
        window.location.reload();
      }
    } catch (err: any) {
      alert("Failed to switch workspace: " + err.message);
    } finally {
      setWorkspaceSwitchLoading(false);
    }
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceNameInput.trim()) return;
    try {
      const data = await api.createWorkspace({
        name: newWorkspaceNameInput.trim(),
        description: newWorkspaceDesc.trim(),
        logoUrl: newWorkspaceLogo.trim()
      });
      if (data.success) {
        setNewWorkspaceNameInput('');
        setNewWorkspaceDesc('');
        setNewWorkspaceLogo('');
        setIsNewWorkspaceModalOpen(false);
        if (data.token) {
          sessionStorage.setItem('socketToken', data.token);
        }
        window.location.reload();
      }
    } catch (err: any) {
      alert("Failed to create workspace: " + err.message);
    }
  };
  
  // Creation States
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState('#6366f1');
  const [newSpaceMembers, setNewSpaceMembers] = useState<string[]>([]);
  const [newListName, setNewListName] = useState('');
  
  // Invite States
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  // Custom Chat Dialogue Dialog States (replaces blocked prompt alerts)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatModalType, setChatModalType] = useState<'CHANNEL' | 'DM'>('CHANNEL');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelLogo, setNewChannelLogo] = useState('');
  const [dmSelectedUserId, setDmSelectedUserId] = useState('');
  const [dmEmail, setDmEmail] = useState('');
  const [dmName, setDmName] = useState('');
  const [dmSuccessMessage, setDmSuccessMessage] = useState('');
  const [dmErrorMessage, setDmErrorMessage] = useState('');

  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({ 's-1': true, 's-2': true });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    progress: true,
    myTasks: true,
    personalSpace: true,
    spaces: true,
    channels: true,
    dms: true,
    settings: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSpaceExpand = (spaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSpaces(prev => ({ ...prev, [spaceId]: !prev[spaceId] }));
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    await createSpace(newSpaceName, newSpaceColor, 'Cpu', false, newSpaceMembers);
    setNewSpaceName('');
    setNewSpaceMembers([]);
    setIsSpaceModalOpen(false);
  };

  const handleUpdateSpaceMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageMembersSpace) return;
    
    // Compute added vs removed members
    const oldMembers = manageMembersSpace.memberIds || [];
    const added = manageSpaceMembers.filter(id => !oldMembers.includes(id));
    const removed = oldMembers.filter((id: string) => !manageSpaceMembers.includes(id));
    
    try {
      for (const id of added) {
        await api.addSpaceMember(manageMembersSpace.id, id);
      }
      for (const id of removed) {
        await api.removeSpaceMember(manageMembersSpace.id, id);
      }
      setIsManageMembersModalOpen(false);
      setManageMembersSpace(null);
      // Trigger a sync to get the latest space data
      const s = getClientSocket();
      s.emit('user:heartbeat', { userId: activeUser?.id, workspaceId: 'w-1' }); // This isn't the sync function, let's just reload the page for now or rely on SSE
      window.location.reload();
    } catch (err: any) {
      alert("Failed to update members: " + err.message);
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) return;

    // Use selected list form modal, or fallback to first available
    const listToUse = assignListId || (lists && lists.length > 0 ? lists[0].id : 'l-1');

    try {
      if (assignUserIds.length === 0) {
        await createTask({
          listId: listToUse,
          name: assignTitle.trim(),
          description: assignDesc.trim(),
          priority: assignPriority,
          status: 'TODO',
          dueDate: assignDueDate,
          assigneeId: null,
          customFields: {
            attachments: assignAttachments
          }
        });
      } else {
        // Dispatch a separate task copy for each selected assignee to ensure workspace privacy
        for (const assigneeId of assignUserIds) {
          await createTask({
            listId: listToUse,
            name: assignTitle.trim(),
            description: assignDesc.trim(),
            priority: assignPriority,
            status: 'TODO',
            dueDate: assignDueDate,
            assigneeId: assigneeId,
            customFields: {
              attachments: assignAttachments
            }
          });
        }
      }
      setIsAssignModalOpen(false);
      // Reset
      setAssignTitle('');
      setAssignDesc('');
      setAssignUserIds([]);
      setAssignSpaceId('');
      setAssignListId('');
      setAssignPriority('NORMAL');
      setAssignDueDate('');
      setAssignAttachments([]);
    } catch (err: any) {
      alert("Failed to assign task: " + err.message);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !selectedSpace) return;
    await createList(selectedSpace.id, undefined, newListName);
    setNewListName('');
    setIsListModalOpen(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    const msg = await inviteUser(inviteEmail, inviteName);
    setInviteMsg(msg);
    setInviteEmail('');
    setInviteName('');
    setTimeout(() => setInviteMsg(''), 4000);
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      await createChannel(
        newChannelName.trim(),
        newChannelDesc.trim() || 'Interactive workspace discussion room',
        false,
        [],
        newChannelLogo.trim()
      );
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelLogo('');
      setIsChatModalOpen(false);
      setCurrentView('CHAT');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateDmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDmErrorMessage('');
    setDmSuccessMessage('');

    try {
      // 1. Direct DM with selected user
      if (dmSelectedUserId) {
        const colleague = users.find(u => u.id === dmSelectedUserId);
        if (colleague && activeUser) {
          await createChannel(
            colleague.name,
            `Direct Message with ${colleague.name}`,
            true,
            [activeUser.id, colleague.id]
          );
          setDmSelectedUserId('');
          setIsChatModalOpen(false);
          setCurrentView('CHAT');
          return;
        }
      }

      // 2. Or invite via email if they want to invite someone new
      if (dmEmail.trim()) {
        const recipientName = dmName.trim() || 'Colleague';
        await sendChatRequest(dmEmail.trim(), recipientName);
        setDmSuccessMessage(`Successfully invited ${recipientName}! An invitation was sent to their inbox/email.`);
        setDmEmail('');
        setDmName('');
        // Sync context
        setTimeout(() => {
          setDmSuccessMessage('');
          setIsChatModalOpen(false);
        }, 3000);
      } else {
        setDmErrorMessage('Please choose an existing colleague or enter an email address to invite.');
      }
    } catch (err: any) {
      setDmErrorMessage(err.message || 'Failed to start direct message session');
    }
  };

  // Counting unread notifications/items
  const unreadCount = inbox.filter(n => !n.isRead).length;

  return (
    <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      
      {/* Upper Logo Brand */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between animate-fade-in font-sans">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            W
          </div>
          <div>
            <span className="font-bold text-white tracking-tight">wavework.ai</span>
            <span className="text-[10px] block font-mono text-indigo-400">workspace</span>
          </div>
        </div>
        <button 
          onClick={() => setIsInviteModalOpen(true)}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2 rounded-md transition flex items-center gap-1 cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          Invite
        </button>
      </div>

      {/* Workspace Switcher Dropdown */}
      <div className="px-4 py-2 border-b border-slate-800 relative font-sans">
        <button
          onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800/50 border border-slate-800 text-left transition cursor-pointer text-xs font-bold text-slate-200"
        >
          <div className="flex items-center gap-2 truncate">
            <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">
              {userWorkspaces.find(w => w.id === activeUser?.activeWorkspaceId)?.name || activeUser?.activeWorkspaceId || 'Select Workspace'}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0 ml-1" />
        </button>

        {showWorkspaceDropdown && (
          <div className="absolute left-4 right-4 top-full mt-1 z-50 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl p-1.5 space-y-1">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1">Switch Workspace</div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {userWorkspaces.map(w => {
                const isActive = w.id === activeUser?.activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleSwitchWorkspace(w.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition cursor-pointer ${
                      isActive ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${isActive ? 'bg-indigo-700 text-indigo-200' : 'bg-slate-900 text-slate-500'}`}>
                      {w.role}
                    </span>
                  </button>
                );
              })}
            </div>
            {isSuperAdmin && (
              <div className="pt-1.5 border-t border-slate-900">
                <button
                  onClick={() => {
                    setShowWorkspaceDropdown(false);
                    setIsNewWorkspaceModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Workspace
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Navigation Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-7">
        
        {/* Assign Tasks (Admins/Super Admins only) */}
        {isAdmin && (
          <div className="px-1.5 pb-2">
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Plus className="w-4 h-4 transition group-hover:rotate-90" />
              <span>Assign Task</span>
            </button>
          </div>
        )}

        {/* Unified Alerts */}
        <div>
          <button
            onClick={() => { setCurrentView('UNIFIED_ALERTS'); onClose?.(); }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm font-medium transition cursor-pointer ${
              currentView === 'UNIFIED_ALERTS' 
                ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Inbox className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Unified Alerts</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Track Progress (Collapsible, Admins/Super Admins only) */}
        {isAdmin && (
          <div>
            <button
              onClick={() => toggleSection('progress')}
              className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
            >
              <span>📈 Track Progress</span>
              {expandedSections.progress ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {expandedSections.progress && (
              <div className="pl-3 mt-1 space-y-0.5">
                <button
                  onClick={() => { setCurrentView('TRACK_PROGRESS_METRICS'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'TRACK_PROGRESS_METRICS' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Metrics & Trends</span>
                </button>
                <button
                  onClick={() => { setCurrentView('TRACK_PROGRESS_BOARD'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'TRACK_PROGRESS_BOARD' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Kanban className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Status Board</span>
                </button>
                <button
                  onClick={() => { setCurrentView('TRACK_PROGRESS_PLANNER'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'TRACK_PROGRESS_PLANNER' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Timeline Planner</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Tasks (Collapsible) */}
        <div>
          <button
            onClick={() => toggleSection('myTasks')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
          >
            <span>📂 My Tasks</span>
            {expandedSections.myTasks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {expandedSections.myTasks && (
            <div className="pl-3 mt-1 space-y-0.5">
              <button
                onClick={() => { setCurrentView('MY_TASKS_DASHBOARD'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'MY_TASKS_DASHBOARD' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Dashboard View</span>
              </button>
              <button
                onClick={() => { setCurrentView('MY_TASKS_LIST'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'MY_TASKS_LIST' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>List View</span>
              </button>
              <button
                onClick={() => { setCurrentView('MY_TASKS_CALENDAR'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'MY_TASKS_CALENDAR' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Calendar View</span>
              </button>
            </div>
          )}
        </div>

        {/* My Personal Space (Collapsible) */}
        <div>
          <button
            onClick={() => toggleSection('personalSpace')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
          >
            <span>🔒 My Personal Space</span>
            {expandedSections.personalSpace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {expandedSections.personalSpace && (
            <div className="pl-3 mt-1 space-y-0.5">
              <button
                onClick={() => { setCurrentView('PERSONAL_SPACE_DASHBOARD'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'PERSONAL_SPACE_DASHBOARD' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderHeart className="w-4 h-4 text-pink-400 shrink-0" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => { setCurrentView('PERSONAL_SPACE_LIST'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'PERSONAL_SPACE_LIST' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-pink-400 shrink-0" />
                <span>List View</span>
              </button>
              <button
                onClick={() => { setCurrentView('PERSONAL_SPACE_SCRATCHPAD'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'PERSONAL_SPACE_SCRATCHPAD' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <StickyNote className="w-4 h-4 text-pink-400 shrink-0" />
                <span>Scratchpad</span>
              </button>
              <button
                onClick={() => { setCurrentView('PERSONAL_SPACE_WHITEBOARD'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'PERSONAL_SPACE_WHITEBOARD' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <PenTool className="w-4 h-4 text-pink-400 shrink-0" />
                <span>Whiteboard</span>
              </button>
            </div>
          )}
        </div>

        {/* My File Hub */}
        <div>
          <button
            onClick={() => { setCurrentView('FILE_HUB'); onClose?.(); }}
            className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition cursor-pointer ${
              currentView === 'FILE_HUB' 
                ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>My File Hub</span>
          </button>
        </div>

        {/* Spaces & Directories (Collapsible) */}
        <div>
          <button
            onClick={() => toggleSection('spaces')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
          >
            <span>🗂️ Spaces & Directories</span>
            {expandedSections.spaces ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {expandedSections.spaces && (
            <div className="pl-3 mt-1 space-y-2">
              <button
                onClick={() => { setCurrentView('DIRECTORY_TEAMMATES'); onClose?.(); }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === 'DIRECTORY_TEAMMATES' 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Teammates</span>
              </button>

              {!isEmployee && (
                <button
                  onClick={() => { setCurrentView('DIRECTORY_PORTALS'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'DIRECTORY_PORTALS' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardList className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Inbound Portals</span>
                </button>
              )}

              <div>
                <div className="flex items-center justify-between px-2.5 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Spaces</span>
                  {!isEmployee && (
                    <button 
                      onClick={() => setIsSpaceModalOpen(true)}
                      className="text-slate-400 hover:text-white transition cursor-pointer p-0.5 hover:bg-slate-800 rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1 mt-1">
                  {spaces.map(space => {
                    const isExpanded = !!expandedSpaces[space.id];
                    const isSelected = selectedSpace?.id === space.id;
                    const spaceLists = lists.filter(l => l.spaceId === space.id);

                    return (
                      <div key={space.id} className="space-y-0.5">
                        <div
                          onClick={() => setSelectedSpace(space)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition cursor-pointer ${
                            isSelected && currentView === 'SPACE_BOARD'
                              ? 'bg-slate-800 text-white font-semibold' 
                              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <button 
                              onClick={(e) => toggleSpaceExpand(space.id, e)} 
                              className="text-slate-500 hover:text-slate-200 p-0.5 cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: space.color }}
                            />
                            <span className="truncate">{space.name}</span>
                          </div>

                          {!isEmployee && (
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManageMembersSpace(space);
                                  setManageSpaceMembers(space.memberIds || []);
                                  setIsManageMembersModalOpen(true);
                                }}
                                className="text-slate-500 hover:text-indigo-400 p-0.5 cursor-pointer"
                                title="Manage Members"
                              >
                                <UserCheck className="w-3 h-3" />
                              </button>
                              
                              {confirmDeleteSpaceId === space.id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSpace(space.id);
                                    setConfirmDeleteSpaceId(null);
                                  }}
                                  className="text-[9px] text-rose-400 bg-rose-500/20 px-1 py-0.5 rounded cursor-pointer font-bold animate-pulse shrink-0"
                                >
                                  Sure?
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteSpaceId(space.id);
                                    setTimeout(() => setConfirmDeleteSpaceId(null), 4000);
                                  }}
                                  className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="pl-5 pr-1 space-y-0.5">
                            {spaceLists.map(list => {
                              const isListSelected = selectedList?.id === list.id;
                              return (
                                <div 
                                  key={list.id} 
                                  className={`group flex items-center justify-between px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                                    isListSelected && currentView === 'SPACE_BOARD'
                                      ? 'text-white bg-indigo-500/20 font-semibold' 
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                  }`}
                                >
                                  <button
                                    onClick={() => {
                                      setSelectedSpace(space);
                                      setSelectedList(list);
                                      setCurrentView('SPACE_BOARD');
                                      onClose?.();
                                    }}
                                    className="flex items-center space-x-2 truncate flex-1 text-left"
                                  >
                                    <FolderIcon className="w-3 h-3 text-slate-500" />
                                    <span className="truncate">{list.name}</span>
                                  </button>

                                  {!isEmployee && (
                                    confirmDeleteListId === list.id ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteList(list.id);
                                          setConfirmDeleteListId(null);
                                        }}
                                        className="text-[9px] text-rose-400 bg-rose-500/20 px-1 py-0.5 rounded cursor-pointer font-bold animate-pulse shrink-0"
                                      >
                                        Sure?
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteListId(list.id);
                                          setTimeout(() => setConfirmDeleteListId(null), 4000);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 cursor-pointer transition shrink-0"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )
                                  )}
                                </div>
                              );
                            })}
                            
                            {!isEmployee && (
                              <button
                                onClick={() => {
                                  setSelectedSpace(space);
                                  setIsListModalOpen(true);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1 rounded text-[11px] text-left text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 transition cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add List</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Channels & Groups (Collapsible) */}
        <div>
          <button
            onClick={() => toggleSection('channels')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
          >
            <span>💬 Channels & Groups</span>
            {expandedSections.channels ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          
          {expandedSections.channels && (
            <div className="pl-3 mt-1.5 space-y-0.5 max-h-40 overflow-y-auto pr-1">
              {channels
                .filter(ch => ch && !ch.isDM)
                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime())
                .map(channel => {
                  const isSelected = selectedChannel?.id === channel.id;
                  
                  let unread = 0;
                  if (activeUser && channel.unreadCount) {
                    let counts = channel.unreadCount;
                    if (typeof counts === 'string') {
                      try { counts = JSON.parse(counts); } catch (_) { counts = {}; }
                    }
                    unread = (counts as any)[activeUser.id] || 0;
                  }

                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setCurrentView('CHAT');
                        onClose?.();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left truncate transition cursor-pointer ${
                        isSelected && currentView === 'CHAT'
                          ? 'bg-slate-800 text-white font-semibold' 
                          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate min-w-0">
                        {channel.logoUrl ? (
                          <img 
                            referrerPolicy="no-referrer"
                            src={channel.logoUrl} 
                            alt="" 
                            className="w-4 h-4 rounded object-cover shrink-0" 
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </div>

                      {unread > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ml-1.5">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              
              {channels.filter(ch => ch && !ch.isDM).length === 0 && (
                <p className="text-[10px] text-slate-600 px-2.5 py-1 font-semibold italic">No group channels found</p>
              )}
            </div>
          )}
        </div>

        {/* Direct Messages (Collapsible) */}
        <div>
          <button
            onClick={() => toggleSection('dms')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
          >
            <span>👤 Direct Messages</span>
            {expandedSections.dms ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          
          {expandedSections.dms && (
            <div className="pl-3 mt-1.5 space-y-0.5 max-h-40 overflow-y-auto pr-1">
              {channels
                .filter(ch => ch && ch.isDM)
                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime())
                .map(channel => {
                  const isSelected = selectedChannel?.id === channel.id;
                  
                  let dmDisplayName = channel.name;
                  if (activeUser && Array.isArray(channel.memberIds)) {
                    const otherMemberId = channel.memberIds.find((id: string) => id !== activeUser.id);
                    if (otherMemberId) {
                      const otherUserProfile = users.find(u => u.id === otherMemberId);
                      if (otherUserProfile) {
                        dmDisplayName = otherUserProfile.name;
                      } else {
                        dmDisplayName = channel.name.replace("DM with ", "");
                      }
                    }
                  } else {
                    dmDisplayName = channel.name.replace("DM with ", "");
                  }

                  let unread = 0;
                  if (activeUser && channel.unreadCount) {
                    let counts = channel.unreadCount;
                    if (typeof counts === 'string') {
                      try { counts = JSON.parse(counts); } catch (_) { counts = {}; }
                    }
                    unread = (counts as any)[activeUser.id] || 0;
                  }

                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setCurrentView('CHAT');
                        onClose?.();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left truncate transition cursor-pointer ${
                        isSelected && currentView === 'CHAT'
                          ? 'bg-slate-800 text-white font-semibold' 
                          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="truncate">{dmDisplayName}</span>
                      </div>

                      {unread > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ml-1.5">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}

              {channels.filter(ch => ch && ch.isDM).length === 0 && (
                <p className="text-[10px] text-slate-600 px-2.5 py-1 font-semibold italic">No direct chats. Click + to invite!</p>
              )}
            </div>
          )}
        </div>

        {/* Workspace Settings (Collapsible, Admins/Super Admins only) */}
        {isAdmin && (
          <div>
            <button
              onClick={() => toggleSection('settings')}
              className="w-full flex items-center justify-between px-2 py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest text-left select-none"
            >
              <span>⚙️ Workspace Settings</span>
              {expandedSections.settings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {expandedSections.settings && (
              <div className="pl-3 mt-1 space-y-0.5">
                {isSuperAdmin && (
                  <button
                    onClick={() => { setCurrentView('WORKSPACE_SETTINGS_INFO'); onClose?.(); }}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                      currentView === 'WORKSPACE_SETTINGS_INFO' 
                        ? 'bg-slate-800 text-white font-semibold' 
                        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>General Info</span>
                  </button>
                )}
                <button
                  onClick={() => { setCurrentView('WORKSPACE_SETTINGS_INVITES'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'WORKSPACE_SETTINGS_INVITES' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Invitations</span>
                </button>
                <button
                  onClick={() => { setCurrentView('WORKSPACE_SETTINGS_LOGS'); onClose?.(); }}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    currentView === 'WORKSPACE_SETTINGS_LOGS' 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Activity Logs</span>
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => { setCurrentView('WORKSPACE_SETTINGS_ROLES'); onClose?.(); }}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                      currentView === 'WORKSPACE_SETTINGS_ROLES' 
                        ? 'bg-slate-800 text-white font-semibold' 
                        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Role Management</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer Switcher Context Panel with secure Log Out action */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">simulate identity</span>
          <button
            onClick={() => {
              sessionStorage.removeItem('isLoggedIn');
              sessionStorage.removeItem('activeUserId');
              localStorage.removeItem('isLoggedIn');
              localStorage.removeItem('activeUserId');
              window.location.reload();
            }}
            title="Sign out of current account"
            className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Exit Session
          </button>
        </div>
        
        <div className="relative">
          <select
            value={activeUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-white cursor-pointer"
          >
            {users.map(u => (
              <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                {u.name}{u.id === activeUser?.id ? ' (You)' : ''} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {activeUser && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-900 mt-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full ${activeUser.color} flex items-center justify-center font-bold text-xs shadow-inner shrink-0`}>
                {activeUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate min-w-0">
                <span className="text-white text-xs block font-medium truncate">{activeUser.name} (You)</span>
                <span className="text-[10px] text-slate-400 block truncate font-mono uppercase">
                  {activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'OWNER' ? '👑 Super Admin' : 
                   activeUser.role === 'ADMIN' ? '👑 Admin' : '⭐ Employee'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- SUB-DIALOG MODALS CODES --- */}

      {/* 1. Modal Space Creation */}
      {isSpaceModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsSpaceModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="text-indigo-600" />
              Create Core Space
            </h3>
            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Space Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Marketing, Core PM"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Visual Marker Color</label>
                <input
                  type="color"
                  value={newSpaceColor}
                  onChange={(e) => setNewSpaceColor(e.target.value)}
                  className="w-full h-10 border border-slate-300 rounded p-1 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Space Members (Teammates)</label>
                <div className="border border-slate-300 rounded p-2 max-h-32 overflow-y-auto space-y-2">
                  {users.map((u) => {
                    const isChecked = newSpaceMembers.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewSpaceMembers(prev => prev.filter(id => id !== u.id));
                            } else {
                              setNewSpaceMembers(prev => [...prev, u.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                        />
                        <span>{u.name} ({u.role})</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Selected employees will have access to view this space.</p>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded transition cursor-pointer"
              >
                Create Space
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Modal List Creation */}
      {isListModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsListModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FolderIcon className="text-indigo-600" />
              Add Target List to {selectedSpace?.name}
            </h3>
            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">List Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint Backlog, Q4 Goals"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded transition cursor-pointer"
              >
                Create List
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2.5 Modal Space Members Management */}
      {isManageMembersModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsManageMembersModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <UserCheck className="text-indigo-600" />
              Manage Access: {manageMembersSpace?.name}
            </h3>
            <form onSubmit={handleUpdateSpaceMembers} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Space Members (Teammates)</label>
                <div className="border border-slate-300 rounded p-2 max-h-48 overflow-y-auto space-y-2">
                  {users.map((u) => {
                    const isChecked = manageSpaceMembers.includes(u.id);
                    // Prevent unchecking yourself if you are an Admin (fallback safety)
                    const isSelfAdmin = u.id === activeUser?.id && (activeUser?.role === 'ADMIN' || activeUser?.role === 'SUPER_ADMIN');
                    
                    return (
                      <label key={u.id} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked || isSelfAdmin}
                          disabled={isSelfAdmin}
                          onChange={() => {
                            if (isSelfAdmin) return;
                            if (isChecked) {
                              setManageSpaceMembers(prev => prev.filter(id => id !== u.id));
                            } else {
                              setManageSpaceMembers(prev => [...prev, u.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4 disabled:opacity-50"
                        />
                        <span className={isSelfAdmin ? 'text-slate-400' : ''}>{u.name} ({u.role}) {isSelfAdmin && '(You)'}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Checked employees can view this space and its tasks.</p>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded transition cursor-pointer"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Modal Direct Invite Generation */}
      {isInviteModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsInviteModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <UserCheck className="text-indigo-600" />
              Invite Guest Collaborator
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Creates a direct user simulation profile and pre-joins them into channels!
            </p>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Smith"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alice@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-slate-900"
                />
              </div>
              
              {inviteMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded border border-emerald-100">
                  {inviteMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded transition cursor-pointer"
              >
                Generate Link & Register
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Custom Tabbed Communications Modal */}
      {isChatModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white rounded-xl border border-slate-100 p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <button 
              onClick={() => setIsChatModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                {chatModalType === 'CHANNEL' ? 'Create Channel / Group' : 'Direct Message Conversation'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">ESTABLISH SECURE COMMUNICATION CHANNELS</p>
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-slate-100 pb-1">
              <button
                type="button"
                onClick={() => setChatModalType('CHANNEL')}
                className={`flex-1 py-1.5 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                  chatModalType === 'CHANNEL' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-650'
                }`}
              >
                💬 Channel / Group
              </button>
              <button
                type="button"
                onClick={() => setChatModalType('DM')}
                className={`flex-1 py-1.5 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                  chatModalType === 'DM' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-650'
                }`}
              >
                👤 Direct Message
              </button>
            </div>

            {/* TAB CONTENT - CHANNEL */}
            {chatModalType === 'CHANNEL' && (
              <form onSubmit={handleCreateChannelSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Group / Channel Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. design-assets"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-505 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description / Purpose</label>
                  <textarea
                    placeholder="Provide description..."
                    rows={2}
                    value={newChannelDesc}
                    onChange={(e) => setNewChannelDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Group Logo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={newChannelLogo}
                    onChange={(e) => setNewChannelLogo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChatModalOpen(false)}
                    className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    Create Channel
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT - DIRECT MESSAGE */}
            {chatModalType === 'DM' && (
              <form onSubmit={handleCreateDmSubmit} className="space-y-4 font-sans">
                {dmSuccessMessage && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded border border-emerald-100">
                    {dmSuccessMessage}
                  </div>
                )}
                {dmErrorMessage && (
                  <div className="p-2.5 bg-rose-50 text-rose-800 text-xs font-semibold rounded border border-rose-100">
                    ✕ {dmErrorMessage}
                  </div>
                )}

                {/* Select existing registered user */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Teammate to DM</label>
                  <select
                    value={dmSelectedUserId}
                    onChange={(e) => {
                      setDmSelectedUserId(e.target.value);
                      if (e.target.value) {
                        setDmEmail('');
                        setDmName('');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="">-- Choose Existing User --</option>
                    {users.filter(u => u.id !== activeUser?.id).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-250"></div>
                  <span className="flex-shrink mx-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR INVITE NEW</span>
                  <div className="flex-grow border-t border-slate-250"></div>
                </div>

                {/* Invite guest colleague */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colleague's Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. David PM"
                      value={dmName}
                      onChange={(e) => {
                        setDmName(e.target.value);
                        if (e.target.value) setDmSelectedUserId('');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colleague's Email Address</label>
                    <input
                      type="email"
                      placeholder="david@example.com"
                      value={dmEmail}
                      onChange={(e) => {
                        setDmEmail(e.target.value);
                        if (e.target.value) setDmSelectedUserId('');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChatModalOpen(false)}
                    className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {dmSelectedUserId ? 'Open Conversation' : 'Send Invite request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Admin Assign Task Modal */}
      {isAssignModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/70 p-4 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-full max-w-lg rounded-2xl border border-slate-750 bg-slate-900 text-white shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
                <ClipboardList className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white leading-none">Assign Staff Task</h3>
                <p className="text-xs text-slate-400 mt-1">Create, set description, upload files, and designate to team members</p>
              </div>
            </div>

            <form onSubmit={handleAssignTask} className="space-y-4">
              {/* Task Title */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design review for mobile applet"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detailed Description</label>
                <textarea
                  placeholder="Explain requirements, deliverables, and targets..."
                  rows={3}
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Employee Assignee Multi-select Checkboxes */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee Teammate(s) *</label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 max-h-32 overflow-y-auto space-y-2">
                    {users.map((u) => {
                      const isChecked = assignUserIds.includes(u.id);
                      return (
                        <label key={u.id} className="flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setAssignUserIds(prev => prev.filter(id => id !== u.id));
                              } else {
                                setAssignUserIds(prev => [...prev, u.id]);
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-955 text-indigo-650 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                          />
                          <span>{u.name} ({u.role})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Target Space */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Space Destination</label>
                    <select
                      value={assignSpaceId}
                      onChange={(e) => {
                        setAssignSpaceId(e.target.value);
                        setAssignListId(''); // Reset list selection when space changes
                      }}
                      className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="" className="bg-slate-900 text-slate-500">All Spaces / Unassigned</option>
                      {spaces.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target List */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Board List Destination</label>
                    <select
                      value={assignListId}
                      onChange={(e) => setAssignListId(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!assignSpaceId}
                    >
                      <option value="" className="bg-slate-900 text-slate-500">
                        {!assignSpaceId ? "Select a Space first..." : "Select a list..."}
                      </option>
                      {assignSpaceId && lists.filter((l) => l.spaceId === assignSpaceId).map((l) => (
                        <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Priority */}
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority Label</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => {
                      const colors = {
                        LOW: 'border-slate-850 hover:bg-slate-800/40 text-slate-400',
                        NORMAL: 'border-indigo-850 hover:bg-indigo-900/10 text-indigo-400',
                        HIGH: 'border-amber-850 hover:bg-amber-900/10 text-amber-400',
                        URGENT: 'border-rose-850 hover:bg-rose-900/10 text-rose-400',
                      };
                      const activeColors = {
                        LOW: 'bg-slate-800 text-white border-slate-500',
                        NORMAL: 'bg-indigo-950 border-indigo-500 text-indigo-350',
                        HIGH: 'bg-amber-955 border-amber-500 text-amber-350',
                        URGENT: 'bg-rose-955 border-rose-500 text-rose-350',
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAssignPriority(p)}
                          className={`border p-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer ${
                            assignPriority === p ? activeColors[p] : colors[p]
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deadline */}
                <div className="space-y-1 col-span-2 mt-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deadline / Due Date (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-slate-955 border border-slate-800 rounded-lg pl-10 p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Upload file attachments block */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attach Required Docs (DOCX, PDF, XLS, ZIP...)</label>
                
                {/* Uploaded items lists */}
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {assignAttachments.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-slate-955 rounded border border-slate-850 text-[11px] font-semibold text-slate-300">
                      <span className="truncate pr-2">📂 {f.name} ({(f.size/1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setAssignAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-450 hover:text-rose-400 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="assign-task-uploader"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const base64Data = event.target?.result as string;
                        if (!base64Data) return;

                        try {
                          setIsUploading(true);
                          const res = await api.uploadFileAttachment(file.name, file.type, base64Data);
                          setAssignAttachments((prev) => [
                            ...prev, 
                            { name: res.name || file.name, url: res.url, type: res.type || file.type, size: res.size || file.size }
                          ]);
                        } catch (err: any) {
                          alert("Upload failed: " + err.message);
                        } finally {
                          setIsUploading(false);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="assign-task-uploader"
                    className="w-full border border-dashed border-slate-800 hover:border-indigo-550 rounded-xl bg-slate-955 hover:bg-slate-950/60 transition text-xs text-slate-400 font-medium py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isUploading ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Upload reference attachment file</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Assign and Dispatch Task
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Create Workspace Modal */}
      {isNewWorkspaceModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/70 p-4 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-full max-w-md rounded-2xl border border-slate-750 bg-slate-900 text-white shadow-2xl p-6 relative">
            <button
              onClick={() => setIsNewWorkspaceModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
                <Building className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white leading-none">Create Workspace</h3>
                <p className="text-xs text-slate-400 mt-1">Initialize a new isolated environment for your project</p>
              </div>
            </div>

            <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-4">
              {/* Workspace Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workspace Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Project"
                  value={newWorkspaceNameInput}
                  onChange={(e) => setNewWorkspaceNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Describe the scope or team of this workspace..."
                  rows={3}
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium resize-none"
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logo Image URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://example.com/logo.png"
                  value={newWorkspaceLogo}
                  onChange={(e) => setNewWorkspaceLogo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Create and Launch
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
