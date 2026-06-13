import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../lib/FlowContext';
import { Sketch, Stroke, Point } from '../types';
import { 
  Plus, 
  Trash2, 
  Palette, 
  Sparkles, 
  RefreshCcw, 
  X,
  Sliders,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

const BRUSH_COLORS = [
  { id: '#0f172a', name: 'Charcoal', bg: 'bg-slate-900 border-slate-700' },
  { id: '#4f46e5', name: 'Indigo', bg: 'bg-indigo-600 border-indigo-505' },
  { id: '#e11d48', name: 'Ruby', bg: 'bg-rose-600 border-rose-505' },
  { id: '#16a34a', name: 'Emerald', bg: 'bg-emerald-600 border-emerald-505' },
  { id: '#d97706', name: 'Amber', bg: 'bg-amber-600 border-amber-505' }
];

const BRUSH_WIDTHS = [
  { value: 3, label: 'Thin Ink' },
  { value: 6, label: 'Medium Marker' },
  { value: 12, label: 'Heavy Highlighter' }
];

export const WhiteboardView: React.FC = () => {
  const {
    sketches,
    selectedSketch,
    setSelectedSketch,
    createCanvasSketch,
    editCanvasSketch,
    deleteCanvasSketch
  } = useFlow();

  const [activeColor, setActiveColor] = useState('#4f46e5');
  const [activeWidth, setActiveWidth] = useState(6);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  const [confirmDeleteSketchId, setConfirmDeleteSketchId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);

  // Auto-select first Sketch if none selected
  useEffect(() => {
    if (!selectedSketch && sketches.length > 0) {
      handleSelectSketch(sketches[0]);
    }
  }, [selectedSketch, sketches]);

  const handleSelectSketch = (sketch: Sketch) => {
    setSelectedSketch(sketch);
    setSaveStatus('IDLE');
  };

  const handleCreate = async () => {
    try {
      const generated = await createCanvasSketch("Arch Strategy Sketch", "#ffffff");
      setSelectedSketch(generated);
      setSaveStatus('SAVED');
    } catch (e) {
      console.error(e);
    }
  };

  // ResizeObserver to correctly scale and handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Match sizes safely
        const drawCache = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);

        canvas.width = Math.max(width, 400);
        canvas.height = Math.max(height, 400);

        if (drawCache) {
          canvas.getContext('2d')?.putImageData(drawCache, 0, 0);
        }

        // Redraw vector layers from database
        redrawSketches();
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [selectedSketch]);

  // Redraw all strokes from selected sketch database representation
  const redrawSketches = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSketch) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grid alignment assist
    drawGridAssist(ctx, canvas.width, canvas.height);

    const strokes = selectedSketch.strokes || [];
    strokes.forEach(stroke => {
      const pts = stroke.points || [];
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  };

  // Draw blueprint engineering grid
  const drawGridAssist = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1;
    const step = 30;

    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  // Redraw whenever the vector data itself modifies
  useEffect(() => {
    redrawSketches();
  }, [selectedSketch]);

  // Drawing mouse handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedSketch) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const pos = getMousePos(e);
    currentPointsRef.current = [pos];

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = activeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !selectedSketch) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getMousePos(e);
    currentPointsRef.current.push(pos);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleMouseUpOrOut = async () => {
    if (!isDrawingRef.current || !selectedSketch) return;
    isDrawingRef.current = false;

    if (currentPointsRef.current.length < 2) {
      currentPointsRef.current = [];
      return;
    }

    const newStroke: Stroke = {
      points: [...currentPointsRef.current],
      color: activeColor,
      width: activeWidth
    };

    currentPointsRef.current = [];
    const updatedStrokes = [...(selectedSketch.strokes || []), newStroke];
    
    // Set status saving
    setSaveStatus('SAVING');
    try {
      await editCanvasSketch(selectedSketch.id, { strokes: updatedStrokes });
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus('IDLE');
    }
  };

  const clearCanvasStrokes = async () => {
    if (!selectedSketch) return;

    try {
      setSaveStatus('SAVING');
      await editCanvasSketch(selectedSketch.id, { strokes: [] });
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus('IDLE');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex h-full font-sans min-w-0 select-none">
      
      {/* Left List Pane */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-slate-150 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Drawing Canvases</span>
          <button
            onClick={handleCreate}
            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition cursor-pointer"
            title="Create sketchboard"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Sketches listings */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sketches.map(sketch => {
            const isSelected = selectedSketch?.id === sketch.id;
            return (
              <div
                key={sketch.id}
                onClick={() => handleSelectSketch(sketch)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  isSelected 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Maximize2 className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-450'}`} />
                  <span className="truncate">{sketch.title}</span>
                </div>

                {confirmDeleteSketchId === sketch.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCanvasSketch(sketch.id);
                      setConfirmDeleteSketchId(null);
                    }}
                    className="text-[9px] text-rose-500 bg-rose-50 px-1 py-0.5 rounded cursor-pointer font-bold animate-pulse"
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteSketchId(sketch.id);
                      setTimeout(() => setConfirmDeleteSketchId(null), 4000);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {sketches.length === 0 && (
            <p className="text-center text-[11px] text-slate-400 py-6 italic">No canvases found.</p>
          )}
        </div>
      </div>

      {/* Right Core Drawing Stage */}
      <div className="flex-1 bg-white flex flex-col h-full min-w-0">
        {selectedSketch ? (
          <div className="flex-1 flex flex-col h-full min-h-0">
            
            {/* Toolbar Panel */}
            <div className="p-4 border-b border-slate-150 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
              
              <div className="min-w-0">
                <input
                  type="text"
                  value={selectedSketch.title}
                  onChange={(e) => editCanvasSketch(selectedSketch.id, { title: e.target.value })}
                  className="font-bold text-base text-slate-900 border-none focus:outline-none focus:ring-0 p-0 m-0 bg-transparent"
                  placeholder="Rename Strategy Blueprint..."
                />
                
                {/* Autosave Indicators */}
                <span className="text-[9.5px] font-sans font-semibold text-slate-400 block mt-0.5">
                  {saveStatus === 'SAVING' ? (
                    <span className="text-indigo-600 font-bold uppercase">📥 UPLOADING VECTOR STROKES...</span>
                  ) : saveStatus === 'SAVED' ? (
                    <span className="text-emerald-600 font-bold uppercase">✅ CANVAS SYNCHRONIZED</span>
                  ) : (
                    <span>ACTIVE SKETCHPAD | BLUEPRINT GRIDS ENABLED</span>
                  )}
                </span>
              </div>

              {/* Controls choices */}
              <div className="flex flex-wrap items-center gap-4">
                
                {/* Brushes Choice selector */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  {BRUSH_COLORS.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setActiveColor(color.id)}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 transition ${color.bg} ${
                        activeColor === color.id ? 'border-amber-400 scale-105' : 'border-transparent'
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>

                {/* Weights choice selector */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Sliders className="w-4 h-4 text-slate-450" />
                  <select
                    value={activeWidth}
                    onChange={(e) => setActiveWidth(Number(e.target.value))}
                    className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
                  >
                    {BRUSH_WIDTHS.map(width => (
                      <option key={width.value} value={width.value}>{width.label}</option>
                    ))}
                  </select>
                </div>

                {/* Reset cleaner */}
                <button
                  onClick={clearCanvasStrokes}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-950 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer border border-slate-200 transition"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Clear Layout
                </button>

              </div>

            </div>

            {/* Main Interactive Stage Container */}
            <div ref={containerRef} className="flex-1 relative min-h-0 bg-slate-50/20">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrOut}
                onMouseLeave={handleMouseUpOrOut}
                className="absolute inset-0 w-full h-full cursor-crosshair bg-white outline-none"
              />
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="max-w-xs text-center space-y-3.5">
              <Maximize2 className="w-16 h-16 text-slate-200 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Whiteboard Board Loaded</h3>
              <p className="text-xs text-slate-500 font-medium">Draw layouts, architecture vectors, or clarify sprint tasks collaboratively.</p>
              <button
                onClick={handleCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-6 rounded-lg shadow-sm transition inline-block cursor-pointer"
              >
                Create Strategy Board
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
export default WhiteboardView;
