import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../lib/FlowContext';
import { Note } from '../types';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  RefreshCcw,
  Edit
} from 'lucide-react';

export const NotesView: React.FC = () => {
  const {
    notes,
    selectedNote,
    setSelectedNote,
    createScratchpad,
    editScratchpad,
    deleteScratchpad
  } = useFlow();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-select first note if none is selected
  useEffect(() => {
    if (!selectedNote && notes.length > 0) {
      handleSelectNote(notes[0]);
    }
  }, [selectedNote, notes]);

  // Handle setting text when note changes
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSaveStatus('IDLE');
  };

  const handleCreate = async () => {
    try {
      const generated = await createScratchpad("Blank Scratchpad", "Write details or team roadmap definitions here...");
      setTitle(generated.title);
      setContent(generated.content);
      setSaveStatus('SAVED');
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger autosave on inputs change
  const handleInputChange = (updatedTitle: string, updatedContent: string) => {
    setTitle(updatedTitle);
    setContent(updatedContent);
    setSaveStatus('SAVING');

    if (timerRef.current) clearTimeout(timerRef.current);
    if (!selectedNote) return;

    timerRef.current = setTimeout(async () => {
      try {
        await editScratchpad(selectedNote.id, { title: updatedTitle, content: updatedContent });
        setSaveStatus('SAVED');
        setTimeout(() => setSaveStatus('IDLE'), 2000);
      } catch (e) {
        console.error(e);
        setSaveStatus('IDLE');
      }
    }, 1200); // 1.2s debounce
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex-1 bg-slate-50 flex h-full font-sans min-w-0">
      
      {/* Left List Pane */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-slate-150 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">My Scratchpads</span>
          <button
            onClick={handleCreate}
            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition cursor-pointer"
            title="Create note sheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Note links list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.map(note => {
            const isSelected = selectedNote?.id === note.id;
            return (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition select-none ${
                  isSelected 
                    ? 'bg-indigo-50 text-indigo-800' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="truncate">{note.title}</span>
                </div>

                {confirmDeleteNoteId === note.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScratchpad(note.id);
                      setConfirmDeleteNoteId(null);
                    }}
                    className="text-[9px] text-rose-500 bg-rose-50 px-1 py-0.5 rounded cursor-pointer font-bold animate-pulse"
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteNoteId(note.id);
                      setTimeout(() => setConfirmDeleteNoteId(null), 4000);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {notes.length === 0 && (
            <p className="text-center text-[11px] text-slate-400 py-6 italic">No notes created.</p>
          )}
        </div>
      </div>

      {/* Right Core Editor Pane */}
      <div className="flex-1 bg-white flex flex-col h-full min-w-0">
        {selectedNote ? (
          <div className="flex-1 flex flex-col p-8 space-y-6 h-full min-h-0">
            
            {/* Header / Autosave Indicator */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 flex-shrink-0">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-400 uppercase">
                <Edit className="w-3.5 h-3.5 text-slate-400" />
                <span>Scratchpad Workspace</span>
              </div>

              {/* Status */}
              <div className="flex items-center text-[10px] font-bold font-mono">
                {saveStatus === 'SAVING' && (
                  <span className="text-indigo-600 flex items-center gap-1.5 uppercase">
                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    Autosaving to Database...
                  </span>
                )}
                {saveStatus === 'SAVED' && (
                  <span className="text-emerald-600 flex items-center gap-1.5 uppercase animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved Successfully
                  </span>
                )}
              </div>
            </div>

            {/* Note Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleInputChange(e.target.value, content)}
              className="w-full text-slate-950 font-bold text-xl placeholder-slate-400 tracking-tight focus:outline-none"
              placeholder="Title of scratchpad..."
            />

            {/* Note Content Textarea */}
            <textarea
              value={content}
              onChange={(e) => handleInputChange(title, e.target.value)}
              className="flex-1 w-full text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none leading-relaxed resize-none bg-transparent"
              placeholder="Start drafting meeting guidelines, roadmap plans, or trace logs..."
            />

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="max-w-xs text-center space-y-3.5">
              <FileText className="w-16 h-16 text-slate-200 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Scratchpad Loaded</h3>
              <p className="text-xs text-slate-500 font-medium">Create and manage personal roadmap documentation or meeting logs here.</p>
              <button
                onClick={handleCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-6 rounded-lg shadow-sm transition inline-block cursor-pointer"
              >
                Start Scratchpad
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
export default NotesView;
