import React, { useState } from 'react';
import { useFlow } from '../lib/FlowContext';
import { 
  Inbox, 
  Check, 
  CheckSquare, 
  Bell, 
  Clock, 
  MessageSquare, 
  Plus, 
  Star,
  Bookmark,
  Calendar
} from 'lucide-react';

export const UnifiedInboxView: React.FC = () => {
  const { 
    inbox, 
    markInboxRead, 
    markInboxAllRead, 
    toggleInboxSaveLater, 
    addPersonalReminder 
  } = useFlow();

  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderBody, setReminderBody] = useState('');
  const [showReminderForm, setShowReminderForm] = useState(false);

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim()) return;

    await addPersonalReminder(reminderTitle, reminderBody);
    setReminderTitle('');
    setReminderBody('');
    setShowReminderForm(false);
  };

  const savedInboxItems = inbox.filter(n => n.isSaved);
  const unreadAlerts = inbox.filter(n => !n.isRead);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full flex flex-col font-sans">
      
      {/* Header toolbar */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unified Inbox</h1>
          <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">ALERTS LOGS | PINNED CHATS REVIEW | TEAM TRIGGERS SUMMARY</p>
        </div>

        <div className="flex items-center space-x-2">
          {unreadAlerts.length > 0 && (
            <button
              onClick={() => markInboxAllRead()}
              className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            >
              <Check className="w-4 h-4 text-slate-500" />
              Mark All as Read
            </button>
          )}

          <button
            onClick={() => setShowReminderForm(!showReminderForm)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-indigo-505/10"
          >
            <Plus className="w-4 h-4" />
            Quick Reminder
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-start">
        
        {/* Core Notifications Logs Area (Spans 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <span>Workspace Notification Logs ({unreadAlerts.length} Unread)</span>
            </h3>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
              {[...inbox].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item) => (
                <div 
                  key={item.id} 
                  className={`py-4 flex gap-4 items-start transition first:pt-0 last:pb-0 ${item.isRead ? 'opacity-65' : ''}`}
                >
                  {/* Alert Icon selection */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    item.type === 'ASSIGNMENT' ? 'bg-amber-50 text-amber-600' :
                    item.type === 'MENTIONS' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'
                  }`}>
                    <Inbox className="w-5 h-5" />
                  </div>

                  {/* Body description */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5">{item.title}</span>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold mt-1">{item.body}</p>
                  </div>

                  {/* Complete actions triggers */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {!item.isRead && (
                      <button
                        onClick={() => markInboxRead(item.id)}
                        className="p-1 px-2.5 text-xs text-slate-500 hover:text-indigo-600 bg-slate-50 border border-slate-200/60 rounded-md cursor-pointer hover:bg-slate-100 transition"
                        title="Dismiss alert"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => toggleInboxSaveLater(item.id)}
                      className={`p-1.5 rounded-full cursor-pointer transition ${
                        item.isSaved ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-500'
                      }`}
                      title={item.isSaved ? "Saved" : "Pin and save for later"}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                </div>
              ))}

              {inbox.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-sans text-xs flex flex-col items-center justify-center">
                  <Inbox className="w-12 h-12 text-slate-200 mb-2" />
                  <span>Your inbox alerts log is completely clean. Perfect!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Saved list & Reminder cards (Spans 1) */}
        <div className="space-y-6">
          
          {/* Custom Reminder inline fields form */}
          {showReminderForm && (
            <form onSubmit={handleReminderSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-lg animate-fade-in text-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Set checklist alarm</span>
                <button 
                  type="button" 
                  onClick={() => setShowReminderForm(false)} 
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">Reminder Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call Karthik regarding SSE tests"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">Details Context</label>
                <input
                  type="text"
                  placeholder="e.g. Ensure thread logger logs handle checks"
                  value={reminderBody}
                  onChange={(e) => setReminderBody(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded transition cursor-pointer"
              >
                Schedule reminder alert
              </button>
            </form>
          )}

          {/* Saved elements widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-300">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
              <Bookmark className="w-3.5 h-3.5 fill-current" />
              <span>Saved Review Pins ({savedInboxItems.length})</span>
            </h3>

            <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
              {savedInboxItems.map(s => (
                <div key={s.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs leading-relaxed space-y-1">
                  <div className="flex items-center justify-between font-bold text-[9px] text-slate-500">
                    <span className="uppercase">Pinned Alert</span>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300 font-medium">{s.title}</p>
                  <p className="text-slate-400 text-[11px] leading-normal">{s.body}</p>
                </div>
              ))}
              {savedInboxItems.length === 0 && (
                <p className="text-center text-[11px] text-slate-500 py-4 italic">
                  Press the star icon beside chat bubbles or notifications to pin items here!
                </p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
export default UnifiedInboxView;
