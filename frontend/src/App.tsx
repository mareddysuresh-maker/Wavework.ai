import React, { useEffect, useState } from 'react';
import { FlowProvider, useFlow } from './lib/FlowContext';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { DashboardView } from './components/DashboardView';
import { TaskBoardView } from './components/TaskBoardView';
import { PlannerView } from './components/PlannerView';
import { ChatEngineView } from './components/ChatEngineView';
import { UnifiedInboxView } from './components/UnifiedInboxView';
import { FormsBuilderHub } from './components/FormsBuilderHub';
import { PublicFormPage } from './components/PublicFormPage';
import { NotesView } from './components/NotesView';
import { WhiteboardView } from './components/WhiteboardView';
import { PomodoroTimerWidget } from './components/PomodoroTimerWidget';
import { SplashAuth } from './components/SplashAuth';
import { Sparkles, MessageSquare, AlertCircle } from 'lucide-react';

const PrimaryWorkspaceRouter: React.FC = () => {
  const { currentView, switchUser, users, isLoading, activeUser } = useFlow();
  const [publicFormSlug, setPublicFormSlug] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('isLoggedIn') === 'true' || localStorage.getItem('isLoggedIn') === 'true');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // Check URL parameters for simulation identity hook or public portals routing
    const params = new URLSearchParams(window.location.search);
    
    // 1. Check if public guest portal matching form slugs
    const slug = params.get('publicFormSlug');
    if (slug) {
      setPublicFormSlug(slug);
    }

    // 2. Check if identity simulation override exists
    const simulateEmail = params.get('simulateUserId');
    if (simulateEmail) {
      const match = users.find(u => u.email.toLowerCase() === simulateEmail.toLowerCase() || u.id === simulateEmail);
      if (match) {
        switchUser(match.id);
        sessionStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        setIsLoggedIn(true);
      }
    }
  }, [users, switchUser]);

  // If public guest form is active, we render standalone intake page
  if (publicFormSlug) {
    return (
      <div className="w-screen h-screen bg-slate-950">
        <PublicFormPage 
          slug={publicFormSlug} 
          onClose={() => {
            // Remove parameter from address bar and load main application
            const url = new URL(window.location.href);
            url.searchParams.delete('publicFormSlug');
            window.history.pushState({}, '', url.toString());
            setPublicFormSlug(null);
          }} 
        />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <SplashAuth onSuccess={() => setIsLoggedIn(true)} />;
  }

  if (isLoading) {
    return (
      <div id="loading-spinner" className="flex h-screen w-screen items-center justify-center bg-slate-950 text-indigo-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
          <span className="text-xs text-indigo-100 font-semibold tracking-wide uppercase">Initializing Workspace Core...</span>
        </div>
      </div>
    );
  }

  // Renders primary workspace screen
  const renderMainWorkspaceContent = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return <DashboardView />;
      case 'BOARD':
        return <TaskBoardView />;
      case 'PLANNER':
        return <PlannerView />;
      case 'CHAT':
        return <ChatEngineView />;
      case 'INBOX':
        return <UnifiedInboxView />;
      case 'FORMS':
        return <FormsBuilderHub />;
      case 'NOTES':
        return <NotesView />;
      case 'WHITEBOARD':
        return <WhiteboardView />;
      default:
        return <DashboardView />;
    }
  };


  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-100 overflow-hidden font-sans relative">
      {/* Mobile Top Header */}
      <header className="flex items-center justify-between bg-slate-900 text-white px-4 py-3 md:hidden border-b border-slate-800 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1 hover:bg-slate-800 rounded-md focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold tracking-tight">WaveWork.ai</span>
        </div>
        {activeUser && (
          <div className={`w-7 h-7 rounded-full ${activeUser.color} flex items-center justify-center font-bold text-xs`}>
            {activeUser.name.charAt(0).toUpperCase()}
          </div>
        )}
      </header>

      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Side bar */}
      <WorkspaceSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      {/* Primary Workspace View container */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {renderMainWorkspaceContent()}
      </main>

      {/* Floating Pomodoro timer */}
      <PomodoroTimerWidget />
    </div>
  );
};

export default function App() {
  return (
    <FlowProvider>
      <PrimaryWorkspaceRouter />
    </FlowProvider>
  );
}
