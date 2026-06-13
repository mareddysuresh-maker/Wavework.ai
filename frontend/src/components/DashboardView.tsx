import React from 'react';
import { useFlow } from '../lib/FlowContext';
import {
  CheckSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Layers,
  User,
  MoreHorizontal
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    metrics,
    spaces,
    lists,
    users,
    tasks,
    setCurrentView,
    setSelectedSpace,
    activeUser,
    createTask,
    updateTask
  } = useFlow();

  // Quick Assign Form State
  const [isAdminCreating, setIsAdminCreating] = React.useState(false);
  const [adminTaskName, setAdminTaskName] = React.useState('');
  const [adminTaskDesc, setAdminTaskDesc] = React.useState('');
  const [adminTaskAssignee, setAdminTaskAssignee] = React.useState('');
  const [adminTaskListId, setAdminTaskListId] = React.useState('');
  const [adminTaskPriority, setAdminTaskPriority] = React.useState('MEDIUM');
  const [adminTaskDueDate, setAdminTaskDueDate] = React.useState('');
  const [adminSuccessMsg, setAdminSuccessMsg] = React.useState('');
  const [adminErrorMsg, setAdminErrorMsg] = React.useState('');

  const handleAdminAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminErrorMsg('');
    setAdminSuccessMsg('');

    if (!adminTaskName.trim()) {
      setAdminErrorMsg('Task title is required');
      return;
    }
    if (!adminTaskListId) {
      setAdminErrorMsg('Please select a target List');
      return;
    }

    try {
      setIsAdminCreating(true);
      await createTask({
        name: adminTaskName.trim(),
        description: adminTaskDesc.trim(),
        listId: adminTaskListId,
        assigneeId: adminTaskAssignee || undefined,
        priority: adminTaskPriority,
        dueDate: adminTaskDueDate || undefined,
        status: "TODO"
      });

      // Clear form
      setAdminTaskName('');
      setAdminTaskDesc('');
      setAdminTaskAssignee('');
      setAdminTaskDueDate('');
      setAdminSuccessMsg('Task successfully assigned & notification sent to the teammate\'s inbox!');
      setTimeout(() => setAdminSuccessMsg(''), 5000);
    } catch (err: any) {
      setAdminErrorMsg(err.message || 'Failed to assign task');
    } finally {
      setIsAdminCreating(false);
    }
  };

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-medium font-sans">Compiling workspace telemetry stats...</p>
        </div>
      </div>
    );
  }

  // First-time user empty state welcome splash
  if (metrics.totalTasks === 0) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-12 text-center h-full min-h-screen font-sans">
        <div className="max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-md">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <span className="text-3xl font-extrabold font-mono text-indigo-700">W</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome to wavework.ai</h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            We are excited to have you on board! As a first-time user, your workspace starts as a clean, blank slate.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col space-y-3">
            <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2 font-mono">Suggested next steps:</span>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>Use the <strong>Notes Sidebar</strong> in Core Views to write documents or make scratch lists.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>Use <strong>Interactive Paint</strong> to visually sketch ideas or write diagrams.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>Click standard <strong>Direct Messages</strong> to invite and chat with other teammates dynamically.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active or overdue tasks helper
  const overdueTasksList = tasks.filter(task => {
    if (task.dueDate && task.status !== "DONE" && task.status !== "CANCELLED") {
      const due = new Date(task.dueDate);
      const now = new Date();
      return due < now;
    }
    return false;
  });

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto h-full p-8 font-sans">

      {/* Upper Dashboard Header Banner */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspace Metrics Core</h1>
          <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">SSE TELEMETRY STREAM ACTIVE | STABLE CONFLICT-FREE SNAPSHOTS</p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-full">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <span>Real-time Sync Enabled</span>
        </div>
      </div>

      {/* Grid Counters Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">

        {/* Total Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">total tasks</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.totalTasks}</span>
          </div>
        </div>

        {/* To Do Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-slate-50 text-slate-650 flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">to do</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.todoTasks || 0}</span>
          </div>
        </div>

        {/* In Progress Backlog */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">in progress</span>
            <span className="text-2xl font-bold text-slate-900">
              {metrics.inProgressTasks || 0}
            </span>
          </div>
        </div>

        {/* In Review */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-650 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">in review</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.inReviewTasks || 0}</span>
          </div>
        </div>

        {/* Completed This Week */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">completed</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.completedTasks || 0}</span>
          </div>
        </div>

        {/* Overall Completion Percentage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-violet-50 text-violet-650 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">progress</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.overallCompletionPercentage || 0}%</span>
          </div>
        </div>

      </div>

      {/* Admin Quick Assignment Center */}
      {(activeUser?.role === 'ADMIN' || activeUser?.role === 'OWNER') && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">

          {/* Card 1: New Task Placement & Automation */}
          <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-md shadow-indigo-100/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Layers className="w-5 h-5 shadow-inner" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Admin Assignment Console</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold mt-0.5">Quickly assign & trigger direct mailbox alerts</p>
              </div>
            </div>

            {adminSuccessMsg && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
                ✓ {adminSuccessMsg}
              </div>
            )}

            {adminErrorMsg && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
                ✗ {adminErrorMsg}
              </div>
            )}

            <form onSubmit={handleAdminAssignTask} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design responsive signup UI"
                  value={adminTaskName}
                  onChange={(e) => setAdminTaskName(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Target Space & List *</label>
                  <select
                    required
                    value={adminTaskListId}
                    onChange={(e) => setAdminTaskListId(e.target.value)}
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

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Delegate Assignee</label>
                  <select
                    value={adminTaskAssignee}
                    onChange={(e) => setAdminTaskAssignee(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none font-sans"
                  >
                    <option value="">-- Choose Member --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Priority</label>
                  <select
                    value={adminTaskPriority}
                    onChange={(e) => setAdminTaskPriority(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="NONE">None</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={adminTaskDueDate}
                    onChange={(e) => setAdminTaskDueDate(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Contextual Description</label>
                <textarea
                  placeholder="Task scope details..."
                  rows={2}
                  value={adminTaskDesc}
                  onChange={(e) => setAdminTaskDesc(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 p-2.5 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isAdminCreating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-2.5 rounded-lg transition shadow-md shadow-indigo-600/10 cursor-pointer text-center"
              >
                {isAdminCreating ? 'Allocating task thread...' : 'Assign & Release Task Alert'}
              </button>
            </form>
          </div>

          {/* Card 2: Quick Delegate for Unassigned Tasks */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <User className="w-5 h-5 shadow-inner" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Pending Delegation Backlog</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold mt-0.5">Quick-delegate unassigned workspace tasks</p>
                  </div>
                </div>
                <span className="bg-amber-100/60 border border-amber-200 text-amber-800 font-bold text-[9px] uppercase px-2 py-0.5 rounded">
                  {tasks.filter(t => !t.assigneeId).length} Left
                </span>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {tasks.filter(t => !t.assigneeId).slice(0, 10).map(task => (
                  <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs transition hover:border-slate-300">
                    <div className="min-w-0 flex-1 mr-4">
                      <span className="text-slate-900 font-bold block truncate">{task.name}</span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        List: {lists.find(l => l.id === task.listId)?.name || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex-shrink-0">
                      <select
                        onChange={async (e) => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          await updateTask(task.id, { assigneeId: targetId });
                          alert('Task successfully assigned to colleague!');
                        }}
                        className="text-[11px] font-bold rounded-md bg-white border border-slate-200 p-1.5 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Quick Delegate To...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {tasks.filter(t => !t.assigneeId).length === 0 && (
                  <p className="text-center font-semibold text-xs text-emerald-600 py-8 italic">
                    Excellent! All active tickets currently have team delegates.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-mono leading-relaxed">
              * Assigning delegates triggers an interactive real-time SSE stream sync, which sends notification alerts directly to the assignee's personal inbox mail module.
            </div>
          </div>

        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Progress Metrics by Space (Left Column - Spans 2) */}
        <div className="lg:col-span-2 space-y-8">

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-1.5">
              <span>Space Completion Rates</span>
            </h3>

            <div className="space-y-5">
              {spaces.map(space => {
                const progress = metrics.spaceProgress?.[space.id] || 0;
                return (
                  <div key={space.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: space.color }} />
                        <span className="text-slate-900 font-medium">{space.name} Space</span>
                      </div>
                      <span>{progress}% Finished</span>
                    </div>
                    {/* Visual Meter Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, backgroundColor: space.color }}
                      />
                    </div>
                  </div>
                );
              })}
              {spaces.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No active spaces created yet. Create spaces in side drawer.</p>
              )}
            </div>
          </div>

          {/* Overdue Task Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <span>Critical Backlog Overdue Rows</span>
              </h3>
              <span className="bg-rose-50 text-rose-600 font-semibold text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-rose-100">
                Action Required
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {overdueTasksList.map((task) => {
                const assignee = users.find(u => u.id === task.assigneeId);
                return (
                  <div key={task.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <span className="text-xs text-rose-600 font-bold uppercase tracking-wider block text-[10px]">Overdue</span>
                      <span className="text-sm font-semibold text-slate-900 block mt-0.5">{task.name}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {task.dueDate}
                        </span>
                      </div>
                    </div>
                    {assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-6 h-6 rounded-full text-[10.5px] font-bold ${assignee.color} flex items-center justify-center`}>
                          {assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-700 font-medium hidden sm:inline">{assignee.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">Unassigned</span>
                    )}
                  </div>
                );
              })}
              {overdueTasksList.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  🌿 Clean Slate! No tasks are currently overdue. Keep it up!
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="space-y-6">
          {(activeUser?.role === 'ADMIN' || activeUser?.role === 'OWNER') && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
                Team Member Workloads
              </h3>

              <p className="text-slate-550 text-xs mb-5">
                Tracks active tickets (todo/in-progress) currently allocated to members.
              </p>

              <div className="space-y-4">
                {users.map(user => {
                  const count = metrics.memberWorkload?.[user.id] || 0;
                  const maxTicketsCount = Math.max(...(Object.values(metrics.memberWorkload || {}) as number[]), 1);
                  const percent = Math.round((count / maxTicketsCount) * 100);

                  return (
                    <div key={user.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-md ${user.color} flex items-center justify-center font-bold text-xs shadow-inner flex-shrink-0`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate flex-1">
                          <span className="text-xs font-semibold text-slate-800 block truncate">{user.name}</span>
                          {/* Custom workload bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full block border border-slate-200">
                          {count} tasks
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick-links Quickstart instructions */}
          <div className="bg-slate-900 text-slate-300 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Workspace Quickstart</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Welcome to the wavework.ai Workspace. You can access creative boards, paint canvases, share notes, and interact with teammates in real-time.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Simulate other profiles in footer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Create Spaces & Lists directly</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Publish Forms to capture public requests</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
