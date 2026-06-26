import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    // Attempt to clear local caches that may have caused the crash
    try {
      sessionStorage.removeItem('activeUserId');
      localStorage.removeItem('activeUserId');
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-6 font-sans select-none text-slate-100">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-rose-500/20 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <h1 className="text-xl font-extrabold text-white tracking-tight">Something Went Wrong</h1>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                An unexpected interface rendering crash occurred in the application view container. The workspace session was isolated to prevent data loss.
              </p>

              {this.state.error && (
                <div className="mt-6 w-full text-left bg-slate-950/80 rounded-xl p-4 border border-slate-800 max-h-40 overflow-y-auto font-mono text-[11px] text-slate-400 leading-normal scrollbar-thin">
                  <span className="text-rose-400 font-bold block mb-1">Error Details:</span>
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <span className="block mt-2 opacity-50 whitespace-pre-wrap">
                      {this.state.error.stack.split('\n').slice(1, 4).join('\n')}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={this.handleReset}
                className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/35 flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 animate-spin-reverse" />
                <span>Restore Clean Session</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
