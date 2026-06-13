import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../lib/FlowContext';
import { 
  Send, Smile, Bookmark, Hash, Users, X, Plus, Mail, Sparkles, 
  ClipboardCheck, ClipboardCopy, MessageSquare, Paperclip, 
  Crown, CheckCircle, FileText, Image, FileSpreadsheet, Settings, 
  Menu, ShieldCheck, Trash, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ChatEngineView: React.FC = () => {
  const { 
    channels, 
    selectedChannel, 
    setSelectedChannel, 
    messages, 
    sendMessage, 
    reactToMessage, 
    saveToInbox, 
    users, 
    activeUser,
    createChannel,
    chatRequests,
    sendChatRequest,
    acceptChatRequest,
    declineChatRequest,
    updateChannelSettings,
    uploadFileAttachment,
    onlineUserIds,
    typingUsers,
    notifyTyping
  } = useFlow();

  // Internal visual UI states
  const [input, setInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'MEMBERS' | 'INVITE' | 'SETTINGS'>('MEMBERS');
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);

  // Group Creator Form
  const [isGroupCreatorOpen, setIsGroupCreatorOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupLogo, setNewGroupLogo] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Group Settings Editor Form (For Admin updates)
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupLogo, setEditGroupLogo] = useState('');

  // File attach/upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedAttachment, setUploadedAttachment] = useState<any | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ensure first channel is active if none
  useEffect(() => {
    if (!selectedChannel && channels.length > 0) {
      setSelectedChannel(channels[0]);
    }
  }, [selectedChannel, channels, setSelectedChannel]);

  // Sync editor fields with active channel
  useEffect(() => {
    if (selectedChannel) {
      setEditGroupName(selectedChannel.name);
      setEditGroupDesc(selectedChannel.description || '');
      setEditGroupLogo(selectedChannel.logoUrl || '');
    }
  }, [selectedChannel]);

  // Auto scroll down on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean member list except current logged-in user
  const selectableCoWorkers = users.filter(u => u.id !== activeUser?.id);

  // Send message with text +/- local Base64 attachment
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;
    if (!input.trim() && !uploadedAttachment) return;

    try {
      // Build attachments array structure
      const fAttachments = uploadedAttachment ? [uploadedAttachment] : [];
      
      // Call Context message poster
      // We can pass extra parameter or trigger custom sendMessage override if we want.
      // Let's call the sendMessage method, if we have attachments we can format the message text OR send it nicely!
      // Since context sendMessage sends only text by default, let's craft a message that represents the attachment
      // OR let's make sure it handles both. Let's check how FlowContext's sendMessage is defined:
      // Let's modify our message payload. It's incredibly elegant to send both:
      let finalContent = input;
      if (uploadedAttachment) {
        finalContent += `\n\n📎 Attachment shared: [${uploadedAttachment.name}](${uploadedAttachment.url})`;
      }

      await sendMessage(finalContent);
      setInput('');
      setUploadedAttachment(null);
    } catch (err: any) {
      alert("Error posting your message: " + err.message);
    }
  };

  // Upload file to local server
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const result = await uploadFileAttachment(file.name, file.type, base64Data);
        setUploadedAttachment(result);
        alert(`📂 Document "${file.name}" uploaded successfully! Tap send to post it.`);
      } catch (err: any) {
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Group creation handles
  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const isGroup = true;
      const isPrivate = true; // By default direct group chats are private
      
      // Build group channel custom object
      // We will select member IDs
      const members = [...selectedMembers, activeUser?.id || 'u-1'];
      
      // Create channel
      const res = await createChannel(newGroupName, newGroupDesc, false, members, newGroupLogo);
      
      // Clear
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupLogo('');
      setSelectedMembers([]);
      setIsGroupCreatorOpen(false);
      alert(`🎉 Group "${newGroupName}" created!`);
    } catch (error: any) {
      alert("Creation failed: " + error.message);
    }
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Update channel properties (Changing group logos, making admin)
  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;

    try {
      await updateChannelSettings(selectedChannel.id, {
        name: editGroupName,
        description: editGroupDesc,
        logoUrl: editGroupLogo
      });
      setIsGroupEditorOpen(false);
      alert("Group properties updated successfully!");
    } catch (err: any) {
      alert("Modified group failed: " + err.message);
    }
  };

  // Switch Admin Role for a Member
  const handleToggleAdminStatus = async (targetUserId: string) => {
    if (!selectedChannel) return;
    const currentAdmins = selectedChannel.adminIds || [];
    
    let newAdmins = [...currentAdmins];
    if (newAdmins.includes(targetUserId)) {
      if (newAdmins.length <= 1) {
        alert("There must be at least one administrator for this group chat.");
        return;
      }
      newAdmins = newAdmins.filter(id => id !== targetUserId);
    } else {
      newAdmins.push(targetUserId);
    }

    try {
      await updateChannelSettings(selectedChannel.id, { adminIds: newAdmins });
      alert("Admin permissions updated successfully!");
    } catch (err: any) {
      alert("Permissions update failed: " + err.message);
    }
  };

  // Switch Member list active status (Add / Remove user from group)
  const handleToggleGroupMembership = async (targetUserId: string) => {
    if (!selectedChannel) return;
    const currentMembers = selectedChannel.memberIds || [];

    let newMembers = [...currentMembers];
    if (newMembers.includes(targetUserId)) {
      if (targetUserId === activeUser?.id) {
        alert("You cannot remove yourself from the group.");
        return;
      }
      newMembers = newMembers.filter(id => id !== targetUserId);
    } else {
      newMembers.push(targetUserId);
    }

    try {
      await updateChannelSettings(selectedChannel.id, { memberIds: newMembers });
    } catch (err: any) {
      alert("Membership update failed: " + err.message);
    }
  };

  // Send Invitation handle
  const handleSendInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    try {
      await sendChatRequest(inviteEmail, inviteName);
      const simulatedLoginUrl = `${window.location.origin}/?simulateUserId=${encodeURIComponent(inviteEmail.toLowerCase())}`;
      setInviteMsg(`Success! ${inviteName} was sent an invitation. Let them simulate click in separate tab:\n${simulatedLoginUrl}`);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      setInviteMsg(`Error: ${err.message}`);
    }
  };

  // Clipboard copies
  const copyInviteLink = () => {
    const parts = inviteMsg.match(/https?:\/\/[^\s]+/);
    if (parts) {
      navigator.clipboard.writeText(parts[0]);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    }
  };

  // Pending Invite filtering
  const incomingInvites = chatRequests.filter(r => 
    r.receiverEmail?.toLowerCase() === activeUser?.email?.toLowerCase() && r.status === 'PENDING'
  );
  
  const outgoingInvites = chatRequests.filter(r => 
    r.senderId === activeUser?.id
  );

  // Render correct icon based on file extension
  const renderAttachmentBadge = (url: string, name: string) => {
    const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(name);
    const isDoc = /\.(docx|doc|pdf|txt)$/i.test(name);

    return (
      <div className="mt-3 p-3 bg-slate-900/10 border border-slate-200/50 rounded-xl max-w-sm flex items-center gap-3">
        {isImage ? (
          <Image className="w-8 h-8 text-indigo-500 flex-shrink-0" />
        ) : isDoc ? (
          <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
        ) : (
          <FileSpreadsheet className="w-8 h-8 text-emerald-500 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate" title={name}>{name}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Attachment</p>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xxs bg-indigo-600 hover:bg-slate-900 text-white font-bold py-1.5 px-3 rounded-lg transition"
        >
          View / Get
        </a>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col md:flex-row h-full overflow-hidden font-sans min-w-0 relative">
      
      {/* 1. Left Responsive Mobile Toggle Drawer or Desktop Column listing Conversations */}
      <div className="md:w-64 bg-[#0b0f19] text-white flex-shrink-0 flex flex-col h-14 md:h-full border-r border-[#1e293b]/50">
        
        {/* Mobile sticky header header */}
        <div className="px-4 h-full md:h-auto md:p-5 flex items-center justify-between border-b border-[#1e293b]/40 bg-[#070a13]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20">
              <MessageSquare className="w-4 h-4 text-white rotate-3" />
            </div>
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase">Workspace Chats</span>
          </div>
          {/* Mobile hamburger button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-[#111827] text-slate-300 hover:text-white transition"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Channels/DMs listings (hidden on mobile, expandable via drawer, visible on tablet/desktop) */}
        <div className="hidden md:flex flex-col flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div>
            <div className="flex justify-between items-center text-[10px] font-black text-slate-550 tracking-widest mb-3 uppercase">
              <span>CONVERSATION ROOMS</span>
              <button 
                onClick={() => setIsGroupCreatorOpen(true)}
                className="p-1 hover:bg-[#1e293b]/60 rounded-md text-slate-450 hover:text-indigo-400 cursor-pointer transition"
                title="Create Group Chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-1">
              {channels.map(chan => {
                const isSelected = selectedChannel?.id === chan.id;
                return (
                  <button
                    key={chan.id}
                    onClick={() => {
                      setSelectedChannel(chan);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left truncate px-3 py-2.5 text-xs rounded-xl flex items-center gap-2.5 transition-all duration-200 transform ${
                      isSelected 
                        ? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-lg shadow-indigo-600/20 font-bold border-l-4 border-indigo-400 pl-2' 
                        : 'text-slate-400 hover:bg-[#111827]/80 hover:text-white font-medium pl-3'
                    }`}
                  >
                    {chan.logoUrl ? (
                      <div className="w-4 h-4 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-[9px] border border-[#1e293b]">
                        <img src={chan.logoUrl} className="w-full h-full object-cover" alt={chan.name} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                      </div>
                    ) : chan.isDM ? (
                      <Users className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{chan.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Active members check */}
          <div className="pt-4 border-t border-[#1e293b]/40">
            <span className="text-[10px] font-black text-slate-550 tracking-widest block mb-3 uppercase">OFFICIAL DIRECTORY</span>
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {users.map(u => (
                <div key={u.id} className="flex items-center space-x-2.5 text-xs py-0.5 px-2 hover:bg-[#111827]/40 rounded-lg transition-all duration-200">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${u.color} flex items-center justify-center font-bold text-[10px] shadow-sm`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    {onlineUserIds.includes(u.id) && (
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0b0f19] animate-pulse" />
                    )}
                  </div>
                  <span className="text-slate-300 hover:text-white font-semibold truncate transition">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Drawer (Only visible on micro touch toggles) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-y-0 left-0 w-64 bg-[#0b0f19] text-white z-40 p-4 space-y-4 md:hidden flex flex-col shadow-2xl border-r border-[#1e293b]/40"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#1e293b]/40">
              <span className="font-extrabold text-xs tracking-widest text-[#6366f1] uppercase">SWITCH CHATS</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-[#1e293b] rounded transition">
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {channels.map(chan => (
                <button
                  key={chan.id}
                  onClick={() => {
                    setSelectedChannel(chan);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left truncate px-3 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-all ${
                    selectedChannel?.id === chan.id 
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold' 
                      : 'text-slate-350 hover:bg-[#111827] hover:text-white'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{chan.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Central Active Conversational Core Panel */}
      <div className="flex-1 flex flex-col h-[calc(100vh-14px)] md:h-full bg-slate-50 min-w-0">
        
        {/* Header toolbar */}
        {selectedChannel ? (
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0 shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center space-x-2.5">
                {selectedChannel.logoUrl ? (
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 overflow-hidden border border-indigo-150 flex-shrink-0 shadow-xs">
                    <img src={selectedChannel.logoUrl} className="w-full h-full object-cover" alt="logo" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0 shadow-xs">
                    {selectedChannel.isDM ? (
                      <Users className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Hash className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                )}
                <span className="text-slate-950 font-black tracking-tight text-base truncate">
                  {selectedChannel.name}
                </span>
                <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                  {selectedChannel.isDM ? "DM" : selectedChannel.isGroup ? "GROUP" : "CHANNEL"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-1">
                {selectedChannel.description || "Project collaboration chatroom."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedChannel.isGroup && (
                <button
                  onClick={() => setIsGroupEditorOpen(true)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  title="Group Settings & Admin"
                >
                  <Settings className="w-4.5 h-4.5" />
                </button>
              )}
              <button
                onClick={() => setIsGroupCreatorOpen(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Group</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 border-b border-slate-200 text-center text-slate-400 text-xs bg-white font-medium">Waiting for connection...</div>
        )}

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0 bg-gradient-to-b from-slate-50/50 to-white/30 custom-scrollbar">
          {messages.map((msg) => {
            const author = users.find(u => u.id === msg.authorId);
            const isSelf = msg.authorId === activeUser?.id;

            // Check if string contains custom markdown file links shared
            const attachmentMatch = msg.content?.match(/\[(.*?)\]\((.*?)\)/);
            let displayContent = msg.content;
            let fileAttachmentObj = null;

            if (attachmentMatch) {
              displayContent = msg.content.replace(/📎 Attachment shared: \[.*?\]\(.*?\)/g, "").trim();
              fileAttachmentObj = {
                name: attachmentMatch[1],
                url: attachmentMatch[2]
              };
            }

            return (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`flex gap-3 max-w-[85%] group relative ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8.5 h-8.5 rounded-full ${author?.color || 'bg-indigo-600 text-white'} flex items-center justify-center font-black text-xs shadow-sm flex-shrink-0 border-2 border-white`}>
                  {(author?.name || 'G').charAt(0).toUpperCase()}
                </div>

                <div className="space-y-1 min-w-0">
                  {/* Meta row */}
                  <div className={`flex items-baseline space-x-2 ${isSelf ? 'justify-end flex-row-reverse space-x-reverse' : ''}`}>
                    <span className="text-xs font-bold text-slate-800 truncate hover:text-indigo-600 transition cursor-pointer">
                      {author?.name || "Active Member"}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div className={`rounded-2xl p-4 text-xs font-semibold leading-relaxed relative border transition-all ${
                    isSelf 
                      ? 'bg-gradient-to-tr from-indigo-600 to-violet-650 text-white border-none rounded-tr-none shadow-md shadow-indigo-600/10 hover:shadow-lg' 
                      : 'bg-white text-slate-800 border-slate-200/70 rounded-tl-none shadow-xs hover:bg-slate-50/30'
                  }`}>
                    <p className="whitespace-pre-wrap">{displayContent}</p>

                    {/* Shared docs layout attachments */}
                    {fileAttachmentObj && (
                      <div className="mt-1">
                        {renderAttachmentBadge(fileAttachmentObj.url, fileAttachmentObj.name)}
                      </div>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-2.5 ${isSelf ? 'justify-end' : ''}`}>
                        {msg.reactions.map((react, i) => (
                          <button
                            key={i}
                            onClick={() => reactToMessage(msg.id, react.emoji)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition"
                          >
                            <span>{react.emoji}</span>
                            <span className="opacity-80">{react.userIds?.length || 0}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reactions hover trigger bar */}
                    <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white border border-slate-200/80 rounded-xl shadow-lg p-1.5 flex items-center space-x-2 z-10 -translate-y-1/2 scale-95 group-hover:scale-100 ${
                      isSelf ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
                    }`}>
                      <button onClick={() => reactToMessage(msg.id, '👍')} className="hover:scale-125 transition cursor-pointer text-xs">👍</button>
                      <button onClick={() => reactToMessage(msg.id, '🚀')} className="hover:scale-125 transition cursor-pointer text-xs">🚀</button>
                      <button onClick={() => reactToMessage(msg.id, '🎉')} className="hover:scale-125 transition cursor-pointer text-xs">🎉</button>
                      <div className="w-px h-3.5 bg-slate-200" />
                      <button
                        onClick={() => saveToInbox(msg.id)}
                        className="text-slate-400 hover:text-indigo-600 transition cursor-pointer p-0.5"
                        title="Pin and save to inbox items"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Persistent Shared files queue inside the input container */}
        {uploadedAttachment && (
          <div className="mx-6 mb-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-900 font-bold animate-fade-in">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600 animate-bounce" />
              <span>Attachment armed:</span>
              <span className="font-semibold text-indigo-700 underline truncate max-w-[180px]">{uploadedAttachment.name}</span>
            </span>
            <button 
              onClick={() => setUploadedAttachment(null)}
              className="p-1 hover:bg-indigo-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Typing indicators */}
        {typingUsers && typingUsers.length > 0 && (
          <div className="mx-6 mb-3 px-4 py-2 bg-indigo-50/70 backdrop-blur-md border border-white/40 rounded-full text-[10.5px] text-indigo-750 font-semibold italic animate-pulse flex items-center gap-2 max-w-max select-none shadow-md">
            <span className="flex gap-0.5 items-center mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </span>
            <span>
              {typingUsers.map(u => u.userName || "Someone").join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="px-6 pb-6 pt-2 bg-transparent flex justify-center flex-shrink-0 w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md border border-white/40 shadow-xl shadow-indigo-950/5 rounded-full p-2.5 w-full transition-all duration-300 focus-within:border-indigo-500/85 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:shadow-indigo-950/10 focus-within:bg-white/95">
            {/* Local uploader trigger */}
            <button
              type="button"
              disabled={isUploading}
              onClick={triggerUploadClick}
              className={`p-2.5 hover:bg-slate-100/80 rounded-full text-slate-450 hover:text-slate-800 transition duration-200 cursor-pointer flex-shrink-0 ${isUploading ? 'animate-pulse' : ''}`}
              title="Attach local Doc, PDF, Docx or image"
              id="chat_attach_btn"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                notifyTyping();
              }}
              placeholder={selectedChannel ? `Message ${selectedChannel.name}...` : "Write a message..."}
              className="flex-1 bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 font-semibold py-2 px-2 focus:outline-none focus:ring-0"
            />
            
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-full transition-all duration-200 shadow-md shadow-indigo-650/15 hover:shadow-indigo-650/30 cursor-pointer flex-shrink-0 active:scale-95 animate-pulse"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* 3. Right Advanced Interaction Column (Direct Invitations list with accept/decline action) */}
      <div className="w-80 border-l border-slate-200/80 bg-white flex flex-col h-full overflow-hidden flex-shrink-0">
        
        {/* Navigation Tabs Header */}
        <div className="grid grid-cols-2 border-b border-slate-200 flex-shrink-0 bg-slate-50/60">
          <button
            onClick={() => setActiveRightTab('MEMBERS')}
            className={`py-3.5 text-xxs font-black tracking-widest uppercase text-center border-b-2 transition duration-200 cursor-pointer ${
              activeRightTab === 'MEMBERS' 
                ? 'border-indigo-600 text-indigo-600 bg-white' 
                : 'border-transparent text-slate-400 hover:text-slate-750'
            }`}
          >
            Audience
          </button>
          <button
            onClick={() => setActiveRightTab('INVITE')}
            className={`py-3.5 text-xxs font-black tracking-widest uppercase text-center border-b-2 transition duration-200 cursor-pointer ${
              activeRightTab === 'INVITE' 
                ? 'border-indigo-600 text-indigo-600 bg-white' 
                : 'border-transparent text-slate-400 hover:text-slate-750'
            }`}
          >
            Invite Lobby
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {activeRightTab === 'MEMBERS' ? (
            <div className="space-y-5">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-3 block">
                  COLLABORATING HERE
                </h4>
                {selectedChannel ? (
                  <div className="space-y-2.5">
                    {users.filter(u => Array.isArray(selectedChannel.memberIds) && selectedChannel.memberIds.includes(u.id)).map(memb => {
                      const isAdmin = Array.isArray(selectedChannel.adminIds) && selectedChannel.adminIds.includes(memb.id);
                      return (
                        <div key={memb.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200/60 text-xs shadow-xxs hover:shadow-xs hover:border-slate-350 transition duration-200">
                          <span className="flex items-center gap-2.5">
                            <span className="relative flex-shrink-0">
                              <span className={`w-7 h-7 rounded-full ${memb.color} flex items-center justify-center font-black text-[10.5px] border border-white shadow-xs`}>
                                {memb.name.charAt(0).toUpperCase()}
                              </span>
                              {onlineUserIds.includes(memb.id) && (
                                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                              )}
                            </span>
                            <span className="text-slate-800 font-bold max-w-[120px] truncate">{memb.name}</span>
                          </span>
                          {isAdmin && (
                            <span className="text-[8.5px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-0.5 border border-amber-200/50">
                              <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> Admin
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs italic">Select a room first.</div>
                )}
              </div>

              {/* Quick Co-worker roster toggle */}
              <div className="pt-4 border-t border-slate-200/80">
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-3 block">
                  SYSTEM ACTIVE CLIENTS
                </h4>
                <div className="p-4 bg-gradient-to-tr from-slate-50 to-indigo-50/20 rounded-2xl border border-indigo-100/60 space-y-3 shadow-xxs">
                  <p className="text-[10.5px] text-slate-550 leading-relaxed font-semibold">
                    Switch simulation sessions instantly in this browser tab:
                  </p>
                  <div className="space-y-2">
                    {users.map(u => (
                      <a
                        key={u.id}
                        href={`${window.location.origin}/?simulateUserId=${u.id}`}
                        className={`block text-xxs font-bold p-2.5 rounded-xl border text-left transition duration-200 shadow-xxs hover:shadow-xs active:scale-98 ${
                          activeUser?.id === u.id 
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-550 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-250/70 hover:border-slate-350'
                        }`}
                      >
                        [{u.role}] {u.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Invite Lobby Tab with incoming invitation panels */
            <div className="space-y-5 animate-fade-in">
              
              {/* Send Invitation Form */}
              <div className="space-y-3.5 p-4.5 bg-slate-50/60 border border-slate-200/80 rounded-2xl shadow-xxs">
                <span className="text-[10px] font-black text-indigo-600 tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> INVITE BY EMAIL
                </span>
                <form onSubmit={handleSendInviteSubmit} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Emma PM"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="emma.qa@flowup.io"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition duration-200 shadow-sm shadow-indigo-600/10 active:scale-98 cursor-pointer"
                  >
                    Submit Invitation
                  </button>
                </form>
              </div>

              {/* Copied credentials helper */}
              {inviteMsg && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-150/70 rounded-xl space-y-2 break-all text-[11px] shadow-xs">
                  <div className="flex justify-between items-center text-[9px] font-black text-indigo-700 tracking-wider uppercase">
                    <span>Simulation Access Link</span>
                    <button 
                      onClick={copyInviteLink}
                      className="p-1 hover:bg-indigo-100/70 rounded-lg text-indigo-600 transition"
                      title="Copy access URL"
                    >
                      {copyStatus ? <ClipboardCheck className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="max-h-20 overflow-y-auto text-[10px] font-mono leading-relaxed bg-white/60 p-2 rounded-lg border border-indigo-100/40 text-slate-600 custom-scrollbar">{inviteMsg}</p>
                </div>
              )}

              {/* Reciprocal Incoming Requests (Visible if targeted to active user email) */}
              <div className="space-y-3 pt-4 border-t border-slate-200/80">
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                  INCOMING DIRECT CHATS ({incomingInvites.length})
                </h4>
                {incomingInvites.length === 0 ? (
                  <p className="text-[10.5px] text-slate-400 italic font-medium px-1">No pending invitations received.</p>
                ) : (
                  <div className="space-y-2.5">
                    {incomingInvites.map(reqst => {
                      const sender = users.find(u => u.id === reqst.senderId);
                      return (
                        <div key={reqst.id} className="p-4 bg-white border border-indigo-150 rounded-2xl text-xs space-y-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-indigo-300">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="font-bold text-slate-800">{sender?.name || 'Manager'} invited you</span>
                          </div>
                          <div className="flex gap-2 pt-0.5">
                            <button
                              onClick={() => acceptChatRequest(reqst.id)}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-97"
                            >
                              Accept DM
                            </button>
                            <button
                              onClick={() => declineChatRequest(reqst.id)}
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold py-2 rounded-xl transition cursor-pointer active:scale-97"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sent Invites Status tracker */}
              <div className="space-y-3 pt-4 border-t border-slate-200/80">
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                  SENT OUTGOING REQUESTS ({outgoingInvites.length})
                </h4>
                {outgoingInvites.length === 0 ? (
                  <p className="text-[10.5px] text-slate-400 italic font-medium px-1">No sent requests tracked.</p>
                ) : (
                  <div className="space-y-2.5">
                    {outgoingInvites.map(reqst => (
                      <div key={reqst.id} className="text-[10px] bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xxs hover:shadow-xs hover:border-slate-350 transition-all duration-200 space-y-2">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-slate-800 font-bold truncate max-w-[130px]">{reqst.receiverName || reqst.receiverEmail}</span>
                          <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-md font-black font-mono tracking-wider border ${
                            reqst.status === 'ACCEPTED' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                              : 'bg-amber-50 text-amber-700 border-amber-200/50'
                          }`}>
                            {reqst.status}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 font-medium truncate">{reqst.receiverEmail}</p>
                        {reqst.previewUrl && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[8.5px] text-indigo-600 font-mono font-medium flex items-center gap-1">📨 Sent via SMTP</span>
                            <a 
                              href={reqst.previewUrl} 
                              target="_blank" 
                              rel="noreferrer noopener" 
                              className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold px-2.5 py-1 rounded-lg transition border border-indigo-150/40 cursor-pointer"
                            >
                              Inspect Email ↗
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Group Creator Modal Subpanel */}
      {isGroupCreatorOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-slate-800 animate-fade-in">
          <div className="bg-white rounded-3xl p-6.5 max-w-md w-full shadow-2xl relative border border-slate-100">
            <button 
              onClick={() => setIsGroupCreatorOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-base font-black text-slate-950 mb-5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650">
                <Users className="w-4 h-4" />
              </div>
              CREATE COLLABORATIVE GROUP
            </h3>

            <form onSubmit={handleCreateGroupChat} className="space-y-4">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Sync Room"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Brief Description</label>
                <input
                  type="text"
                  placeholder="e.g. Coordinating Figma mockups"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                />
              </div>

              {/* Checklist to choose who to include */}
              <div>
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Members to add</label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 bg-slate-50 rounded-xl p-3 space-y-2 custom-scrollbar">
                  {selectableCoWorkers.map(memb => {
                    const isChecked = selectedMembers.includes(memb.id);
                    return (
                      <div 
                        key={memb.id} 
                        onClick={() => handleMemberToggle(memb.id)}
                        className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-100/80 p-1.5 rounded-lg transition"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full ${memb.color} flex items-center justify-center font-bold text-[9px] border border-white shadow-xs`}>
                            {memb.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-slate-800 font-semibold truncate">{memb.name}</span>
                        </span>
                        <div className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all ${
                          isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-350 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition duration-200 shadow-md shadow-indigo-650/15 cursor-pointer active:scale-98"
              >
                Assemble Group Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Settings / Admin Manager Modal */}
      {isGroupEditorOpen && selectedChannel && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-slate-800 animate-fade-in">
          <div className="bg-white rounded-3xl p-6.5 max-w-lg w-full shadow-2xl relative flex flex-col max-h-[90vh] border border-slate-100">
            <button 
              onClick={() => setIsGroupEditorOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-650 p-1.5 hover:bg-slate-100 rounded-lg transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-base font-black text-slate-950 mb-5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650">
                <Settings className="w-4 h-4" />
              </div>
              CONFIGURE GROUPCHAT: {selectedChannel.name}
            </h3>

            {/* Scrollable container for complex elements */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar">
              
              {/* Properties Editor */}
              <form onSubmit={handleSaveGroupSettings} className="space-y-4 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xxs">
                <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block">Group Properties</span>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-450 uppercase block mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-455 uppercase block mb-1">Group Brief Description</label>
                  <input
                    type="text"
                    value={editGroupDesc}
                    onChange={(e) => setEditGroupDesc(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-455 uppercase block mb-1">Group Custom Logo Image URL</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/logo-sample.png"
                    value={editGroupLogo}
                    onChange={(e) => setEditGroupLogo(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition duration-200"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] px-4 py-2 rounded-xl transition duration-200 shadow-sm shadow-indigo-600/10 active:scale-97 cursor-pointer"
                >
                  Save Properties
                </button>
              </form>

              {/* Members Admin promotions and removal list */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">MEMBERS & ROLES MANAGEMENT</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {users.map(u => {
                    const isMember = Array.isArray(selectedChannel.memberIds) && selectedChannel.memberIds.includes(u.id);
                    const isAdmin = Array.isArray(selectedChannel.adminIds) && selectedChannel.adminIds.includes(u.id);
                    return (
                      <div key={u.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs hover:border-slate-300 transition duration-200 shadow-xxs">
                        <span className="flex items-center gap-2">
                          <span className={`w-6.5 h-6.5 rounded-full ${u.color} flex items-center justify-center font-bold text-[9px] border border-white shadow-xxs`}>
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-slate-800 font-bold">{u.name}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Toggle membership checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleGroupMembership(u.id)}
                            className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition border cursor-pointer ${
                              isMember 
                                ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isMember ? 'Joined' : 'Add to group'}
                          </button>

                          {/* Toggle Admin checkbox */}
                          {isMember && (
                            <button
                              type="button"
                              onClick={() => handleToggleAdminStatus(u.id)}
                              className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 border cursor-pointer ${
                                isAdmin 
                                  ? 'bg-amber-50 border-amber-100 text-amber-700 shadow-xxs' 
                                  : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              <Crown className={`w-3 h-3 ${isAdmin ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                              {isAdmin ? 'Admin' : 'Make admin'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default ChatEngineView;
