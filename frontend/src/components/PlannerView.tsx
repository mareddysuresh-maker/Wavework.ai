import React, { useState } from 'react';
import { useFlow } from '../lib/FlowContext';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const PlannerView: React.FC = () => {
  const { tasks, users, updateTask, createTask, spaces, lists } = useFlow();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal creation states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalTaskName, setModalTaskName] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalListId, setModalListId] = useState('');
  const [modalAssigneeId, setModalAssigneeId] = useState('');
  const [modalPriority, setModalPriority] = useState('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Create calendar grid dates array
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const calendarCells: (Date | null)[] = [];
  
  // Empty blocks for offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  
  // Date blocks
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(currentYear, currentMonth, d));
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };

  // Match tasks by Date String: e.g. "2026-06-08"
  const getTasksForDate = (date: Date) => {
    const formattedStr = getLocalDateString(date);
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      // Parse ISO string match
      return task.dueDate.split('T')[0] === formattedStr;
    });
  };

  const handleOpenAddModal = (date: Date) => {
    setSelectedDate(date);
    setModalTaskName('');
    setModalDescription('');
    setModalAssigneeId('');
    setModalPriority('MEDIUM');
    setModalError('');
    setIsModalOpen(true);

    // Pre-select first list if available
    if (lists && lists.length > 0) {
      setModalListId(lists[0].id);
    } else {
      setModalListId('');
    }
  };

  const handleCloseAddModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!modalTaskName.trim()) {
      setModalError('Task title is required');
      return;
    }
    if (!modalListId) {
      setModalError('Target list is required. Please create a space and list first.');
      return;
    }
    if (!selectedDate) return;

    try {
      setIsSubmitting(true);
      // Format selected date to YYYY-MM-DD
      const dateString = getLocalDateString(selectedDate);

      await createTask({
        name: modalTaskName.trim(),
        description: modalDescription.trim(),
        listId: modalListId,
        assigneeId: modalAssigneeId || undefined,
        priority: modalPriority,
        dueDate: dateString,
        status: "TODO"
      });

      handleCloseAddModal();
    } catch (err: any) {
      setModalError(err.message || 'Failed to allocate task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full flex flex-col font-sans">
      
      {/* upper header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Timeline Planner</h1>
          <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">TIMELINE ALLOCATIONS GRID | CLICK THE + BUTTON TO SECURELY ASSIGN EVENTS</p>
        </div>

        {/* Date controllers */}
        <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-lg p-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition cursor-pointer"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <span className="text-xs font-bold text-slate-800 px-4 select-none">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition cursor-pointer"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col min-h-[550px]">
        {/* Days grid line */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Dynamic Cells Stage */}
        <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            const hasCell = cell !== null;
            const dateTasks = hasCell ? getTasksForDate(cell) : [];
            const isToday = hasCell && cell.toDateString() === new Date().toDateString();

            return (
              <div 
                key={idx} 
                className={`p-2.5 min-h-[100px] flex flex-col space-y-1.5 transition text-slate-800 border-t border-r border-slate-100 group relative ${
                  hasCell ? 'bg-white hover:bg-slate-50/45' : 'bg-slate-50/50'
                }`}
              >
                {/* Date numbers label */}
                {hasCell && (
                  <div className="flex items-center justify-between flex-shrink-0">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isToday 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}>
                      {cell.getDate()}
                    </span>

                    {/* Inline + Button */}
                    <button
                      onClick={() => handleOpenAddModal(cell)}
                      title={`Add task to ${cell.toLocaleDateString()}`}
                      className="opacity-40 sm:opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-150 rounded transition cursor-pointer flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Plot tasks inside this date cell */}
                {hasCell && (
                  <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                    {dateTasks.map(task => {
                      const assignee = users.find(u => u.id === task.assigneeId);
                      
                      const getBorderColor = (p: string) => {
                        if (p === 'URGENT') return 'border-l-rose-500';
                        if (p === 'HIGH') return 'border-l-amber-500';
                        return 'border-l-slate-400';
                      };

                      return (
                        <div
                          key={task.id}
                          className={`p-1.5 rounded bg-slate-50 border border-slate-100 border-l-3 text-[10px] space-y-0.5 shadow-2xs hover:bg-slate-100 transition truncate ${getBorderColor(task.priority)}`}
                          title={`${task.name}\nPriority: ${task.priority}`}
                        >
                          <span className="font-bold text-slate-800 block truncate">{task.name}</span>
                          <div className="flex items-center justify-between text-[8px] text-slate-400">
                            <span className="font-mono uppercase text-slate-400 font-semibold">{task.status}</span>
                            {assignee && (
                              <span className="text-indigo-600 font-bold uppercase" title={assignee.name}>{assignee.avatarUrl}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Add Task on specific day dialog Modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4">
            
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Allocate New Task</h3>
                <p className="text-xs text-slate-400 font-mono font-semibold">Date: {selectedDate.toLocaleDateString()}</p>
              </div>
              <button 
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                ✕ {modalError}
              </p>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-3.5">
              
              {/* Task Title */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Task Title *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Refactor API controllers"
                  value={modalTaskName}
                  onChange={(e) => setModalTaskName(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Space & List Choice */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Target Space & List *</label>
                <select 
                  required
                  value={modalListId}
                  onChange={(e) => setModalListId(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose List --</option>
                  {spaces.map(space => (
                    <optgroup key={space.id} label={`${space.name} Space`}>
                      {lists.filter(l => l.spaceId === space.id).map(list => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Assignee Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Assign Teammate</label>
                <select 
                  value={modalAssigneeId}
                  onChange={(e) => setModalAssigneeId(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & Description */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Priority</label>
                  <select 
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="NONE">None</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Context / Description</label>
                <textarea 
                  placeholder="Provide scope details..."
                  rows={2}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Submit trigger */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="text-xs text-slate-500 bg-slate-150 p-2 rounded-lg font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 px-4 py-2 rounded-lg font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Allocate Task'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default PlannerView;
