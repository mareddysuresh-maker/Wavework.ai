import React, { useState, useEffect } from 'react';
import { useFlow } from '../lib/FlowContext';
import { Task } from '../types';
import { api } from '../lib/api';
import { 
  Plus, 
  Search, 
  Calendar, 
  Tag, 
  Flag, 
  CheckSquare, 
  User, 
  X, 
  Trash2, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MessageSquare,
  Clock,
  MoreVertical,
  Layers,
  Folder as FolderIcon,
  CalendarDays,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const STATUS_COLUMNS = [
  { id: 'TODO', name: 'To Do', bg: 'bg-slate-100 border-t-slate-400', txt: 'text-slate-800' },
  { id: 'IN_PROGRESS', name: 'In Progress', bg: 'bg-indigo-50/40 border-t-indigo-500', txt: 'text-indigo-800' },
  { id: 'IN_REVIEW', name: 'In Review', bg: 'bg-amber-50/40 border-t-amber-500', txt: 'text-amber-800' },
  { id: 'DONE', name: 'Done', bg: 'bg-emerald-50/40 border-t-emerald-500', txt: 'text-emerald-800' }
];

// Helper to guarantee rich high-contrast user visual styles across all dynamic Tailwind color outputs
const getUserColorStyles = (colorClass: string | undefined | null) => {
  if (!colorClass) return { backgroundColor: '#4f46e5', color: '#ffffff' };
  const lower = colorClass.toLowerCase();
  
  const colorMap: Record<string, string> = {
    'indigo': '#4f46e5',
    'purple': '#8b5cf6',
    'emerald': '#10b981',
    'sky': '#0ea5e9',
    'amber': '#f59e0b',
    'pink': '#ec4899',
    'rose': '#f43f5e',
    'slate': '#475569',
    'zinc': '#52525b',
    'neutral': '#737373',
    'stone': '#78716c',
    'red': '#ef4444',
    'orange': '#f97316',
    'yellow': '#eab308',
    'lime': '#84cc16',
    'green': '#22c55e',
    'teal': '#14b8a6',
    'cyan': '#06b6d4',
    'violet': '#8b5cf6',
    'fuchsia': '#d946ef',
  };

  const found = Object.keys(colorMap).find(key => lower.includes(key));
  if (found) {
    return { backgroundColor: colorMap[found], color: '#ffffff' };
  }
  return { backgroundColor: '#4f46e5', color: '#ffffff' };
};

interface TaskBoardViewProps {
  forceAssigneeFilter?: boolean;
  defaultSubTab?: 'DASHBOARD' | 'LIST' | 'BOARD' | 'CALENDAR';
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  forceAssigneeFilter = false,
  defaultSubTab = 'DASHBOARD'
}) => {
  const { 
    selectedSpace, 
    selectedList, 
    setSelectedList,
    tasks, 
    users, 
    createTask, 
    updateTask, 
    deleteTask,
    addTaskComment,
    createList,
    lists,
    triggerSync,
    activeUser
  } = useFlow();

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  
  // Tab control: DASHBOARD, LIST, BOARD, CALENDAR (matching the 3 screenshots)
  const [subTab, setSubTab] = useState<'DASHBOARD' | 'LIST' | 'BOARD' | 'CALENDAR'>(defaultSubTab);

  useEffect(() => {
    setSubTab(defaultSubTab);
  }, [defaultSubTab]);

  const isAdmin = activeUser?.role === 'ADMIN' || activeUser?.role === 'OWNER' || activeUser?.role === 'SUPER_ADMIN';
  const isEmployee = !isAdmin;

  const getProgressForStatus = (status: string) => {
    if (status === 'TODO') return 25;
    if (status === 'IN_PROGRESS') return 50;
    if (status === 'IN_REVIEW') return 75;
    if (status === 'DONE') return 100;
    return 25;
  };

  // Calendar Date active tracking
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Drag-and-drop visual states for Kanban board
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [activeOverColId, setActiveOverColId] = useState<string | null>(null);
  
  // Inline task creators list ID hook
  const [activeCreatorCol, setActiveCreatorCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NONE'>('NONE');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  // Selected task detail inspector modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isConfirmingDeleteTask, setIsConfirmingDeleteTask] = useState(false);
  const [confirmingListId, setConfirmingListId] = useState<string | null>(null);
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [taskComments, setTaskComments] = useState<any[]>([]);

  // Checklist Item Creater States
  const [newCheckItem, setNewCheckItem] = useState('');

  // Filter tasks to only match selected space and list
  const activeSpaceListsIds = selectedSpace ? lists.filter(l => l.spaceId === selectedSpace.id).map(l => l.id) : [];
  const currentListTasks = tasks.filter(task => {
    if (forceAssigneeFilter) {
      return task.assigneeId === activeUser?.id;
    }
    if (selectedList) {
      return task.listId === selectedList.id;
    } else {
      return activeSpaceListsIds.includes(task.listId);
    }
  });

  const filteredTasks = currentListTasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(search.toLowerCase()) || 
                          task.description.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const handleCreateTask = async (status: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedSpace) return;

    let targetListId = selectedList?.id;

    if (!targetListId) {
      const spaceLists = lists.filter(l => l.spaceId === selectedSpace.id);
      if (spaceLists.length > 0) {
        targetListId = spaceLists[0].id;
      } else {
        try {
          const newList = await api.createList({ spaceId: selectedSpace.id, name: 'General Checklist' });
          targetListId = newList.id;
          await triggerSync();
        } catch (err: any) {
          console.error("Failed to automatically generate list:", err);
          alert(err.message || "Could not automatically create backing list.");
          return;
        }
      }
    }

    if (!targetListId) return;

    await createTask({
      listId: targetListId,
      name: newTaskTitle,
      description: newTaskDescription.trim() || 'No description specified.',
      status: status as any,
      priority: newTaskPriority,
      assigneeId: newTaskAssignee || undefined
    });

    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('NONE');
    setNewTaskAssignee('');
    setActiveCreatorCol(null);
  };

  const handleQuickAddTask = async (listId: string, status: string, title: string) => {
    if (!title.trim() || !selectedSpace) return;
    await createTask({
      listId,
      name: title.trim(),
      description: 'Quickly generated task.',
      status: status as any,
      priority: 'NONE',
    });
  };

  const handleOpenInspector = async (task: Task) => {
    setSelectedTask(task);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        headers: { 'X-Active-User-Id': sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId') || 'u-1' }
      });
      if (response.ok) {
        const comments = await response.json();
        setTaskComments(comments);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedTask) return;

    try {
      const commentObj = await addTaskComment(selectedTask.id, newCommentText);
      setTaskComments(prev => [...prev, commentObj]);
      setNewCommentText('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.trim() || !selectedTask) return;

    const checklist = selectedTask.checklist || [];
    const item = {
      id: `c-${Date.now()}`,
      label: newCheckItem,
      isChecked: false
    };

    const updatedChecklist = [...checklist, item];
    await updateTask(selectedTask.id, { checklist: updatedChecklist });
    
    // Sync current modal state
    setSelectedTask(prev => prev ? { ...prev, checklist: updatedChecklist } : null);
    setNewCheckItem('');
  };

  const handleToggleChecklist = async (itemId: string, isChecked: boolean) => {
    if (!selectedTask) return;
    const checklist = selectedTask.checklist || [];
    const updated = checklist.map(item => item.id === itemId ? { ...item, isChecked } : item);
    
    await updateTask(selectedTask.id, { checklist: updated });
    setSelectedTask(prev => prev ? { ...prev, checklist: updated } : null);
  };

  // Move status wrapper
  const handleMoveStatus = async (task: Task, status: string) => {
    if (task.assigneeId !== activeUser?.id) {
      alert("Only the assigned employee can change the task status.");
      return;
    }
    await updateTask(task.id, { status: status as any });
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'URGENT': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NORMAL': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'LOW': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  if (!selectedSpace && !forceAssigneeFilter) {
    return (
      <div id="blank-space-view" className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8">
        <div className="max-w-md text-center">
          <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Select physical space directory</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5 mb-6">
            Choose an Engineering, Design, or Custom space inside the sidebar drawer directory to inspect status lists, tickets, and priorities boards.
          </p>
        </div>
      </div>
    );
  }

  // Gather current lists inside selected space
  const spaceLists = selectedSpace ? lists.filter(l => l.spaceId === selectedSpace.id) : [];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full font-sans overflow-hidden">
      
      {/* Top Banner Toolbar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {forceAssigneeFilter ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-650" />
                <h2 className="text-xl font-bold text-slate-900">My Tasks</h2>
              </>
            ) : selectedSpace ? (
              <>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSpace.color }} />
                <h2 className="text-xl font-bold text-slate-900">{selectedSpace.name} Space</h2>
                <ChevronRight className="w-4 h-4 text-slate-400" />

                {/* List selector & manual custom list addition helper */}
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs hover:border-slate-300 transition">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">List:</span>
                  <select
                    value={selectedList ? selectedList.id : 'ALL'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'ALL') {
                        setSelectedList(null);
                      } else {
                        const found = spaceLists.find(l => l.id === val);
                        if (found) setSelectedList(found);
                      }
                    }}
                    className="bg-transparent border-none text-xs font-bold text-indigo-600 focus:outline-none focus:ring-0 cursor-pointer py-0 px-1"
                  >
                    <option value="ALL">All Lists</option>
                    {spaceLists.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>

                  {!isEmployee && (
                    <button
                      onClick={async () => {
                        const listName = prompt("Enter new task group list name:", "Tasks");
                        if (listName && listName.trim()) {
                          await createList(selectedSpace.id, undefined, listName.trim());
                        }
                      }}
                      className="p-1 hover:bg-slate-200/50 rounded text-slate-500 hover:text-indigo-600 transition cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold border-l border-slate-200 pl-2"
                      title="Create a new custom board list inside this space"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add List</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <p className="text-[11px] font-medium font-mono text-indigo-500 mt-1 uppercase">wavework task boards & checklist views</p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-3">
          {/* Seek Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task board..."
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-44 md:w-56"
            />
          </div>

          {/* Priority filter selector */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">🔴 Urgent</option>
            <option value="HIGH">🟡 High</option>
            <option value="NORMAL">🔵 Normal</option>
            <option value="LOW">⚪ Low</option>
            <option value="NONE">Clear</option>
          </select>
        </div>
      </div>

      {/* ClickUp-Style Views Navigation Sub-Tabs bar (The core enhancement for Spaces) */}
      <div className="bg-white border-b border-slate-200 px-8 py-2.5 flex items-center justify-between flex-shrink-0 shadow-xxs">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setSubTab('DASHBOARD')}
            className={`flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              subTab === 'DASHBOARD' 
                ? 'bg-indigo-50 text-indigo-700 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📊</span>
            <span>Dashboard View</span>
          </button>

          <button
            onClick={() => setSubTab('LIST')}
            className={`flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              subTab === 'LIST' 
                ? 'bg-indigo-50 text-indigo-700 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📝</span>
            <span>List View</span>
          </button>
          
          <button
            onClick={() => setSubTab('BOARD')}
            className={`flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              subTab === 'BOARD' 
                ? 'bg-indigo-50 text-indigo-700 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📋</span>
            <span>Board View</span>
          </button>

          <button
            onClick={() => setSubTab('CALENDAR')}
            className={`flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              subTab === 'CALENDAR' 
                ? 'bg-indigo-50 text-indigo-700 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📅</span>
            <span>Calendar View</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-pulse" />
          <span>Sync Core Active</span>
        </div>
      </div>

      {/* Primary Work View Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        
        {/* VIEW 0: Spaces Dashboard View */}
        {subTab === 'DASHBOARD' && (() => {
          // Calculate status counts for filteredTasks
          const totalCount = filteredTasks.length;
          const todoCount = filteredTasks.filter(t => t.status === 'TODO').length;
          const inProgressCount = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
          const inReviewCount = filteredTasks.filter(t => t.status === 'IN_REVIEW').length;
          const doneCount = filteredTasks.filter(t => t.status === 'DONE').length;

          let totalProgressSum = 0;
          filteredTasks.forEach(t => {
            if (t.status === 'TODO') totalProgressSum += 25;
            else if (t.status === 'IN_PROGRESS') totalProgressSum += 50;
            else if (t.status === 'IN_REVIEW') totalProgressSum += 75;
            else if (t.status === 'DONE') totalProgressSum += 100;
          });
          const avgProgress = totalCount > 0 ? Math.round(totalProgressSum / totalCount) : 0;

          // Upcoming deadlines (within next 7 days or any date sorted)
          const upcomingDeadlines = filteredTasks
            .filter(t => t.dueDate && t.status !== 'DONE')
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 5);

          if (isEmployee) {
            // Employee mode
            return (
              <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
                {/* Upper banner */}
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Your Productivity Insights</h3>
                    <p className="text-xs text-indigo-200 mt-1">Personal statistics and active task progress metrics for {selectedSpace?.name || 'Workspace'} Space</p>
                  </div>
                  <div className="bg-indigo-800/50 border border-indigo-750 px-4 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 block uppercase font-mono tracking-wider font-bold">overall progress</span>
                    <span className="text-2xl font-black text-white">{avgProgress}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Assigned Tasks card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Assigned Tasks</span>
                      <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
                    </div>
                  </div>

                  {/* Task Distribution (completed vs remaining) */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-650 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Completed Tasks</span>
                      <span className="text-2xl font-bold text-slate-900">{doneCount} <span className="text-xs font-normal text-slate-400">/ {totalCount}</span></span>
                    </div>
                  </div>

                  {/* Pending Tasks */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Pending Work</span>
                      <span className="text-2xl font-bold text-slate-900">{totalCount - doneCount}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Status distribution bars */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">Task Status Distribution</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'To Do', count: todoCount, color: 'bg-slate-400' },
                        { label: 'In Progress', count: inProgressCount, color: 'bg-indigo-650' },
                        { label: 'In Review', count: inReviewCount, color: 'bg-amber-500' },
                        { label: 'Done', count: doneCount, color: 'bg-emerald-500' }
                      ].map((item, index) => {
                        const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span>{item.label}</span>
                              <span>{item.count} task{item.count !== 1 ? 's' : ''} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Upcoming deadlines list */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">Upcoming Deadlines</h4>
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {upcomingDeadlines.map(task => (
                        <div key={task.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                          <div>
                            <span className="text-slate-900 font-bold text-sm block">{task.name}</span>
                            <span className="text-xs text-slate-400 block mt-0.5">List: {lists.find(l => l.id === task.listId)?.name}</span>
                          </div>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                            {task.dueDate}
                          </span>
                        </div>
                      ))}
                      {upcomingDeadlines.length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-8 italic font-semibold">No upcoming deadlines.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          } else {
            // Admin mode
            return (
              <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
                {/* Upper banner */}
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Spaces Aggregated metrics</h3>
                    <p className="text-xs text-indigo-200 mt-1">Aggregated statistics and team-wide tracking for {selectedSpace?.name || 'Workspace'} Space</p>
                  </div>
                  <div className="bg-indigo-800/50 border border-indigo-750 px-4 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 block uppercase font-mono tracking-wider font-bold">overall progress</span>
                    <span className="text-2xl font-black text-white">{avgProgress}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Total Tasks</span>
                      <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">In Progress</span>
                      <span className="text-2xl font-bold text-slate-900">{inProgressCount}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">In Review</span>
                      <span className="text-2xl font-bold text-slate-900">{inReviewCount}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Completed</span>
                      <span className="text-2xl font-bold text-slate-900">{doneCount}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Status distribution bars */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">Task Status Distribution</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'To Do', count: todoCount, color: 'bg-slate-400' },
                        { label: 'In Progress', count: inProgressCount, color: 'bg-indigo-650' },
                        { label: 'In Review', count: inReviewCount, color: 'bg-amber-500' },
                        { label: 'Done', count: doneCount, color: 'bg-emerald-500' }
                      ].map((item, index) => {
                        const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span>{item.label}</span>
                              <span>{item.count} task{item.count !== 1 ? 's' : ''} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Upcoming deadlines list */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">Upcoming Team Deadlines</h4>
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {upcomingDeadlines.map(task => {
                        const assignee = users.find(u => u.id === task.assigneeId);
                        return (
                          <div key={task.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                            <div>
                              <span className="text-slate-900 font-bold text-sm block">{task.name}</span>
                              <span className="text-xs text-slate-400 block mt-0.5">Assignee: {assignee ? assignee.name : 'Unassigned'}</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                              {task.dueDate}
                            </span>
                          </div>
                        );
                      })}
                      {upcomingDeadlines.length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-8 italic font-semibold">No upcoming deadlines.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Centralized task progress tracking table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Centralized Task Progress Tracking</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase bg-slate-50">
                          <th className="px-6 py-3">Task Title</th>
                          <th className="px-6 py-3">Assignee</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Progress %</th>
                          <th className="px-6 py-3">Created At</th>
                          <th className="px-6 py-3">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {filteredTasks.map(task => {
                          const assignee = users.find(u => u.id === task.assigneeId);
                          return (
                            <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => handleOpenInspector(task)}
                                  className="text-slate-950 hover:text-indigo-650 text-left font-bold"
                                >
                                  {task.name}
                                </button>
                              </td>
                              <td className="px-6 py-4">
                                {assignee ? (
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-5 h-5 rounded-full ${assignee.color} text-[9px] font-black text-white flex items-center justify-center`}>
                                      {assignee.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{assignee.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Unassigned</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  task.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' :
                                  task.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-700' :
                                  task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-700'
                                }`}>
                                  {task.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">{getProgressForStatus(task.status)}%</td>
                              <td className="px-6 py-4">{new Date(task.createdAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4">{task.dueDate || 'No Due Date'}</td>
                            </tr>
                          );
                        })}
                        {filteredTasks.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No tasks found in space/list.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          }
        })()}

        
        {/* VIEW 1: ClickUp-style List View */}
        {subTab === 'LIST' && (
          <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
            {forceAssigneeFilter ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                {/* List Group Header */}
                <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <FolderIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-800">My Assigned Tasks</span>
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Status rows listing */}
                <div className="divide-y divide-slate-100">
                  {STATUS_COLUMNS.map(col => {
                    const colTasks = filteredTasks.filter(t => t.status === col.id);
                    
                    return (
                      <div key={col.id} className="py-2">
                        {/* Status Header Label */}
                        <div className="flex items-center space-x-2 px-5 py-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{
                            backgroundColor: col.id === 'TODO' ? '#94A3B8' : col.id === 'IN_PROGRESS' ? '#6366F1' : col.id === 'IN_REVIEW' ? '#F59E0B' : '#10B981'
                          }} />
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            {col.name}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-400 italic">
                            ({colTasks.length})
                          </span>
                        </div>

                        {/* Task rows */}
                        <div className="mt-1 space-y-0.5">
                          {colTasks.map(task => {
                            const isDone = task.status === 'DONE';
                            
                            return (
                              <div 
                                key={task.id} 
                                className="flex items-center justify-between border-y border-transparent hover:border-slate-150 py-1.5 px-5 hover:bg-indigo-50/15 transition group text-slate-700 text-xs"
                              >
                                <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                                  {/* Trigger complete toggle */}
                                  <input 
                                    type="checkbox" 
                                    checked={isDone}
                                    onChange={async (e) => {
                                      e.stopPropagation();
                                      if (task.assigneeId !== activeUser?.id) {
                                        alert("Only the assigned employee can change the task status.");
                                        return;
                                      }
                                      const nextStatus = isDone ? 'TODO' : 'DONE';
                                      await updateTask(task.id, { status: nextStatus });
                                    }}
                                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4 shrink-0 transition"
                                  />

                                  {/* Priority selection flag color */}
                                  <select
                                    value={task.priority || 'NONE'}
                                    disabled={isEmployee}
                                    onChange={async (e) => {
                                      await updateTask(task.id, { priority: e.target.value as any });
                                    }}
                                    className="text-[11px] font-bold border-none bg-transparent hover:bg-slate-100 py-0.5 px-2 rounded cursor-pointer shrink-0 focus:ring-0 focus:outline-none transition"
                                  >
                                    <option value="NONE">⚪ None</option>
                                    <option value="LOW">⚪ Low</option>
                                    <option value="NORMAL">🔵 Normal</option>
                                    <option value="HIGH">🟡 High</option>
                                    <option value="URGENT">🔴 Urgent</option>
                                  </select>

                                  {/* Task Name clickable */}
                                  <button
                                    onClick={() => handleOpenInspector(task)}
                                    className={`font-semibold truncate text-left hover:text-indigo-600 transition ${
                                      isDone ? 'line-through text-slate-400 font-medium' : 'text-slate-800'
                                    }`}
                                  >
                                    {task.name}
                                  </button>

                                  {/* Progress display */}
                                  <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded flex items-center shrink-0">
                                    {getProgressForStatus(task.status)}%
                                  </span>
                                </div>

                                {/* Attributes side alignments */}
                                <div className="flex items-center space-x-6 flex-shrink-0">
                                  {/* Due Date Inline Date picker */}
                                  <div className="flex items-center text-[11px] text-slate-500">
                                    <span className="text-[10px] text-slate-400 mr-1 font-semibold uppercase">Due:</span>
                                    <input 
                                      type="date" 
                                      value={task.dueDate || ''}
                                      disabled={isEmployee}
                                      onChange={async (e) => {
                                        await updateTask(task.id, { dueDate: e.target.value || undefined });
                                      }}
                                      className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border-none rounded py-0.5 px-1.5 focus:ring-0 focus:outline-none cursor-pointer"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : spaceLists.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs">
                <FolderIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Task Lists are available</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Lists organize related tasks inside this space. Let's create your first list inside this Space!</p>
                {!isEmployee && (
                  <button
                    onClick={async () => {
                      const listName = prompt("Enter new task list name:", "Tasks");
                      if (listName && listName.trim()) {
                        await createList(selectedSpace.id, undefined, listName.trim());
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition shadow-sm"
                  >
                    Create List Directory
                  </button>
                )}
              </div>
            ) : (
              spaceLists.filter(l => !selectedList || l.id === selectedList.id).map(list => {
                const listTasks = filteredTasks.filter(t => t.listId === list.id);
                
                return (
                  <div key={list.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    {/* List Group Header */}
                    <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <FolderIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-800">{list.name}</span>
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {listTasks.length} task{listTasks.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {!isEmployee && (
                        confirmingListId === list.id ? (
                          <div className="flex items-center space-x-1.5 animate-fade-in text-[10px]">
                            <span className="text-rose-500 font-semibold text-[10px] hidden sm:inline">Delete with all tasks?</span>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/lists/${list.id}`, {
                                    method: 'DELETE',
                                    headers: { 'X-Active-User-Id': sessionStorage.getItem('activeUserId') || localStorage.getItem('activeUserId') || 'u-1' }
                                  });
                                  if (response.ok) {
                                    await triggerSync();
                                  }
                                } catch (err: any) {
                                  console.error(err);
                                } finally {
                                  setConfirmingListId(null);
                                }
                              }}
                              className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-0.5 px-2 rounded transition cursor-pointer text-[10px]"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmingListId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-0.5 px-2 rounded transition cursor-pointer text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingListId(list.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition shrink-0 cursor-pointer"
                            title="Delete List"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>

                    {/* Status rows listing */}
                    <div className="divide-y divide-slate-100">
                      {STATUS_COLUMNS.map(col => {
                        const colTasks = listTasks.filter(t => t.status === col.id);
                        
                        return (
                          <div key={col.id} className="py-2">
                            {/* Status Header Label */}
                            <div className="flex items-center space-x-2 px-5 py-1">
                              <span className="w-2 h-2 rounded-full inline-block" style={{
                                backgroundColor: col.id === 'TODO' ? '#94A3B8' : col.id === 'IN_PROGRESS' ? '#6366F1' : col.id === 'IN_REVIEW' ? '#F59E0B' : '#10B981'
                              }} />
                              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                {col.name}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400 italic">
                                ({colTasks.length})
                              </span>
                            </div>

                            {/* Task rows */}
                            <div className="mt-1 space-y-0.5">
                              {colTasks.map(task => {
                                const isDone = task.status === 'DONE';
                                const assignee = users.find(u => u.id === task.assigneeId);
                                
                                return (
                                  <div 
                                    key={task.id} 
                                    className="flex items-center justify-between border-y border-transparent hover:border-slate-150 py-1.5 px-5 hover:bg-indigo-50/15 transition group text-slate-700 text-xs"
                                  >
                                    <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                                      {/* Trigger complete toggle */}
                                      <input 
                                        type="checkbox" 
                                        checked={isDone}
                                        onChange={async (e) => {
                                          e.stopPropagation();
                                          if (task.assigneeId !== activeUser?.id) {
                                            alert("Only the assigned employee can change the task status.");
                                            return;
                                          }
                                          const nextStatus = isDone ? 'TODO' : 'DONE';
                                          await updateTask(task.id, { status: nextStatus });
                                        }}
                                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4 shrink-0 transition"
                                      />

                                      {/* Priority selection flag color */}
                                      <select
                                        value={task.priority || 'NONE'}
                                        disabled={isEmployee}
                                        onChange={async (e) => {
                                          await updateTask(task.id, { priority: e.target.value as any });
                                        }}
                                        className="text-[11px] font-bold border-none bg-transparent hover:bg-slate-100 py-0.5 px-2 rounded cursor-pointer shrink-0 focus:ring-0 focus:outline-none transition"
                                      >
                                        <option value="NONE">⚪ None</option>
                                        <option value="LOW">⚪ Low</option>
                                        <option value="NORMAL">🔵 Normal</option>
                                        <option value="HIGH">🟡 High</option>
                                        <option value="URGENT">🔴 Urgent</option>
                                      </select>

                                      {/* Task Name clickable */}
                                      <button
                                        onClick={() => handleOpenInspector(task)}
                                        className={`font-semibold truncate text-left hover:text-indigo-600 transition ${
                                          isDone ? 'line-through text-slate-400 font-medium' : 'text-slate-800'
                                        }`}
                                      >
                                        {task.name}
                                      </button>

                                      {/* Progress display */}
                                      <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded flex items-center shrink-0">
                                        {getProgressForStatus(task.status)}%
                                      </span>

                                      {/* Attachment tag */}
                                      {Array.isArray(task.customFields?.attachments) && task.customFields.attachments.length > 0 && (
                                        <span className="text-[9.5px] bg-indigo-50 border border-indigo-150/40 text-indigo-600 font-bold px-1.5 py-0.5 rounded flex items-center shrink-0">
                                          📎 {task.customFields.attachments.length} attachment{task.customFields.attachments.length !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>

                                    {/* Attributes side alignments */}
                                    <div className="flex items-center space-x-6">
                                      {/* Due Date Inline Date picker */}
                                      <div className="flex items-center text-[11px] text-slate-500">
                                        <span className="text-[10px] text-slate-400 mr-1 font-semibold uppercase">Due:</span>
                                        <input 
                                          type="date" 
                                          value={task.dueDate || ''}
                                          disabled={isEmployee}
                                          onChange={async (e) => {
                                            await updateTask(task.id, { dueDate: e.target.value || undefined });
                                          }}
                                          className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border-none rounded py-0.5 px-1.5 focus:ring-0 focus:outline-none cursor-pointer"
                                        />
                                      </div>

                                      {/* Inline Assignee Selector */}
                                      <div className="flex items-center">
                                        <select
                                          value={task.assigneeId || ''}
                                          disabled={isEmployee}
                                          onChange={async (e) => {
                                            await updateTask(task.id, { assigneeId: e.target.value || undefined });
                                          }}
                                          className="text-[11px] font-bold border-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-0.5 px-2 focus:ring-0 focus:outline-none cursor-pointer rounded shrink-0 transition"
                                        >
                                          <option value="">Unassigned</option>
                                          {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Delete action */}
                                      {(isAdmin || task.taskSource === 'self_assigned' || task.deleteRequestStatus === 'approved') ? (
                                        confirmingTaskId === task.id ? (
                                          <div 
                                            className="flex items-center space-x-1 animate-fade-in"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                await deleteTask(task.id);
                                                setConfirmingTaskId(null);
                                              }}
                                              className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-0.5 px-1.5 rounded transition cursor-pointer text-[9px]"
                                            >
                                              Confirm
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmingTaskId(null);
                                              }}
                                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-0.5 px-1.5 rounded transition cursor-pointer text-[9px]"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              setConfirmingTaskId(task.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition p-1 rounded hover:bg-rose-50 shrink-0 cursor-pointer"
                                            title="Delete Task"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )
                                      ) : (
                                        isEmployee && task.taskSource === 'admin_assigned' && (
                                          task.deleteRequestStatus === 'pending' ? (
                                            <span 
                                              className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 cursor-help"
                                              onClick={(e) => e.stopPropagation()}
                                              title={`Request justification: "${task.deleteRequestReason || 'None provided'}"`}
                                            >
                                              ⏳ Pending
                                            </span>
                                          ) : (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const reason = prompt("Enter justification for requesting task deletion:");
                                                if (reason && reason.trim()) {
                                                  try {
                                                    await api.requestDeleteTask(task.id, reason.trim());
                                                    await triggerSync();
                                                    alert("Deletion request sent successfully.");
                                                  } catch (err: any) {
                                                    alert(err.message || "Failed to submit deletion request.");
                                                  }
                                                }
                                              }}
                                              className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/55 px-1.5 py-0.5 rounded transition cursor-pointer shrink-0"
                                              title="Request deletion"
                                            >
                                              Request Delete
                                            </button>
                                          )
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* ClickUp-style Inline Quick Add Input Form */}
                            {!isEmployee && (
                              <div className="px-5 mt-1">
                                <form 
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = e.currentTarget;
                                    const input = form.elements.namedItem('taskTitle') as HTMLInputElement;
                                    if (input && input.value.trim()) {
                                      await handleQuickAddTask(list.id, col.id, input.value.trim());
                                      input.value = '';
                                    }
                                  }} 
                                  className="flex items-center pl-7 py-1 bg-slate-50/30 rounded border border-transparent hover:border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition"
                                >
                                  <Plus className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                                  <input 
                                    type="text" 
                                    name="taskTitle"
                                    placeholder={`+ Add task to "${col.name}"...`} 
                                    className="bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0 w-full py-0"
                                  />
                                </form>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW 2: Traditional Kanban Columns stage */}
        {subTab === 'BOARD' && (
          <div className="flex items-start gap-6 p-8 h-full min-h-0 min-w-max animate-in fade-in duration-200">
            {STATUS_COLUMNS.map((column) => {
              const columnTasks = filteredTasks.filter(t => t.status === column.id);
              const isOverThisCol = activeOverColId === column.id;

              return (
                <div 
                  key={column.id} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (activeOverColId !== column.id) {
                      setActiveOverColId(column.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;
                    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
                      setActiveOverColId(null);
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setActiveOverColId(null);
                    const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
                    if (taskId) {
                      const tk = tasks.find(t => t.id === taskId);
                      if (tk && tk.status !== column.id) {
                        await handleMoveStatus(tk, column.id);
                      }
                    }
                    setDraggingTaskId(null);
                  }}
                  className={`w-72 max-h-full flex flex-col rounded-xl border flex-shrink-0 p-4 border-t-4 transition-all duration-200 ${
                    isOverThisCol 
                      ? 'border-indigo-400 bg-indigo-50/60 scale-[1.01] shadow-md ring-4 ring-indigo-100' 
                      : `border-slate-200 bg-slate-100/50 ${column.bg}`
                  }`}
                >
                  
                  {/* Header col */}
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${column.txt}`}>{column.name}</span>
                      <span className="bg-slate-200/80 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {columnTasks.length}
                      </span>
                    </div>

                    {selectedSpace && !isEmployee && (
                      <button
                        onClick={() => {
                          setActiveCreatorCol(activeCreatorCol === column.id ? null : column.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline task template creator form */}
                  {activeCreatorCol === column.id && (
                    <form 
                      onSubmit={(e) => handleCreateTask(column.id, e)} 
                      className="bg-white p-4 text-slate-700 rounded-xl border-2 border-indigo-500 shadow-lg mb-4 space-y-3.5 transition-all duration-200 animate-in fade-in"
                    >
                      {/* Saving into indicator dynamic label badge */}
                      <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[9.5px] font-bold text-slate-500 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>Target List:</span>
                        <span className="text-indigo-600 font-mono text-xs">
                          {selectedList ? selectedList.name : (spaceLists[0]?.name || "General Checklist")}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Title</label>
                        <input
                          type="text"
                          required
                          placeholder="Describe target task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full text-xs font-semibold py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                        <textarea
                          placeholder="Write task details or requirements..."
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          className="w-full text-[10.5px] py-1.5 px-2 focus:outline-none bg-slate-50 border border-slate-200 rounded-lg h-16 focus:bg-white focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 leading-normal resize-none font-sans text-slate-700"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Priority</label>
                          <select
                            value={newTaskPriority}
                            onChange={(e: any) => setNewTaskPriority(e.target.value)}
                            className="w-full text-[10.5px] font-medium border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-slate-50 hover:bg-slate-100 cursor-pointer"
                          >
                            <option value="NONE">Priority</option>
                            <option value="URGENT">🔴 Urgent</option>
                            <option value="HIGH">🟡 High</option>
                            <option value="NORMAL">🔵 Normal</option>
                            <option value="LOW">⚪ Low</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Assignee</label>
                          <select
                            value={newTaskAssignee}
                            onChange={(e) => setNewTaskAssignee(e.target.value)}
                            className="w-full text-[10.5px] font-medium border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-700"
                          >
                            <option value="">Assignee</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setActiveCreatorCol(null)}
                          className="text-[10.5px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10.5px] font-bold px-4 py-1.5 rounded-lg shadow-md transition-all cursor-pointer"
                        >
                          Save Task
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Scrollable list of task cards */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                    {columnTasks.map((task) => {
                      const assignee = users.find(u => u.id === task.assigneeId);
                      const checklist = task.checklist || [];
                      const checkedCount = checklist.filter(item => item.isChecked).length;
                      const checklistTotal = checklist.length;
                      const isDraggingThisTask = draggingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleOpenInspector(task)}
                          draggable={task.assigneeId === activeUser?.id}
                          onDragStart={(e) => {
                            if (task.assigneeId !== activeUser?.id) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData('text/plain', task.id);
                            setDraggingTaskId(task.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggingTaskId(null);
                            setActiveOverColId(null);
                          }}
                          className={`bg-white p-4 rounded-xl border shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative group-card block ${
                            isDraggingThisTask 
                              ? 'opacity-35 border-dashed border-indigo-400 scale-[0.98]' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Priority Tag line */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeColor(task.priority)}`}>
                              {task.priority || 'NONE'}
                            </span>
                            <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                              {getProgressForStatus(task.status)}%
                            </span>
                          </div>

                          {/* Name of task */}
                          <h4 className="text-xs font-bold text-slate-800 leading-tight block mb-1 group-hover:text-indigo-600 transition">
                            {task.name}
                          </h4>

                          {/* Brief details excerpt */}
                          <p className="text-[11px] text-slate-400 line-clamp-2 block mb-3.5">
                            {task.description || "No descriptions specified."}
                          </p>

                          {/* Sub-checklist status metrics bar */}
                          {checklistTotal > 0 && (
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded mb-3 max-w-max">
                              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{checkedCount} / {checklistTotal} checkmarks</span>
                            </div>
                          )}

                          {/* Task Info row */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                              {task.dueDate && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {task.dueDate}
                                </span>
                              )}
                              {Array.isArray(task.customFields?.attachments) && task.customFields.attachments.length > 0 && (
                                <span className="flex items-center gap-0.5 font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/60" title="Attachments present">
                                  <span>📎</span>
                                  <span className="text-[9.5px]">{task.customFields.attachments.length}</span>
                                </span>
                              )}
                            </div>

                            {assignee ? (
                              <div 
                                className={`w-6 h-6 rounded-full text-[10px] font-bold ${assignee.color} flex items-center justify-center`} 
                                style={getUserColorStyles(assignee.color)}
                                title={assignee.name}
                              >
                                {assignee.name.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 animate-pulse">
                                <User className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                    {columnTasks.length === 0 && (
                      <p className="text-center text-[11px] text-slate-400 py-6">No tasks in column.</p>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: Immersive ClickUp-style Monthly Calendar View with sidebars (as in the 3rd Screenshot) */}
        {subTab === 'CALENDAR' && (() => {
          // Calculate calendar variables dynamically
          const currentYear = calendarDate.getFullYear();
          const currentMonthIdx = calendarDate.getMonth();
          const activeMonthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

          const firstDayOfMonthIndex = new Date(currentYear, currentMonthIdx, 1).getDay();
          const totalDaysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
          const totalDaysInPrevMonth = new Date(currentYear, currentMonthIdx, 0).getDate();

          const calendarCards: { date: Date; isFocusMonth: boolean }[] = [];

          // 1. Previous month padding overflow
          for (let i = firstDayOfMonthIndex - 1; i >= 0; i--) {
            calendarCards.push({
              date: new Date(currentYear, currentMonthIdx - 1, totalDaysInPrevMonth - i),
              isFocusMonth: false
            });
          }

          // 2. Active month days
          for (let i = 1; i <= totalDaysInMonth; i++) {
            calendarCards.push({
              date: new Date(currentYear, currentMonthIdx, i),
              isFocusMonth: true
            });
          }

          // 3. Next month padding overflow (fill grid to exactly 42 slots index)
          const remainingSlots = 42 - calendarCards.length;
          for (let i = 1; i <= remainingSlots; i++) {
            calendarCards.push({
              date: new Date(currentYear, currentMonthIdx + 1, i),
              isFocusMonth: false
            });
          }

          const getLocalDateString = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const r = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${r}`;
          };

          // Filter out unscheduled and overdue tasks for sidebars
          const nowStr = getLocalDateString(new Date());
          const unscheduledTasks = filteredTasks.filter(t => !t.dueDate);
          const overdueTasks = filteredTasks.filter(t => t.dueDate && t.status !== 'DONE' && t.dueDate < nowStr);

          return (
            <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[600px] animate-in fade-in duration-200">
              
              {/* Left 9-cols: interactive monthly grid */}
              <div className="lg:col-span-9 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs h-full min-h-[500px]">
                {/* Year/Month selectors toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center space-x-1">
                    <CalendarDays className="w-5 h-5 text-indigo-500 mr-2" />
                    <h3 className="font-bold text-slate-800 text-sm md:text-base">{activeMonthName}</h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setCalendarDate(new Date(currentYear, currentMonthIdx - 1, 1))}
                      className="p-1.5 hover:bg-slate-200/60 rounded text-slate-600 transition cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setCalendarDate(new Date())}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => setCalendarDate(new Date(currentYear, currentMonthIdx + 1, 1))}
                      className="p-1.5 hover:bg-slate-200/60 rounded text-slate-600 transition cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weekday headers layout line */}
                <div className="grid grid-cols-7 text-center border-b border-slate-100 text-[10.5px] font-bold text-slate-400 bg-slate-50 py-2.5 uppercase tracking-wider">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Calendar Days Matrix block */}
                <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-[400px] border-collapse bg-slate-50">
                  {calendarCards.map((cell, idx) => {
                    const formattedCellDateStr = getLocalDateString(cell.date);
                    const dayTasks = filteredTasks.filter(t => t.dueDate === formattedCellDateStr);
                    const isToday = formattedCellDateStr === nowStr;

                    return (
                      <div 
                        key={idx}
                        className={`border-r border-b border-slate-200 p-2 min-h-[75px] max-h-[110px] overflow-hidden flex flex-col justify-between transition-colors ${
                          cell.isFocusMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-350'
                        } hover:bg-indigo-50/10 group/cell relative`}
                      >
                        {/* Cell Number heading */}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                            isToday 
                              ? 'bg-indigo-600 text-white font-extrabold' 
                              : cell.isFocusMonth ? 'text-slate-700' : 'text-slate-400'
                          }`}>
                            {cell.date.getDate()}
                          </span>

                          {/* Quick add trigger button */}
                          {!isEmployee && !forceAssigneeFilter && (
                            <button
                              onClick={async () => {
                                const title = prompt("Enter new task title for " + cell.date.toLocaleDateString() + ":");
                                if (title && title.trim()) {
                                  let firstListId = spaceLists[0]?.id;
                                  if (!firstListId) {
                                    const nl = await api.createList({ spaceId: selectedSpace.id, name: "General Checklist" });
                                    firstListId = nl.id;
                                    await triggerSync();
                                  }
                                  await createTask({
                                    listId: firstListId,
                                    name: title.trim(),
                                    dueDate: formattedCellDateStr,
                                    status: "TODO"
                                  });
                                }
                              }}
                              className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer transition"
                              title="Add task on this date"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Plots Task inside mini-strips */}
                        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 min-h-0">
                          {dayTasks.map(task => {
                            const isDone = task.status === 'DONE';
                            return (
                              <button
                                key={task.id}
                                onClick={() => handleOpenInspector(task)}
                                className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[9.5px] font-bold border block transition ${
                                  isDone
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 font-medium line-through'
                                    : task.priority === 'URGENT'
                                      ? 'bg-rose-50 border-rose-100 text-rose-800'
                                      : task.priority === 'HIGH'
                                        ? 'bg-amber-50 border-amber-100 text-amber-800'
                                        : 'bg-indigo-50 border-indigo-100 text-indigo-800'
                                }`}
                                title={`${task.name} (${task.priority || 'No priority'})`}
                              >
                                {task.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 3-cols: ClickUp sidebar layouts (Unscheduled / Overdue listings) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* 1. Unscheduled Tickets card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs flex flex-col max-h-72">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <span>📌</span> Unscheduled ({unscheduledTasks.length})
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0 text-slate-700">
                    {unscheduledTasks.map(task => (
                      <div 
                        key={task.id} 
                        className="p-2 border border-slate-150 rounded-lg bg-slate-50 hover:bg-white transition flex flex-col"
                      >
                        <span className="text-xs font-semibold text-slate-800 line-clamp-1">{task.name}</span>
                        <div className="flex items-center justify-between mt-1.5">
                          {/* Calendar picker to instantly schedule onto matrix day */}
                          <input 
                            type="date"
                            onChange={async (e) => {
                              const date = e.target.value;
                              if (date) {
                                await updateTask(task.id, { dueDate: date });
                              }
                            }}
                            className="text-[9.5px] font-semibold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-150 border-none focus:ring-0 cursor-pointer"
                            title="Schedule Task"
                          />
                          <button
                            onClick={() => handleOpenInspector(task)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                    {unscheduledTasks.length === 0 && (
                      <p className="text-center text-[10.5px] text-slate-400 py-6 italic font-medium">All tasks are scheduled.</p>
                    )}
                  </div>
                </div>

                {/* 2. Overdue Tickets card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs flex flex-col max-h-72">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 shrink-0">
                    <span className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Overdue ({overdueTasks.length})
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0 text-slate-750">
                    {overdueTasks.map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => handleOpenInspector(task)}
                        className="p-2 border border-rose-100 rounded-lg bg-rose-50/40 hover:bg-white transition flex flex-col cursor-pointer"
                      >
                        <span className="text-xs font-bold text-rose-910 truncate">{task.name}</span>
                        <div className="flex items-center justify-between mt-1 text-[9.5px]">
                          <span className="font-semibold text-red-500 font-mono">Due: {task.dueDate}</span>
                          <span className="text-slate-400">🚨 Attention required</span>
                        </div>
                      </div>
                    ))}
                    {overdueTasks.length === 0 && (
                      <p className="text-center text-[10.5px] text-slate-400 py-6 italic font-medium">No overdue tasks.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          );
        })()}

      </div>

      {/* --- COLLAPSIBLE CARD DETAIL DRAWER --- */}
      {selectedTask && (
        <div className="fixed inset-y-0 right-0 w-[460px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-55 p-6 animate-fade-in text-slate-800">
          
          {/* Header Close triggers */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono">Core Task Inspector</span>
            <div className="flex items-center space-x-2">
              {(isAdmin || selectedTask.taskSource === 'self_assigned' || selectedTask.deleteRequestStatus === 'approved') ? (
                isConfirmingDeleteTask ? (
                  <button
                    onClick={async () => {
                      await deleteTask(selectedTask.id);
                      setSelectedTask(null);
                      setIsConfirmingDeleteTask(false);
                    }}
                    className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 text-xs font-semibold rounded transition cursor-pointer animate-pulse"
                    title="Confirm permanent deletion of this task"
                  >
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsConfirmingDeleteTask(true);
                      setTimeout(() => setIsConfirmingDeleteTask(false), 5500);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition cursor-pointer"
                    title="Delete task"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )
              ) : (
                isEmployee && selectedTask.taskSource === 'admin_assigned' && (
                  selectedTask.deleteRequestStatus === 'pending' ? (
                    <span 
                      className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-250 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-help"
                      title={`Request justification: "${selectedTask.deleteRequestReason || 'None provided'}"`}
                    >
                      ⏳ Deletion Pending
                    </span>
                  ) : (
                    <button
                      onClick={async () => {
                        const reason = prompt("Enter justification for requesting task deletion:");
                        if (reason && reason.trim()) {
                          try {
                            const updated = await api.requestDeleteTask(selectedTask.id, reason.trim());
                            setSelectedTask(updated);
                            await triggerSync();
                            alert("Deletion request sent successfully.");
                          } catch (err: any) {
                            alert(err.message || "Failed to submit deletion request.");
                          }
                        }
                      }}
                      className="text-[10.5px] font-bold text-indigo-650 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      title="Request Admin to delete this task"
                    >
                      <span>❓ Request Delete</span>
                    </button>
                  )
                )
              )}
              <button 
                onClick={() => setSelectedTask(null)} 
                className="p-1 bg-slate-50 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body information fields */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            
            {/* Title editable */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Task Title</label>
              <input
                type="text"
                value={selectedTask.name}
                onChange={(e) => {
                  setSelectedTask({ ...selectedTask, name: e.target.value });
                }}
                onBlur={(e) => {
                  updateTask(selectedTask.id, { name: e.target.value });
                }}
                className="w-full font-bold text-lg text-slate-900 border-b border-slate-200 hover:border-slate-400 focus:border-indigo-600 focus:outline-none py-1"
              />
            </div>

            {/* Description editable */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Details description</label>
              <textarea
                value={selectedTask.description}
                rows={3}
                onChange={(e) => {
                  setSelectedTask({ ...selectedTask, description: e.target.value });
                }}
                onBlur={(e) => {
                  updateTask(selectedTask.id, { description: e.target.value });
                }}
                className="w-full text-xs text-slate-600 border border-slate-200 rounded p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Attachments Section with upload ability */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Task Attachments / Reference Files</label>
                <div className="relative">
                  <input
                    type="file"
                    id="task-details-uploader"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const base64Data = event.target?.result as string;
                        if (!base64Data) return;

                        try {
                          const res = await api.uploadFileAttachment(file.name, file.type, base64Data);
                          const currentAttachments = Array.isArray(selectedTask.customFields?.attachments)
                            ? selectedTask.customFields.attachments
                            : [];
                          const updatedAttachments = [
                            ...currentAttachments,
                            { name: res.name || file.name, url: res.url, type: res.type || file.type, size: res.size || file.size }
                          ];
                          
                          const newCustomFields = {
                            ...(selectedTask.customFields || {}),
                            attachments: updatedAttachments
                          };

                          setSelectedTask({ ...selectedTask, customFields: newCustomFields });
                          await updateTask(selectedTask.id, { customFields: newCustomFields });
                        } catch (err: any) {
                          alert("Upload failed: " + err.message);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="task-details-uploader"
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add Attachment
                  </label>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 min-h-[50px] space-y-1.5 flex flex-col justify-center">
                {Array.isArray(selectedTask.customFields?.attachments) && selectedTask.customFields.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5 w-full">
                    {selectedTask.customFields.attachments.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-1.5 bg-white border border-slate-150 rounded text-xs text-slate-700">
                        <span className="truncate max-w-[200px] text-slate-700 font-medium">📂 {file.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = selectedTask.customFields.attachments.filter((_: any, idx: number) => idx !== index);
                              const newCustomFields = {
                                ...(selectedTask.customFields || {}),
                                attachments: updated
                              };
                              setSelectedTask({ ...selectedTask, customFields: newCustomFields });
                              await updateTask(selectedTask.id, { customFields: newCustomFields });
                            }}
                            className="text-rose-500 hover:text-rose-700 p-0.5 font-bold text-[10px] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center">No reference files uploaded yet.</p>
                )}
              </div>
            </div>

            {/* Grid properties */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={(e) => {
                    const status = e.target.value as any;
                    if (selectedTask.assigneeId !== activeUser?.id) {
                      alert("Only the assigned employee can change the task status.");
                      return;
                    }
                    setSelectedTask({ ...selectedTask, status });
                    updateTask(selectedTask.id, { status });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Priority</label>
                <select
                  value={selectedTask.priority}
                  disabled={isEmployee}
                  onChange={(e) => {
                    const priority = e.target.value as any;
                    setSelectedTask({ ...selectedTask, priority });
                    updateTask(selectedTask.id, { priority });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="NONE">Clear</option>
                  <option value="URGENT">🔴 Urgent</option>
                  <option value="HIGH">🟡 High</option>
                  <option value="NORMAL">🔵 Normal</option>
                  <option value="LOW">⚪ Low</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Assign User</label>
                <select
                  value={selectedTask.assigneeId || ''}
                  disabled={isEmployee}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    setSelectedTask({ ...selectedTask, assigneeId: id });
                    updateTask(selectedTask.id, { assigneeId: id });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">No Assignee</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Due Date</label>
                <input
                  type="date"
                  value={selectedTask.dueDate || ''}
                  disabled={isEmployee}
                  onChange={(e) => {
                    const date = e.target.value || undefined;
                    setSelectedTask({ ...selectedTask, dueDate: date });
                    updateTask(selectedTask.id, { dueDate: date });
                  }}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="col-span-2 mt-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Derived Progress</label>
                <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${getProgressForStatus(selectedTask.status)}%` }} 
                    />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 shrink-0">
                    {getProgressForStatus(selectedTask.status)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Checklists Section */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Checklist items</label>
              
              <div className="space-y-1.5">
                {(selectedTask.checklist || []).map(item => (
                  <div key={item.id} className="flex items-center space-x-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.isChecked}
                      onChange={(e) => handleToggleChecklist(item.id, e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className={item.isChecked ? "line-through text-slate-400" : "text-slate-700 font-medium"}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Add checklist item */}
              <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  required
                  placeholder="Add checklist bullet row..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:border-indigo-500 focus:outline-none text-slate-750 bg-white"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white p-1.5 rounded hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Activity comments Section */}
            <div className="border-t border-slate-200 pt-5 text-slate-755">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Task Discussions</label>
              
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                {taskComments.map(c => {
                  const author = users.find(u => u.id === c.authorId);
                  return (
                    <div key={c.id} className="bg-slate-50 border border-slate-100 rounded p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{author?.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{new Date(c.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{c.content}</p>
                    </div>
                  );
                })}
                {taskComments.length === 0 && (
                  <p className="text-center text-[11px] text-slate-400 py-3">No task discussions yet.</p>
                )}
              </div>

              {/* Write comments form */}
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Add discussion note..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-750 bg-white"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Post
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
export default TaskBoardView;
