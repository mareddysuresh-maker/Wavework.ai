import React, { useState, useEffect } from 'react';
import { useFlow } from '../lib/FlowContext';
import { api } from '../lib/api';
import {
  FolderHeart,
  FolderOpen,
  Pin,
  Star,
  Search,
  Download,
  Edit2,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileIcon,
  Plus,
  X,
  Check,
  RefreshCcw,
  Clock
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedById: string;
  uploadedByColor: string;
  createdAt: string;
  context: string;
  contextName: string;
  isPinned: boolean;
  isFavorite: boolean;
  alias: string;
}

export const FileHubView: React.FC = () => {
  const { activeUser } = useFlow();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<'ALL' | 'SHARED' | 'PINNED' | 'FAVORITES' | 'RECENT'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Alias modal state
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [aliasValue, setAliasValue] = useState('');

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFiles();
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleTogglePin = async (fileId: string) => {
    try {
      await api.toggleFilePin(fileId);
      // Optimistic update
      setFiles(files.map(f => f.id === fileId ? { ...f, isPinned: !f.isPinned } : f));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      await api.toggleFileFavorite(fileId);
      setFiles(files.map(f => f.id === fileId ? { ...f, isFavorite: !f.isFavorite } : f));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    try {
      await api.updateFileAlias(editingFile.id, aliasValue.trim());
      setFiles(files.map(f => f.id === editingFile.id ? { ...f, alias: aliasValue.trim() } : f));
      setEditingFile(null);
      setAliasValue('');
    } catch (err) {
      console.error(err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    const type = mimeType.toLowerCase();
    if (type.includes('image')) return <FileImage className="w-5 h-5 text-emerald-500" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    if (type.includes('audio') || type.includes('mp3')) return <FileAudio className="w-5 h-5 text-pink-500" />;
    if (type.includes('video') || type.includes('mp4')) return <FileVideo className="w-5 h-5 text-rose-500" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-5 h-5 text-indigo-500" />;
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  // Group files into categories
  const getFileCategory = (mimeType: string) => {
    const type = mimeType.toLowerCase();
    if (type.includes('image')) return 'Images';
    if (type.includes('audio') || type.includes('video')) return 'Media';
    if (type.includes('pdf') || type.includes('doc') || type.includes('xls') || type.includes('txt') || type.includes('presentation')) return 'Documents';
    return 'Other';
  };

  // Filtering files
  const filteredFiles = files.filter(f => {
    // 1. Search filter
    const matchesSearch = 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.alias && f.alias.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Tab Section filter
    if (selectedSection === 'PINNED' && !f.isPinned) return false;
    if (selectedSection === 'FAVORITES' && !f.isFavorite) return false;
    if (selectedSection === 'SHARED' && f.uploadedById === activeUser?.id) return false; // files uploaded by others
    if (selectedSection === 'RECENT') {
      // files from last 7 days
      const uploadDate = new Date(f.createdAt);
      const diffTime = Math.abs(Date.now() - uploadDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 7) return false;
    }

    // 3. Category folders filter
    if (selectedCategory !== 'ALL' && getFileCategory(f.type) !== selectedCategory) return false;

    return true;
  });

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden text-slate-100 font-sans">
      
      {/* Top Header Panel */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950/40 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              F
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              My File Hub
              <FolderHeart className="w-4.5 h-4.5 text-indigo-400" />
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Centralized document bank. Star favorites, set custom file aliases, or pin reference cards locally.
          </p>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by file name or alias..."
              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-505 text-white"
            />
          </div>
          <button 
            onClick={loadFiles}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh bank"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Folders Sidebar / Right Files List */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Directories Pane */}
        <div className="w-56 bg-slate-900/30 border-r border-slate-900 p-4 space-y-6 flex-shrink-0 hidden md:block">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-2">sections</span>
            <nav className="space-y-1">
              {[
                { id: 'ALL', label: 'All Files', icon: FolderOpen },
                { id: 'SHARED', label: 'Shared With Me', icon: FolderHeart },
                { id: 'PINNED', label: 'Pinned Files', icon: Pin },
                { id: 'FAVORITES', label: 'Favorites', icon: Star },
                { id: 'RECENT', label: 'Recent Uploads', icon: Clock }
              ].map(sec => {
                const Icon = sec.icon;
                const isSelected = selectedSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => { setSelectedSection(sec.id as any); setSelectedCategory('ALL'); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                      isSelected ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {sec.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-2">collections</span>
            <nav className="space-y-1">
              {['ALL', 'Documents', 'Images', 'Media', 'Other'].map(cat => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      isSelected ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <span>{cat === 'ALL' ? 'Show All Types' : cat}</span>
                    <span className="text-[9px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                      {cat === 'ALL' ? files.length : files.filter(f => getFileCategory(f.type) === cat).length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Right Stage: List of Files */}
        <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col">
          
          {/* Section banner */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 flex-shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Files Listing / {selectedSection} {selectedCategory !== 'ALL' && `(${selectedCategory})`}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Found {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Files Grid / Card board */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading resource bank...</span>
              </div>
            </div>
          ) : filteredFiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFiles.map(file => (
                <div key={file.id} className="bg-slate-900 border border-slate-850 hover:border-slate-700/80 p-4.5 rounded-xl transition flex flex-col h-full group relative">
                  
                  {/* Top file type and quick triggers */}
                  <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
                    <div className="p-2 bg-slate-950/80 border border-slate-850 rounded-lg">
                      {getFileIcon(file.type)}
                    </div>
                    
                    {/* Metadata indicators */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleTogglePin(file.id)}
                        className={`p-1.5 border rounded-lg transition cursor-pointer ${
                          file.isPinned 
                            ? 'bg-amber-950/30 border-amber-900/60 text-amber-500' 
                            : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-350 hover:border-slate-750'
                        }`}
                        title={file.isPinned ? "Unpin reference card" : "Pin reference card"}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(file.id)}
                        className={`p-1.5 border rounded-lg transition cursor-pointer ${
                          file.isFavorite 
                            ? 'bg-rose-950/30 border-rose-900/60 text-rose-500' 
                            : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-350 hover:border-slate-750'
                        }`}
                        title={file.isFavorite ? "Remove favorite" : "Mark favorite"}
                      >
                        <Star className="w-3.5 h-3.5" fill={file.isFavorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>

                  {/* File Names (Alias / Original) */}
                  <div className="flex-1 min-w-0">
                    {file.alias ? (
                      <>
                        <h4 className="text-xs font-bold text-white truncate" title={file.alias}>
                          {file.alias}
                        </h4>
                        <span className="text-[10px] text-slate-500 truncate block mt-0.5" title={file.name}>
                          Orig: {file.name}
                        </span>
                      </>
                    ) : (
                      <h4 className="text-xs font-bold text-white truncate" title={file.name}>
                        {file.name}
                      </h4>
                    )}

                    {/* Context location link */}
                    <div className="mt-2 px-2 py-1 bg-slate-950 border border-slate-900 rounded-md text-[10px] text-slate-450 block truncate font-medium">
                      Location: <span className="text-indigo-400 font-bold">{file.contextName}</span> ({file.context})
                    </div>
                  </div>

                  {/* Separation divider */}
                  <div className="border-t border-slate-950 my-3.5" />

                  {/* Size and author details */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-4 flex-shrink-0">
                    <span>{formatSize(file.size)}</span>
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-4 h-4 rounded-full ${file.uploadedByColor} flex items-center justify-center font-bold text-[8px]`}>
                        {file.uploadedBy.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[80px]" title={file.uploadedBy}>{file.uploadedBy}</span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => { setEditingFile(file); setAliasValue(file.alias); }}
                      className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 font-bold text-[11px] py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      Alias
                    </button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic py-20 text-xs">
              No files match your search criteria.
            </div>
          )}

        </div>

      </div>

      {/* 2. Modal Edit Alias */}
      {editingFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-slate-900">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setEditingFile(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Edit2 className="text-indigo-600 w-4 h-4" />
              Set Custom File Alias
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-normal font-medium">
              Create a personalized alias for <span className="font-bold text-slate-800">{editingFile.name}</span>. This is user-specific and won't affect other team members.
            </p>
            <form onSubmit={handleSaveAlias} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Custom Name / Alias</label>
                <input
                  type="text"
                  placeholder="e.g. Approved UI Mockups"
                  value={aliasValue}
                  onChange={(e) => setAliasValue(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-950 font-medium"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded transition cursor-pointer"
              >
                Save Alias
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FileHubView;
