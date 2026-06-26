import React, { useState } from 'react';
import { useFlow } from '../lib/FlowContext';
import { api } from '../lib/api';
import { 
  Users, 
  UserCheck, 
  ShieldAlert, 
  Trash2, 
  UserX, 
  ChevronDown,
  UserPlus,
  Mail,
  Clock
} from 'lucide-react';

export const MemberDirectoryView: React.FC = () => {
  const { users, activeUser, triggerSync } = useFlow();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const isSuperAdmin = activeUser?.role === 'SUPER_ADMIN';

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionInProgress(userId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (newRole === 'SUPER_ADMIN') {
        await api.promoteUser(userId);
        setSuccessMsg("User promoted to Super Admin successfully.");
      } else {
        await api.updateUserRole(userId, newRole);
        setSuccessMsg(`User role updated to ${newRole} successfully.`);
      }
      await triggerSync();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update user role.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this user from the workspace?")) {
      return;
    }
    setActionInProgress(userId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.deleteUser(userId);
      setSuccessMsg("User removed from workspace successfully.");
      await triggerSync();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove user.");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full flex flex-col font-sans">
      
      {/* Header toolbar */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Member Directory</h1>
          <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">MANAGE TEAM ROLES | ACCESS CONTROLS | PERMISSION DIRECTORY</p>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Workspace Members ({users.length})</span>
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((member) => {
            const isSelf = member.id === activeUser?.id;
            const isTargetSuper = member.role === 'SUPER_ADMIN';

            return (
              <div 
                key={member.id} 
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition"
              >
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${member.color || 'bg-slate-500 text-white'} flex items-center justify-center font-bold text-base shadow-xs`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{member.name}</span>
                      {isSelf && (
                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">You</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {member.email}
                    </span>
                  </div>
                </div>

                {/* Role Controls */}
                <div className="flex items-center gap-3 sm:self-center">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Workspace Role</span>
                    
                    {isSuperAdmin && !isSelf ? (
                      <div className="relative">
                        <select
                          disabled={actionInProgress === member.id}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg py-1.5 pl-3 pr-8 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs hover:bg-slate-50 transition"
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="ADMIN">Admin</option>
                          <option value="EMPLOYEE">Employee</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        member.role === 'SUPER_ADMIN' ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' :
                        member.role === 'ADMIN' ? 'bg-amber-50 text-amber-700 border border-amber-150' :
                        'bg-slate-100 text-slate-600 border border-slate-150'
                      }`}>
                        {member.role === 'SUPER_ADMIN' ? 'Super Admin' :
                         member.role === 'ADMIN' ? 'Admin' : 'Employee'}
                      </span>
                    )}
                  </div>

                  {isSuperAdmin && !isSelf && (
                    <button
                      disabled={actionInProgress === member.id}
                      onClick={() => handleRemoveUser(member.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition flex-shrink-0 mt-4 sm:mt-0"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default MemberDirectoryView;
