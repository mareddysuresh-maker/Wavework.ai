import React, { useState, useEffect } from 'react';
import { useFlow } from '../lib/FlowContext';
import { Task, Note, Sketch } from '../types';
import { api } from '../lib/api';
import {
  FolderHeart,
  CheckSquare,
  FileText,
  Palette,
  BellRing,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pin,
  Sparkles,
  RefreshCcw,
  Sliders,
  Maximize2
} from 'lucide-react';
import NotesView from './NotesView';
import WhiteboardView from './WhiteboardView';

interface PersonalSpaceViewProps {
  defaultTab?: 'TASKS' | 'NOTES' | 'PAINT' | 'REMINDERS';
}

export const PersonalSpaceView: React.FC<PersonalSpaceViewProps> = ({ defaultTab = 'TASKS' }) => {
  const { activeUser, tasks, triggerSync } = useFlow();
  const [activeTab, setActiveTab] = useState<'TASKS' | 'NOTES' | 'PAINT' | 'REMINDERS'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Reminders local state & actions
  const [reminders, setReminders] = useState<{ id: string; text: string; isChecked: boolean }[]>(() => {
    const saved = localStorage.getItem(`reminders_${activeUser?.id || 'default'}`);
    return saved ? JSON.parse(saved) : [
      { id: '1', text: 'Call dentist tomorrow morning', isChecked: false },
      { id: '2', text: 'Read the distributed systems paper', isChecked: true },
      { id: '3', text: 'Review team performance feedback', isChecked: false }
    ];
  });
  const [newReminderText, setNewReminderText] = useState('');

  useEffect(() => {
    localStorage.setItem(`reminders_${activeUser?.id || 'default'}`, JSON.stringify(reminders));
  }, [reminders, activeUser?.id]);

  // Personal tasks filtering
  const personalTasks = tasks.filter(t => t.isPersonal && t.createdById === activeUser?.id);

  // New personal task form state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NONE'>('NORMAL');
  const [taskDueDate, setTaskDueDate] = useState('');

  const handleCreatePersonalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    try {
      await api.createTask({
        listId: 'personal',
        name: taskName,
        description: taskDesc,
        priority: taskPriority,
        dueDate: taskDueDate,
        isPersonal: true
      });
      setIsTaskModalOpen(false);
      setTaskName('');
      setTaskDesc('');
      setTaskPriority('NORMAL');
      setTaskDueDate('');
      await triggerSync();
    } catch (err) {
      console.error("Failed to create personal task:", err);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      await triggerSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      await triggerSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    const newRem = {
      id: `rem-${Date.now()}`,
      text: newReminderText.trim(),
      isChecked: false
    };
    setReminders([...reminders, newRem]);
    setNewReminderText('');
  };

  const toggleReminder = (id: string) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, isChecked: !r.isChecked } : r));
  };

  const deleteReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden text-slate-100">
      {/* Premium Gradient Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              P
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              My Personal Space
              <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Isolated personal zone. Complete privacy: not even Super Admins can view this area.
          </p>
        </div>
      </div>

      {/* Main Tab Content Panel */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'TASKS' && (
          <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono">Personal Tasks Kanban</h2>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1 transition shadow-lg shadow-indigo-600/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Personal Task
              </button>
            </div>

            {/* Kanban Columns */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 min-h-0">
              {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map(colStatus => {
                const colTasks = personalTasks.filter(t => t.status === colStatus);
                const colHeaders = {
                  TODO: { label: 'To Do', border: 'border-slate-800', badge: 'bg-slate-800 text-slate-400' },
                  IN_PROGRESS: { label: 'In Progress', border: 'border-indigo-900/60', badge: 'bg-indigo-950/80 text-indigo-400' },
                  IN_REVIEW: { label: 'In Review', border: 'border-amber-900/60', badge: 'bg-amber-950/80 text-amber-400' },
                  DONE: { label: 'Completed', border: 'border-emerald-950', badge: 'bg-emerald-950/80 text-emerald-450' }
                };
                const header = colHeaders[colStatus];

                return (
                  <div key={colStatus} className="bg-slate-900/40 rounded-xl border border-slate-900/80 p-4 flex flex-col h-full min-h-[300px]">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-200">{header.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${header.badge}`}>{colTasks.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {colTasks.map(task => (
                        <div key={task.id} className="bg-slate-900 border border-slate-850 hover:border-slate-700 p-3.5 rounded-lg transition group relative">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-white leading-tight">{task.name}</span>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-0.5 opacity-0 group-hover:opacity-100"
                              title="Delete personal task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                          )}

                          <div className="flex items-center justify-between mt-4">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              task.priority === 'URGENT' ? 'bg-rose-950 text-rose-400' :
                              task.priority === 'HIGH' ? 'bg-amber-950 text-amber-400' :
                              'bg-slate-850 text-slate-400'
                            }`}>
                              {task.priority}
                            </span>
                            
                            {/* Simple inline status switcher */}
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateStatus(task.id, e.target.value as Task['status'])}
                              className="bg-slate-850 text-[10px] text-slate-300 font-semibold border-none rounded px-1.5 py-0.5 cursor-pointer outline-none"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="IN_REVIEW">In Review</option>
                              <option value="DONE">Completed</option>
                            </select>
                          </div>
                        </div>
                      ))}

                      {colTasks.length === 0 && (
                        <div className="h-24 border border-dashed border-slate-800/80 rounded-lg flex items-center justify-center text-slate-600 text-[10px] italic">
                          No tasks in this list
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'NOTES' && (
          <div className="h-full bg-slate-900/20">
            <NotesView />
          </div>
        )}

        {activeTab === 'PAINT' && (
          <div className="h-full bg-slate-900/20">
            <WhiteboardView />
          </div>
        )}

        {activeTab === 'REMINDERS' && (
          <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono flex-shrink-0">Personal Reminders List</h2>
            
            <form onSubmit={handleAddReminder} className="flex gap-3 flex-shrink-0 max-w-lg">
              <input
                type="text"
                required
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                placeholder="Type a quick reminder e.g. Buy coffee beans..."
                className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-lg px-3.5 py-2 focus:outline-none focus:border-indigo-505 text-white"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition shrink-0 cursor-pointer"
              >
                Add Reminder
              </button>
            </form>

            <div className="max-w-lg space-y-2 pr-1">
              {reminders.map(rem => (
                <div
                  key={rem.id}
                  className={`flex items-center justify-between p-3.5 rounded-lg border transition ${
                    rem.isChecked 
                      ? 'bg-slate-950/60 border-slate-900 text-slate-500 line-through' 
                      : 'bg-slate-900 border-slate-850 text-slate-100 hover:border-slate-750'
                  }`}
                >
                  <label className="flex items-center space-x-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rem.isChecked}
                      onChange={() => toggleReminder(rem.id)}
                      className="w-4 h-4 text-indigo-600 border-slate-750 rounded focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-950"
                    />
                    <span className="text-xs font-semibold leading-relaxed">{rem.text}</span>
                  </label>
                  <button
                    onClick={() => deleteReminder(rem.id)}
                    className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {reminders.length === 0 && (
                <div className="text-center py-10 italic text-slate-500 text-xs">
                  Your reminders list is currently empty.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1. Modal Task Creation */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-slate-900">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsTaskModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
              <CheckSquare className="text-indigo-600" />
              Add Personal Task
            </h3>
            <form onSubmit={handleCreatePersonalTask} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Study Docker network routing"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-950 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Description</label>
                <textarea
                  placeholder="Details of the study/task..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-950 resize-none h-16 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full border border-slate-300 rounded px-2 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-955 font-bold"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-955 font-bold"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded transition cursor-pointer mt-2"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export default PersonalSpaceView;
