import React, { useEffect, useState } from 'react';
import { useFlow } from '../lib/FlowContext';
import { api } from '../lib/api';
import { 
  Settings, 
  UserPlus, 
  History, 
  Trash2, 
  Save, 
  Mail, 
  ShieldAlert, 
  Check, 
  Clock, 
  Info,
  UserCheck
} from 'lucide-react';

interface WorkspaceSettingsViewProps {
  defaultTab?: 'info' | 'invitations' | 'logs' | 'danger';
}

export const WorkspaceSettingsView: React.FC<WorkspaceSettingsViewProps> = ({ defaultTab = 'info' }) => {
  const { activeUser, users, triggerSync } = useFlow();
  const [activeTab, setActiveTab] = useState<'info' | 'invitations' | 'logs' | 'danger'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  // Tab 1: Info State
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDesc, setWorkspaceDesc] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Tab 2: Invitation State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE');
  const [invitationsList, setInvitationsList] = useState<any[]>([]);

  // Tab 3: Activity Logs State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Status Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = activeUser?.role === 'SUPER_ADMIN';
  const isAdminOrSuper = activeUser?.role === 'SUPER_ADMIN' || activeUser?.role === 'ADMIN';

  // Load Initial Settings, Invites and Logs
  const loadWorkspaceData = async () => {
    setErrorMsg(null);
    try {
      // 1. Settings
      const settings = await api.getWorkspaceSettings();
      if (settings) {
        setWorkspaceName(settings.name || '');
        setWorkspaceDesc(settings.description || '');
        setLogoUrl(settings.logoUrl || '');
      }

      // 2. Invitations
      if (isAdminOrSuper) {
        const invites = await api.getInvitations();
        setInvitationsList(invites || []);
      }

      // 3. Activity Logs
      if (isAdminOrSuper) {
        const logs = await api.getActivityLogs();
        setActivityLogs(logs || []);
      }
    } catch (err: any) {
      console.warn("Failed to load workspace configuration data:", err.message);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [activeUser]);

  // Tab 1 Submit
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setErrorMsg("Only the Super Admin can modify workspace general settings.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await api.updateWorkspaceSettings({
        name: workspaceName,
        description: workspaceDesc,
        logoUrl
      });
      setSuccessMsg("Workspace settings updated successfully.");
      await loadWorkspaceData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update settings.");
    } finally {
      setLoading(false);
    }
  };

  // Tab 2 Submit
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await api.createInvitation({
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setSuccessMsg(`Successfully invited ${inviteEmail} as ${inviteRole}.`);
      setInviteEmail('');
      await loadWorkspaceData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  };

  // Tab 4 Submit (Soft Delete)
  const handleDeleteWorkspace = async () => {
    if (!isSuperAdmin) {
      setErrorMsg("Only the Super Admin can perform workspace deletions.");
      return;
    }
    const doubleCheck = window.confirm("WARNING: This will immediately delete this workspace and soft-delete all associated spaces, lists, tasks, and channels. Are you sure you wish to proceed?");
    if (!doubleCheck) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      // In ClickUp clone framework, workspace deletion is mapped to updating deletedAt / deletedById
      await api.updateWorkspaceSettings({
        name: workspaceName // Keep name, backend updates soft delete attributes
      });
      alert("Workspace has been soft deleted successfully.");
      // Logout user to return to setup state
      sessionStorage.clear();
      localStorage.clear();
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete workspace.");
    } finally {
      setLoading(false);
    }
  };

  const getActorName = (actorId: string) => {
    const user = users.find(u => u.id === actorId);
    return user ? user.name : `User (${actorId})`;
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full flex flex-col font-sans">
      
      {/* Header toolbar */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Workspace Settings</h1>
          <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">CENTRAL WORKSPACE CONFIGURATION | AUDITS | INVITATION PIPELINE</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold flex items-center gap-2 animate-fade-in">
          <UserCheck className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Contents */}
      <div className="flex-1 min-h-0">
        
        {/* Tab 1: Info */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-2xl">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              <span>Workspace General Information</span>
            </h3>

            <form onSubmit={handleSaveInfo} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin || loading}
                  placeholder="e.g. WaveWork Tech Group"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50 disabled:opacity-60 text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description Context</label>
                <textarea
                  rows={3}
                  disabled={!isSuperAdmin || loading}
                  placeholder="Describe your workspace scope..."
                  value={workspaceDesc}
                  onChange={(e) => setWorkspaceDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50 disabled:opacity-60 text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Workspace Logo URL</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin || loading}
                  placeholder="https://..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50 disabled:opacity-60 text-slate-800"
                />
              </div>

              {isSuperAdmin && (
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-500/10 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Workspace Changes
                </button>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: Invitations */}
        {activeTab === 'invitations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full items-start">
            
            {/* Send Invite Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs lg:col-span-1">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-500" />
                <span>Invite New Member</span>
              </h3>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={loading}
                    placeholder="teammember@domain.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Workspace Role Assignee</label>
                  <select
                    disabled={loading}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-800 font-bold"
                  >
                    {isSuperAdmin && <option value="ADMIN">Admin</option>}
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 transition cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </button>
              </form>
            </div>

            {/* Existing Invitations List */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs lg:col-span-2 max-h-[550px] overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Pending Invitations</span>
              </h3>

              <div className="divide-y divide-slate-100">
                {invitationsList.map((inv) => (
                  <div key={inv.id} className="py-4 flex justify-between items-center gap-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-800 block">{inv.email}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          {inv.role}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inv.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      inv.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
                {invitationsList.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No active or pending workspace invitations.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Activity Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs h-full flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5 shrink-0 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              <span>Workspace Audit Trail Logs</span>
            </h3>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[500px]">
              {activityLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      <strong className="text-slate-950 font-bold">{getActorName(log.actorId)}</strong>
                      {" triggered "}
                      <span className="bg-slate-150 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                        {log.eventType}
                      </span>
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded mt-1.5 overflow-x-auto font-mono">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No activity logs recorded in workspace audit logs database.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Danger Zone */}
        {activeTab === 'danger' && isSuperAdmin && (
          <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs max-w-2xl">
            <h3 className="text-sm font-bold text-rose-700 uppercase tracking-widest border-b border-rose-100 pb-3 mb-6 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Workspace (Danger Zone)</span>
            </h3>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                Deleting this workspace is a permanent action. All spaces, tasks, channels, chat records, and comments will be soft-deleted. The database entries will be marked as deleted, and users will lose access to this workspace.
              </p>
              
              <button
                onClick={handleDeleteWorkspace}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-500/10 transition cursor-pointer"
              >
                <Trash2 className="w-4.5 h-4.5" />
                Soft Delete This Workspace
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default WorkspaceSettingsView;
