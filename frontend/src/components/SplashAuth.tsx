import React, { useState, useEffect } from 'react';
import { useFlow } from '../lib/FlowContext';
import { api } from '../lib/api';
import { Sparkles, Mail, Lock, User as UserIcon, CheckCircle2, AlertTriangle, ArrowRight, Building } from 'lucide-react';

interface SplashAuthProps {
  onSuccess: () => void;
}

export const SplashAuth: React.FC<SplashAuthProps> = ({ onSuccess }) => {
  const { triggerSync } = useFlow();
  const [workspaceExists, setWorkspaceExists] = useState<boolean | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const [tempAuth, setTempAuth] = useState<{ user: any; token: string } | null>(null);
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any | null>(null);

  const [isForgot, setIsForgot] = useState(false);
  const [isVerifyOtp, setIsVerifyOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpForDev, setOtpForDev] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  // Pull dynamic workspace status and users on load
  useEffect(() => {
    const init = async () => {
      try {
        api.getPublicUsers()
          .then(setDemoUsers)
          .catch((err) => console.log("Splash could not resolve public user list:", err.message));

        const existsRes = await api.checkWorkspaceExists();
        setWorkspaceExists(existsRes.workspaceExists);

        const params = new URLSearchParams(window.location.search);
        const urlInviteId = params.get('inviteId');
        if (urlInviteId) {
          setInviteId(urlInviteId);
          setLoading(true);
          try {
            const invite = await api.getInvitationById(urlInviteId);
            setInvitation(invite);
            setEmail(invite.email);
          } catch (err: any) {
            setError(err.message || "Invalid or expired invitation link.");
          } finally {
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error("Initialization failed:", err);
      }
    };
    init();
  }, []);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (!tempAuth) return;
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await api.switchWorkspace(workspaceId);
      if (data.success) {
        sessionStorage.setItem('activeUserId', data.user.id);
        localStorage.setItem('activeUserId', data.user.id);
        sessionStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        if (data.token) {
          sessionStorage.setItem('socketToken', data.token);
        }
        setSuccessMsg(`Connected! Entering workspace...`);
        setTimeout(async () => {
          await triggerSync();
          onSuccess();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to select workspace.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (workspaceExists === false) {
        // Setup First Workspace Flow
        if (!workspaceNameInput.trim() || !name.trim() || !email.trim() || !password.trim()) {
          throw new Error('Please fill out all fields.');
        }
        const data = await api.setupFirstWorkspace({
          workspaceName: workspaceNameInput.trim(),
          name: name.trim(),
          email: email.trim(),
          password
        });
        if (data.success) {
          sessionStorage.setItem('activeUserId', data.user.id);
          localStorage.setItem('activeUserId', data.user.id);
          sessionStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('isLoggedIn', 'true');
          if (data.token) {
            sessionStorage.setItem('socketToken', data.token);
          }
          setSuccessMsg(`Workspace created! Welcome, ${data.user.name}!`);
          setTimeout(async () => {
            await triggerSync();
            onSuccess();
          }, 1500);
        }
      } else if (inviteId) {
        // Flow B: Accept Invitation
        if (!name.trim() || !password.trim()) {
          throw new Error('Please fill out all required fields.');
        }
        const data = await api.acceptInvitation(inviteId, {
          name: name.trim(),
          password,
        });
        
        if (data.success) {
          sessionStorage.setItem('activeUserId', data.user.id);
          localStorage.setItem('activeUserId', data.user.id);
          sessionStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('isLoggedIn', 'true');
          if (data.token) {
            sessionStorage.setItem('socketToken', data.token);
          }
          setSuccessMsg(`Welcome, ${data.user.name}! Your account has been setup.`);
          setTimeout(async () => {
            await triggerSync();
            // Clean invitation params out of URL
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('inviteId');
            window.history.pushState({}, '', cleanUrl.toString());
            onSuccess();
          }, 1500);
        }
      } else {
        // Flow C: Login
        if (!email.trim() || !password.trim()) {
          throw new Error('Please fill out both your email and password.');
        }
        const data = await api.login({
          email: email.trim(),
          password,
        });

        if (data.success) {
          if (data.workspaces && data.workspaces.length > 1) {
            setWorkspaces(data.workspaces);
            setTempAuth({ user: data.user, token: data.token });
            setShowSelection(true);
          } else {
            sessionStorage.setItem('activeUserId', data.user.id);
            localStorage.setItem('activeUserId', data.user.id);
            sessionStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('isLoggedIn', 'true');
            if (data.token) {
              sessionStorage.setItem('socketToken', data.token);
            }
            setSuccessMsg(`Welcome back, ${data.user.name}! Connecting workspace...`);
            setTimeout(async () => {
              await triggerSync();
              onSuccess();
            }, 1200);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setOtpForDev(null);
    if (!email.trim()) {
      setError("Please provide your email address to receive an OTP.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email: email.trim() });
      if (res.success) {
        setSuccessMsg(res.message);
        if (res.otpForDev) {
          setOtpForDev(res.otpForDev);
        }
        setIsVerifyOtp(true);
        setIsForgot(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch recovery passcode. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!otpCode.trim() || !newPassword.trim()) {
      setError("Please enter the 6-digit OTP code and choose a new secure password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyResetPassword({
        email: email.trim(),
        otp: otpCode.trim(),
        newPassword: newPassword.trim()
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setOtpCode('');
        setNewPassword('');
        setOtpForDev(null);
        setTimeout(() => {
          setIsVerifyOtp(false);
          setIsForgot(false);
          setSuccessMsg(null);
          setError(null);
        }, 2000);
      }
    } catch (err: any) {
      setError(err?.message || "Incorrect OTP code. Please verify.");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoUser = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(null);
  };

  return (
    <div id="splash-auth-container" className="flex min-h-screen w-screen items-center justify-center bg-slate-900 overflow-y-auto px-4 py-12 relative font-sans">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
        {/* Left column: App Pitch branding (Splash Screen) */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-900 via-slate-950 to-slate-900 p-8 flex flex-col justify-between text-white border-r border-slate-800/50">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">FlowUp Hub</span>
            </div>
            
            <div className="mt-12 space-y-6">
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
                Collaborative <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Instant Productivity</span>
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Connect teams with low latency 1-on-1 and channel discussions, dynamic whiteboard sketching, Pomodoro timers, and interactive task assignment pipelines.
              </p>
            </div>
          </div>

          {workspaceExists && demoUsers.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-800/40">
              <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Workspace Profiles</div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <button 
                  type="button"
                  onClick={() => selectDemoUser('client@flowup.io')}
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/60 transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px]">
                      C
                    </div>
                    <div>
                      <span className="font-bold text-white group-hover:text-white transition">Client Demo</span>
                      <p className="text-[10px] text-indigo-200">client@flowup.io</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 bg-indigo-800 text-indigo-100">
                    SUPER_ADMIN
                  </span>
                </button>
                {demoUsers.filter(u => u.email !== 'client@flowup.io').map((u) => (
                  <button 
                    key={u.id}
                    onClick={() => selectDemoUser(u.email)}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs bg-slate-900/60 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full ${u.color || 'bg-slate-700 text-white'} flex items-center justify-center font-black text-[10px]`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-300 group-hover:text-white transition">{u.name}</span>
                        <p className="text-[10px] text-slate-400">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                      u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'OWNER' ? 'bg-indigo-950/80 text-indigo-300' : 'bg-emerald-950/80 text-emerald-300'
                    }`}>
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 text-center mt-3">Demo account password: <code className="text-slate-400 bg-slate-900/80 px-1 rounded">password123</code></div>
            </div>
          )}
        </div>

        {/* Right column: Auth inputs Form card */}
        <div className="md:col-span-7 bg-slate-950 p-8 md:p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Header */}
            <div className="flex justify-between items-baseline mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {showSelection
                    ? 'Select Workspace'
                    : isForgot 
                      ? 'Reset Password Request' 
                      : isVerifyOtp 
                        ? 'Verify Passage OTP' 
                        : inviteId
                          ? 'Accept Workspace Invitation'
                          : workspaceExists === false
                            ? 'Setup Workspace'
                            : 'Sign in to Workspace'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {showSelection
                    ? 'Choose which project environment you would like to enter.'
                    : isForgot 
                      ? 'Receive a secure passcode in your inbox.' 
                      : isVerifyOtp 
                        ? 'Enter the OTP passcode and set your new password.' 
                        : inviteId
                          ? `Set up your profile to join the workspace.`
                          : workspaceExists === false
                            ? 'Configure your first workspace and administrator account.'
                            : 'Please enter your workspace credentials below.'}
                </p>
              </div>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed animate-shake">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error:</span> {error}
                </div>
              </div>
            )}

            {/* Success alerts */}
            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl flex items-start gap-2.5 text-emerald-300 text-xs leading-relaxed">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Success!</span> {successMsg}
                  {otpForDev && (
                    <div className="mt-2 p-2 bg-indigo-950 border border-indigo-700 rounded text-[11px] font-mono text-indigo-200 select-all">
                      ⚡ DEVELOPMENT OTP BYPASS: <b className="text-white text-lg ml-1 font-bold">{otpForDev}</b> <br />
                      Copy and enter the block below to update your password immediately.
                    </div>
                  )}
                </div>
              </div>
            )}

            {showSelection ? (
              /* Workspace Selection View */
              <div className="space-y-5">
                <div className="space-y-3">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleSelectWorkspace(w.id)}
                      className="w-full flex items-center justify-between p-4 rounded-xl text-left bg-slate-900 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                          {w.logoUrl ? (
                            <img src={w.logoUrl} alt={w.name} className="h-6 w-6 object-contain rounded" />
                          ) : (
                            <Building className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-slate-200">{w.name}</span>
                          <div className="text-xs text-slate-500 font-mono">ID: {w.id}</div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded bg-indigo-950 text-indigo-300 font-bold uppercase">
                        {w.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : isForgot ? (
              /* Request OTP Form */
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Your Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      value={email}
                      required
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(false);
                      setIsVerifyOtp(false);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Cancel, back to sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVerifyOtp(true);
                      setIsForgot(false);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Already have an OTP?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-5 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send Recovery OTP</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : isVerifyOtp ? (
              /* Verify OTP & Change Password Form */
              <form onSubmit={handleVerifyOtpReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    <input 
                      type="email" 
                      value={email}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-900 bg-slate-950/50 text-sm text-slate-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 font-semibold text-indigo-400">6-Digit OTP Code</label>
                  <div className="relative">
                    <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                    <input 
                      type="text" 
                      placeholder="e.g. 123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-indigo-500 bg-slate-900 text-sm text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Create New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="password" 
                      placeholder="Choose a new secure password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="pt-2 text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVerifyOtp(false);
                      setIsForgot(true);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Request a new passcode
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-5 rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Apply Password Reset</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : workspaceExists === false ? (
              /* Setup Workspace (First Time) Form */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Workspace Name</label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="e.g. Acme Corp"
                      value={workspaceNameInput}
                      onChange={(e) => setWorkspaceNameInput(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="email" 
                      placeholder="e.g. jane@acme.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Secure Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-5 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Initialize Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Accept Invitation OR Login Forms */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Flow B: Accept Invitation fields */}
                {inviteId && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                        <input 
                          type="email" 
                          value={email}
                          disabled
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-900 bg-slate-950/50 text-sm text-slate-500 cursor-not-allowed focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Your Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Jane Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Secure Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Flow C: Login fields */}
                {!inviteId && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="email" 
                          placeholder="user@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <label className="text-xs font-medium text-slate-300">Secure Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgot(true);
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-5 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {inviteId ? 'Accept Invitation' : 'Sign In'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
