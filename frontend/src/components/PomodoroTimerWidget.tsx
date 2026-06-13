import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../lib/FlowContext';
import { 
  Timer, Play, Pause, RotateCcw, Settings, CheckCircle, 
  Flame, Coffee, ChevronRight, ChevronDown, Check, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PomodoroTimerWidget: React.FC = () => {
  const { 
    tasks, 
    pomodoroSettings, 
    pomodoroSessions, 
    updatePomodoroSettings, 
    createPomodoroSession 
  } = useFlow();

  // Timer internal states
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'WORK' | 'SHORT' | 'LONG'>('WORK');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  
  // Custom durations configured by users (synced with state)
  const [workMin, setWorkMin] = useState(25);
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(15);
  const [completedCycles, setCompletedCycles] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync settings when fetched from database
  useEffect(() => {
    if (pomodoroSettings) {
      setWorkMin(pomodoroSettings.workDuration || 25);
      setShortMin(pomodoroSettings.shortBreak || 5);
      setLongMin(pomodoroSettings.longBreak || 15);
      
      // Update Timer left state if not running
      if (!isRunning) {
        setTimeLeft((mode === 'WORK' ? pomodoroSettings.workDuration : mode === 'SHORT' ? pomodoroSettings.shortBreak : pomodoroSettings.longBreak) * 60);
      }
    }
  }, [pomodoroSettings, mode]);

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Mode click handles
  const switchMode = (newMode: 'WORK' | 'SHORT' | 'LONG') => {
    setMode(newMode);
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const duration = newMode === 'WORK' ? workMin : newMode === 'SHORT' ? shortMin : longMin;
    setTimeLeft(duration * 60);
  };

  // Start / stop logic
  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setIsRunning(true);
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Reset logic
  const resetTimer = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const duration = mode === 'WORK' ? workMin : mode === 'SHORT' ? shortMin : longMin;
    setTimeLeft(duration * 60);
  };

  // Timer Complete Logic
  const handleTimerComplete = async () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Save session back to server
    const currentDuration = mode === 'WORK' ? workMin : mode === 'SHORT' ? shortMin : longMin;
    await createPomodoroSession({
      taskId: selectedTaskId || undefined,
      durationMinutes: currentDuration,
      type: mode
    });

    if (mode === 'WORK') {
      setCompletedCycles(prev => prev + 1);
      alert(`🎉 Focus session completed! You link-tracked ${currentDuration} minutes of focused attention. Take a break!`);
      switchMode('SHORT');
    } else {
      alert(`🌸 Break finished! Ready to step back into focus mode?`);
      switchMode('WORK');
    }
  };

  // Settings handlers
  const saveSettings = async () => {
    await updatePomodoroSettings({
      workDuration: workMin,
      shortBreak: shortMin,
      longBreak: longMin,
      autoStartTime: false
    });
    setShowSettings(false);
    resetTimer();
  };

  // Helper getters
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentModeDuration = mode === 'WORK' ? workMin : mode === 'SHORT' ? shortMin : longMin;
  const progressPercent = ((currentModeDuration * 60 - timeLeft) / (currentModeDuration * 60)) * 100;

  const linkedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <>
      {/* Floating Entry Indicator */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          id="pomodoro_floating_btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all border ${
            isRunning 
              ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400 animate-pulse' 
              : 'bg-slate-900 text-rose-400 hover:text-rose-300 border-slate-700'
          }`}
        >
          <Timer className="w-5 h-5" />
          <span className="font-mono text-sm font-semibold tracking-wider">
            {isRunning ? formatTime(timeLeft) : 'POMODORO'}
          </span>
          {completedCycles > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xxs font-bold bg-rose-600 rounded-full text-white">
              {completedCycles}
            </span>
          )}
        </motion.button>
      </div>

      {/* Primary Floating Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="pomodoro_panel_card"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-20 right-6 z-50 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden p-5 text-white font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Flame className="w-5 h-5 fill-rose-500 animate-pulse" />
                <span className="font-semibold text-sm tracking-wide">Focus Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main view vs Settings toggle */}
            {!showSettings ? (
              <div className="space-y-4">
                {/* Mode Selector */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl text-xxs font-semibold">
                  <button
                    onClick={() => switchMode('WORK')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                      mode === 'WORK' 
                        ? 'bg-rose-500 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Focus
                  </button>
                  <button
                    onClick={() => switchMode('SHORT')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                      mode === 'SHORT' 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Short
                  </button>
                  <button
                    onClick={() => switchMode('LONG')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                      mode === 'LONG' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Long
                  </button>
                </div>

                {/* Big Timer display */}
                <div className="relative py-4 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800/80">
                  {/* Digital Clock */}
                  <span className="font-mono text-5xl font-black tracking-widest text-slate-100 select-none">
                    {formatTime(timeLeft)}
                  </span>
                  
                  {/* Status Indicator */}
                  <span className={`text-[10px] font-bold tracking-widest uppercase mt-2 ${
                    mode === 'WORK' ? 'text-rose-400' : mode === 'SHORT' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {mode === 'WORK' ? '⏰ Deep Work Session' : mode === 'SHORT' ? '☕ Quick Coffee Break' : '🌴 Extended Break'}
                  </span>
                  
                  {/* Progress Line */}
                  <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full overflow-hidden rounded-b-2xl">
                    <motion.div 
                      className={`h-full ${
                        mode === 'WORK' ? 'bg-rose-500' : mode === 'SHORT' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Link focus to Active task */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-slate-400" /> LINK WITH CLICKUP TASK
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl px-2 py-2 focus:ring-1 focus:ring-rose-500 cursor-pointer focus:outline-none"
                  >
                    <option value="">-- No linked task (General focus) --</option>
                    {tasks.map(task => (
                      <option key={task.id} value={task.id}>
                        [{task.status || 'TODO'}] {task.name.length > 32 ? `${task.name.substring(0, 32)}...` : task.name}
                      </option>
                    ))}
                  </select>
                  {linkedTask && (
                    <div className="text-[10px] bg-rose-500/10 text-rose-300 p-2 rounded-lg border border-rose-500/20 italic">
                      Time tracking will link back to: <span className="font-semibold">{linkedTask.name}</span>
                    </div>
                  )}
                </div>

                {/* Control Buttons row */}
                <div className="flex gap-2 pt-2 justify-center">
                  <button
                    onClick={toggleTimer}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-transform transform active:scale-95 ${
                      isRunning 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                        : 'bg-rose-500 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {isRunning ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    {isRunning ? 'Pause Session' : 'Start Focus'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="aspect-square bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl p-2.5 text-slate-300 transition-all"
                    title="Reset Session"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Focused session summary logs */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
                    <span>TODAY'S INSTANT STATS</span>
                    <span className="text-slate-300">{pomodoroSessions.length} total blocks</span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {pomodoroSessions.length === 0 ? (
                      <div className="text-[10px] text-slate-500 italic text-center py-1">No focus logs synchronized today.</div>
                    ) : (
                      pomodoroSessions.slice(0, 3).map((sess, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-950 p-1.5 rounded-lg border border-slate-800/55">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-400" />
                            {sess.type === 'WORK' ? 'Work block' : 'Break block'}
                          </span>
                          <span className="font-mono text-slate-400">+{sess.durationMinutes}m</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Settings subpanel */
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xxs font-semibold text-slate-400">WORK CYCLE (MINS)</label>
                    <input
                      type="number"
                      value={workMin}
                      onChange={(e) => setWorkMin(Math.max(1, parseInt(e.target.value) || 25))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500 text-slate-200"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-xxs font-semibold text-slate-400">SHORT BREAK (MINS)</label>
                    <input
                      type="number"
                      value={shortMin}
                      onChange={(e) => setShortMin(Math.max(1, parseInt(e.target.value) || 5))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500 text-slate-200"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-xxs font-semibold text-slate-400">LONG BREAK (MINS)</label>
                    <input
                      type="number"
                      value={longMin}
                      onChange={(e) => setLongMin(Math.max(1, parseInt(e.target.value) || 15))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500 text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveSettings}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-xl text-xs font-semibold shadow-md"
                  >
                    Apply Config
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
