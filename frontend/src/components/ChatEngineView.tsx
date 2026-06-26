import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../lib/FlowContext';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Search, 
  Users, 
  MoreVertical, 
  MessageSquare,
  Lock,
  Hash,
  Star,
  Bookmark,
  ChevronRight,
  Plus,
  Loader2,
  Trash2
} from 'lucide-react';
import { api } from '../lib/api';

export const ChatEngineView: React.FC = () => {
  const {
    activeUser,
    users,
    channels,
    selectedChannel,
    setSelectedChannel,
    messages,
    sendMessage,
    typingUsers,
    notifyTyping,
    onlineUserIds,
    reactToMessage,
    saveToInbox,
    uploadFileAttachment
  } = useFlow();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showMemberSidebar, setShowMemberSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    notifyTyping();
  };

  // Handle send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const text = messageInput.trim();
    setMessageInput('');
    await sendMessage(text);
  };

  // Handle file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      if (!base64Data) return;

      try {
        setIsUploading(true);
        const attachment = await uploadFileAttachment(file.name, file.type, base64Data);
        // Automatically send the attachment as a message payload
        await api.sendMessage(selectedChannel!.id, `Sent an attachment: [${attachment.name}](${attachment.url})`, { attachments: [attachment] });
      } catch (err: any) {
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!selectedChannel) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center font-sans p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto shadow-sm">
            <MessageSquare className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Workspace Chat Messenger</h2>
          <p className="text-sm text-slate-500">
            Select a channel or direct message from the sidebar to start collaborating in real-time with your teammates.
          </p>
        </div>
      </div>
    );
  }

  // Get other DM member info
  let otherUser = null;
  if (activeUser && Array.isArray(selectedChannel.memberIds)) {
    const otherMemberId = selectedChannel.memberIds.find(id => id !== activeUser.id);
    otherUser = users.find(u => u.id === otherMemberId);
  }
  const chatTitle = selectedChannel.isDM && otherUser ? otherUser.name : selectedChannel.name;
  const chatDesc = selectedChannel.isDM ? `1-on-1 private connection with ${otherUser?.name || 'Colleague'}` : selectedChannel.description;

  // Filter messages based on search query
  const filteredMessages = messages.filter(m => 
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-white flex h-full overflow-hidden font-sans relative">
      
      {/* Central Chat Panel */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 border-r border-slate-200 min-w-0">
        
        {/* Header toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-550/10 text-indigo-600 shrink-0">
              {selectedChannel.isDM ? (
                <div className="relative">
                  <span className={`w-3.5 h-3.5 rounded-full ${otherUser?.color || 'bg-slate-400'} flex items-center justify-center font-bold text-[9px] text-white`}>
                    {otherUser?.name.charAt(0).toUpperCase()}
                  </span>
                  {otherUser && onlineUserIds.includes(otherUser.id) && (
                    <span className="absolute bottom-[-2px] right-[-2px] block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>
              ) : selectedChannel.isPrivate ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
            </div>
            <div className="truncate min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate leading-none">{chatTitle}</h2>
              <p className="text-[11px] text-slate-400 truncate mt-1">{chatDesc}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search Input bar */}
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-none rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 w-48 font-medium transition-all focus:w-64"
              />
            </div>

            <button
              onClick={() => setShowMemberSidebar(!showMemberSidebar)}
              className={`p-2 rounded-lg hover:bg-slate-100 transition shrink-0 ${showMemberSidebar ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
              title="Show info pane"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          
          {filteredMessages.map((msg, index) => {
            const author = users.find(u => u.id === msg.authorId);
            const isMe = msg.authorId === activeUser?.id;
            
            // Format timestamp
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 items-start max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${author?.color || 'bg-slate-400'} flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0`}>
                  {author?.name.charAt(0).toUpperCase() || 'U'}
                </div>

                {/* Content block */}
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-bold text-slate-700">{author?.name || 'Someone'}</span>
                    <span className="text-[9px] text-slate-400 font-medium">{timeStr}</span>
                  </div>

                  <div className={`p-3 rounded-2xl text-xs shadow-2xs leading-relaxed break-words font-medium ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>

                  {/* Message Reactions and actions */}
                  <div className={`flex items-center gap-1.5 pt-0.5 ${isMe ? 'justify-end' : ''}`}>
                    <button
                      onClick={() => reactToMessage(msg.id, '👍')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded px-1.5 py-0.5 cursor-pointer text-slate-500 font-semibold transition"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => reactToMessage(msg.id, '❤️')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded px-1.5 py-0.5 cursor-pointer text-slate-500 font-semibold transition"
                    >
                      ❤️
                    </button>
                    <button
                      onClick={() => saveToInbox(msg.id)}
                      className="p-0.5 hover:text-indigo-650 cursor-pointer text-slate-400 transition"
                      title="Bookmark message to Unified Alerts inbox"
                    >
                      <Bookmark className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex gap-3 items-center text-xs text-slate-400 italic">
              <div className="flex space-x-1 py-1">
                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is typing...' : 'are typing...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSend} className="bg-white border-t border-slate-200 p-4 shrink-0">
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
            {/* Attachment inputs */}
            <input
              type="file"
              id="chat-file-input"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-405 hover:text-slate-600 rounded-lg hover:bg-slate-150 transition cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            <input
              type="text"
              placeholder={`Message #${chatTitle}...`}
              value={messageInput}
              onChange={handleInputChange}
              className="flex-1 bg-transparent border-none focus:outline-none text-xs text-slate-800 placeholder-slate-400 font-medium px-1 py-2"
            />

            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white p-2 rounded-lg cursor-pointer transition shadow-md shadow-indigo-600/10"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>

      {/* Right Sidebar - Info/Members */}
      {showMemberSidebar && (
        <div className="w-64 shrink-0 h-full bg-white flex flex-col p-6 space-y-6 overflow-y-auto animate-fade-in-right hidden md:flex border-l border-slate-200">
          
          {/* Channel Name details */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">About Room</h3>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-800 block truncate">{chatTitle}</span>
              <p className="text-[11px] text-slate-500 leading-normal">{chatDesc}</p>
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Room Members ({selectedChannel.memberIds?.length || 0})</span>
            </h3>

            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 min-h-0">
              {users
                .filter(u => selectedChannel.memberIds?.includes(u.id))
                .map(u => {
                  const isOnline = onlineUserIds.includes(u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-full ${u.color} flex items-center justify-center font-bold text-[10px] text-white shrink-0`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate min-w-0">
                          <span className="text-xs font-semibold text-slate-700 block truncate">{u.name}</span>
                          <span className="text-[9px] text-slate-400 block truncate font-mono uppercase">{u.role}</span>
                        </div>
                      </div>

                      {/* Presence badge */}
                      <span className="relative flex h-2 w-2 shrink-0">
                        {isOnline ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
export default ChatEngineView;
