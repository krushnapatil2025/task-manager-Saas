import React, { useContext, useRef, useEffect, useState, useCallback } from 'react';
import {
  LuLoaderCircle, LuRefreshCcw, LuTrash2, LuSmile,
  LuLock, LuHash, LuSettings, LuPencil, LuUsers, LuX,
  LuDownload, LuFileText, LuEye, LuPin, LuMessageSquare, LuSearch,
  LuBookmark, LuSparkles
} from 'react-icons/lu';
import { useChat } from '../hooks/useChat';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import ChatInput from './ChatInput';
import ReactionBar from './ReactionBar';
import ChannelMembersModal from './ChannelMembersModal';
import ThreadPanel from './ThreadPanel';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import SavedMessagesPanel from './SavedMessagesPanel';
import LinkPreviewCard from './LinkPreviewCard';
import { 
  renameRoom, deleteChatRoom, removeRoomMember, uploadFileToGoogleDrive,
  pinMessage, unpinMessage, getRoomPins, saveMessage, unsaveMessage, getSavedMessages
} from '../services/chatService';
import { supabase } from '../utils/supabaseClient';
import { summariseChannelActivity } from '../services/aiService';
import moment from 'moment';
import { toast } from 'react-hot-toast';
import { parseMarkdownAndMentions } from '../utils/markdown';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '✅', '😮', '🎉'];
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#22c55e','#14b8a6'];

const extractUrls = (text) => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

const ChatWindow = ({
  roomId,
  roomName,
  members = [],
  isPrivate = false,
  createdBy = null,
  onRoomUpdated,
  onRoomDeleted,
  onRoomSwitch
}) => {
  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const {
    messages, loading, sending, sendError, typingUsers = {},
    send, remove, edit, react, sendTyping, refresh
  } = useChat(roomId);

  const bottomRef = useRef(null);

  // UI States
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Threads, Pins & Saved Messages State
  const [selectedThreadParent, setSelectedThreadParent] = useState(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roomDetails, setRoomDetails] = useState({ topic: '', description: '' });

  const loadPins = useCallback(async () => {
    if (!roomId) return;
    try {
      const pinsData = await getRoomPins(roomId);
      setPinnedIds(new Set(pinsData.map(p => p.message?.id)));
    } catch (err) {
      console.error('Failed to load pins:', err);
    }
  }, [roomId]);

  const loadSaved = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getSavedMessages(user.id);
      setSavedIds(new Set(data.map(m => m.id)));
    } catch (err) {
      console.error('Failed to load saved messages:', err);
    }
  }, [user?.id]);

  const loadRoomDetails = useCallback(async () => {
    if (!roomId) return;
    try {
      const { data } = await supabase
        .from('chat_rooms')
        .select('topic, description')
        .eq('id', roomId)
        .single();
      if (data) {
        setRoomDetails({
          topic: data.topic || '',
          description: data.description || ''
        });
      } else {
        setRoomDetails({ topic: '', description: '' });
      }
    } catch (err) {
      console.error('Failed to load room details:', err);
    }
  }, [roomId]);

  useEffect(() => {
    loadPins();
    loadSaved();
    loadRoomDetails();
    // Reset thread panel on room change
    setSelectedThreadParent(null);
    setShowPinnedPanel(false);
    setShowSavedPanel(false);
    setSearchQuery('');
  }, [roomId, loadPins, loadSaved, loadRoomDetails]);



  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const toastId = toast.loading(`Uploading "${file.name}" to Google Drive...`);
      try {
        const res = await uploadFileToGoogleDrive(file);
        await send(res.name, res.type, res.url);
        toast.success('File uploaded successfully!', { id: toastId });
      } catch (err) {
        console.error(err);
        toast.error('Failed to upload file.', { id: toastId });
      }
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown on click outside
  useEffect(() => {
    const clickOutside = () => setShowSettingsDropdown(false);
    window.addEventListener('click', clickOutside);
    return () => window.removeEventListener('click', clickOutside);
  }, []);

  if (!roomId) return (
    <div className="chat-window-empty-state">
      <span className="text-5xl mb-3">💬</span>
      <p className="font-semibold text-slate-600">Select a channel or conversation</p>
      <span className="text-sm text-slate-400">Choose from the sidebar to start chatting</span>
    </div>
  );

  const isCreator = createdBy === user?.id;
  const isWorkspaceAdmin = user?.job_profile === 'company_admin';
  const isOwnerOrAdmin = isCreator || isWorkspaceAdmin;
  const isDirectDM = !roomName?.startsWith('#');

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    try {
      await renameRoom(roomId, renameValue);
      setRenaming(false);
      if (onRoomUpdated) onRoomUpdated(renameValue);
    } catch (err) {
      alert(err.message || 'Failed to rename channel.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete this channel? All messages will be permanently lost.')) return;
    try {
      await deleteChatRoom(roomId);
      if (onRoomDeleted) onRoomDeleted();
    } catch (err) {
      alert(err.message || 'Failed to delete channel.');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    try {
      await removeRoomMember(roomId, user.id);
      if (onRoomDeleted) onRoomDeleted();
    } catch (err) {
      alert(err.message || 'Failed to leave channel.');
    }
  };

  const handleAISummarizeChannel = async () => {
    if (!roomId) return;
    const toastId = toast.loading('AI is analyzing the conversation...');
    try {
      // Filter recent messages (last 24 hours)
      const last24hMsgs = messages.filter(m => {
        const ageMs = Date.now() - new Date(m.createdAt).getTime();
        return ageMs < 24 * 60 * 60 * 1000;
      });

      const summary = await summariseChannelActivity(roomName, last24hMsgs, workspace?.id, user?.id);
      await send(summary, 'system');
      toast.success('AI conversation summary generated and posted to channel!', { id: toastId });
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
      toast.error(err.message || 'Failed to generate summary', { id: toastId });
    }
  };

  const handleEditMessageSubmit = async (messageId) => {
    if (!editContent.trim()) return;
    try {
      await edit(messageId, editContent);
      setEditingMessageId(null);
    } catch (err) {
      alert(err.message || 'Failed to edit message.');
    }
  };

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const grouped = groupByDate(filteredMessages);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className="flex-1 chat-window-wrap relative flex flex-col h-full overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-indigo-650/10 backdrop-blur-sm border-2 border-dashed border-indigo-500 rounded-2xl flex flex-col items-center justify-center z-50 pointer-events-none animate-fade-in">
            <div className="bg-white px-6 py-5 rounded-2xl shadow-xl border border-indigo-100 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center animate-bounce">
                <LuFileText size={24} />
              </div>
              <p className="text-sm font-bold text-slate-800">Drop files here to upload</p>
              <p className="text-[11px] text-slate-400">Files will be safely stored in your Google Drive</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="chat-window-header relative">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {!isDirectDM && (
                isPrivate
                  ? <LuLock size={15} className="text-amber-500 flex-shrink-0" />
                  : <LuHash size={16} className="text-slate-400 flex-shrink-0" />
              )}

              {renaming ? (
                <form onSubmit={handleRename} className="flex items-center gap-2">
                  <input
                    className="px-2 py-0.5 border border-slate-200 rounded text-sm focus:outline-indigo-500"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="text-xs bg-indigo-600 text-white px-2 py-1 rounded font-semibold hover:bg-indigo-750">
                    Save
                  </button>
                  <button type="button" className="text-xs text-slate-500 hover:bg-slate-50 px-2 py-1 rounded" onClick={() => setRenaming(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <h2 className="chat-window-title truncate">
                  {roomName?.startsWith('#') ? roomName.substring(2) : roomName || 'Chat'}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-slate-400">
              <span className="chat-window-sub">{filteredMessages.length} messages</span>
              {!isDirectDM && roomDetails.topic && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] text-slate-450 truncate max-w-[160px] sm:max-w-[280px]" title={roomDetails.topic}>
                    {roomDetails.topic}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex items-center bg-slate-100 hover:bg-slate-150/70 border border-slate-200/50 rounded-xl px-2.5 py-1 text-slate-550 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:bg-white focus-within:border-indigo-400 max-w-[120px] sm:max-w-[180px]">
              <LuSearch size={13} className="text-slate-400 mr-1.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-[11px] text-slate-700 w-full placeholder-slate-400"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-655 transition-colors">
                  <LuX size={10} />
                </button>
              )}
            </div>

            {/* AI Summary button */}
            {!isDirectDM && (
              <button 
                className="chat-icon-btn text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                onClick={handleAISummarizeChannel}
                title="AI Channel Summary"
              >
                <LuSparkles size={14} className="fill-indigo-500/10 text-indigo-500" />
              </button>
            )}

            {/* Saved Messages toggle */}
            <button 
              className={`chat-icon-btn ${showSavedPanel ? 'bg-indigo-50 text-indigo-600' : ''}`}
              onClick={() => {
                setShowSavedPanel(prev => !prev);
                setShowPinnedPanel(false);
                setSelectedThreadParent(null);
              }}
              title="Saved Messages / Bookmarks"
            >
              <LuBookmark size={14} className={showSavedPanel ? 'fill-indigo-500/20' : ''} />
            </button>

            {/* Pinned Messages toggle */}
            <button 
              className={`chat-icon-btn ${showPinnedPanel ? 'bg-indigo-50 text-indigo-600' : ''}`}
              onClick={() => {
                setShowPinnedPanel(prev => !prev);
                setShowSavedPanel(false);
                setSelectedThreadParent(null);
              }}
              title="Pinned Messages"
            >
              <LuPin size={14} className={showPinnedPanel ? 'fill-indigo-500/20' : ''} />
            </button>

            <button className="chat-icon-btn" onClick={refresh} title="Refresh">
              <LuRefreshCcw size={14} />
            </button>

            {!isDirectDM && (
              <div className="relative">
                <button
                  className="chat-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsDropdown(prev => !prev);
                  }}
                  title="Channel Options"
              >
                <LuSettings size={14} />
              </button>

              {showSettingsDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowSettingsDropdown(false);
                      setShowMembersModal(true);
                    }}
                  >
                    <LuUsers size={13} className="text-slate-400" />
                    <span>Members & Invites</span>
                  </button>

                  {isOwnerOrAdmin && (
                    <>
                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setRenameValue(roomName?.startsWith('#') ? roomName.substring(2) : roomName);
                          setRenaming(true);
                          setShowSettingsDropdown(false);
                        }}
                      >
                        <LuPencil size={13} className="text-slate-400" />
                        <span>Rename Channel</span>
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-xs text-red-650 hover:bg-red-50 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          handleDelete();
                        }}
                      >
                        <LuTrash2 size={13} className="text-red-400" />
                        <span>Delete Channel</span>
                      </button>
                    </>
                  )}

                  {!isOwnerOrAdmin && (
                    <button
                      className="w-full text-left px-4 py-2 text-xs text-red-650 hover:bg-red-50 transition-colors flex items-center gap-2"
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        handleLeave();
                      }}
                    >
                      <LuX size={13} className="text-red-400" />
                      <span>Leave Channel</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send Error Banner */}
      {sendError && (
        <div className="chat-send-error">
          <span>⚠️ {sendError}</span>
        </div>
      )}

      {/* Message feed */}
      <div className="chat-feed">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LuLoaderCircle className="text-indigo-400 text-3xl animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-feed-empty">
            <span className="text-4xl">👋</span>
            <p>This is the start of <strong>{roomName}</strong></p>
            <span>Send the first message!</span>
          </div>
        ) : (
          Object.entries(grouped).map(([dateKey, dayMsgs]) => (
            <div key={dateKey}>
              {/* Date separator */}
              <div className="chat-date-sep">
                <span>{dateKey}</span>
              </div>

              {dayMsgs.map((msg, i) => {
                const isOwn = msg.senderId === user?.id;
                const prevMsg = dayMsgs[i - 1];
                const isContinued = prevMsg?.senderId === msg.senderId &&
                  (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 5 * 60000;
                const colorIdx = members.findIndex(m => m.id === msg.senderId) % COLORS.length;
                const color = COLORS[Math.max(0, colorIdx)];

                const isEditing = editingMessageId === msg.id;

                if (msg.type === 'system') {
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center my-3 px-4 w-full animate-fade-in">
                      <div className="bg-indigo-50/70 border border-indigo-100/60 rounded-2xl p-4 max-w-2xl text-slate-700 shadow-sm relative group w-full">
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                          <LuSparkles size={12} className="text-indigo-500 fill-indigo-500/20" />
                          <span>AI Channel Summary</span>
                          <span className="text-slate-300 font-normal">•</span>
                          <span className="text-slate-400 font-normal normal-case">{moment(msg.createdAt).format('h:mm A')}</span>
                        </div>
                        <div 
                          className="text-xs leading-relaxed text-slate-650 markdown-summary-content"
                          dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(msg.content) }}
                        />
                        {(isOwn || isOwnerOrAdmin) && (
                          <button 
                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all"
                            onClick={() => remove(msg.id)}
                            title="Delete Summary"
                          >
                            <LuTrash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // Google Drive File Attachment Parsing
                const hasAttachment = !!msg.fileUrl;
                let displayUrl = msg.fileUrl;
                let downloadUrl = msg.fileUrl;
                let fileName = msg.content || 'Attached File';
                let fileSize = '';

                if (hasAttachment && msg.fileUrl.includes('||')) {
                  const parts = msg.fileUrl.split('||');
                  displayUrl = parts[0];
                  downloadUrl = parts[1];
                  fileName = parts[2] || fileName;
                  fileSize = parts[3] || '';
                }

                // Parse preview/view URL dynamically
                let previewUrl = downloadUrl;
                if (downloadUrl) {
                  if (downloadUrl.includes('drive.google.com')) {
                    const match = downloadUrl.match(/[?&]id=([^&]+)/);
                    if (match && match[1]) {
                      previewUrl = `https://drive.google.com/file/d/${match[1]}/view?usp=drivesdk`;
                    }
                  } else if (downloadUrl.includes('tmpfiles.org/dl/')) {
                    previewUrl = downloadUrl.replace('tmpfiles.org/dl/', 'tmpfiles.org/');
                  }
                }

                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`chat-msg group ${isOwn ? 'chat-msg--own' : ''} ${isContinued ? 'chat-msg--continued' : ''} transition-all duration-550 rounded-xl p-0.5`}>
                    {/* Avatar */}
                    {!isOwn && !isContinued && (
                      msg.senderAvatar
                        ? <img src={msg.senderAvatar} alt={msg.senderName} className="chat-msg-av" />
                        : <div className="chat-msg-av chat-msg-av--fallback" style={{ background: color }}>
                            {msg.senderName?.[0]?.toUpperCase()}
                          </div>
                    )}
                    {!isOwn && isContinued && <div className="chat-msg-av-spacer" />}

                    {/* Content */}
                    <div className={`chat-msg-body ${isOwn ? 'chat-msg-body--own' : ''}`}>
                      {pinnedIds.has(msg.id) && (
                        <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold mb-1">
                          <LuPin size={9} className="fill-amber-500 text-amber-500" />
                          <span>Pinned</span>
                        </div>
                      )}
                      {!isContinued && !isOwn && (
                        <div className="chat-msg-meta">
                          <span className="chat-msg-name" style={{ color }}>{msg.senderName}</span>
                          <span className="chat-msg-time">{moment(msg.createdAt).format('h:mm A')}</span>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="flex flex-col gap-1.5 min-w-[200px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <textarea
                            className="w-full text-xs p-1.5 text-slate-800 bg-white border border-slate-200 rounded focus:outline-indigo-500"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleEditMessageSubmit(msg.id);
                              } else if (e.key === 'Escape') {
                                setEditingMessageId(null);
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-semibold hover:bg-indigo-750"
                              onClick={() => handleEditMessageSubmit(msg.id)}
                            >
                              Save
                            </button>
                            <button
                              className="text-[10px] text-slate-500 hover:bg-slate-50 px-2 py-0.5 rounded"
                              onClick={() => setEditingMessageId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Standard Bubble or Attachment Layout
                        <div className="flex flex-col gap-1">
                          {/* Main Text Content (if present or if not a file-only message) */}
                          {(!hasAttachment || (hasAttachment && msg.type !== 'image' && msg.type !== 'file')) && (
                            <>
                              <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : 'chat-bubble--other'}`}>
                                <p className="chat-bubble-text" dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(msg.content) }} />
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  {msg.editedAt && (
                                    <span className="text-[8px] text-slate-400 font-medium italic">Edited</span>
                                  )}
                                  {isOwn && (
                                    <span className="chat-bubble-time">{moment(msg.createdAt).format('h:mm A')}</span>
                                  )}
                                </div>
                              </div>
                              {extractUrls(msg.content).length > 0 && (
                                <div className="flex flex-col gap-2 mt-1 w-full max-w-lg">
                                  {extractUrls(msg.content).map((url, idx) => (
                                    <LinkPreviewCard key={idx} url={url} />
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* Image Attachment Card */}
                          {hasAttachment && msg.type === 'image' && (
                            <div className="chat-image-preview-card shadow-sm border border-slate-200">
                              <img
                                src={downloadUrl || displayUrl}
                                alt={fileName}
                                className="w-full h-auto object-cover max-h-[180px] cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => window.open(previewUrl || downloadUrl || displayUrl, '_blank')}
                                onError={(e) => {
                                  if (downloadUrl && e.target.src !== displayUrl) {
                                    e.target.src = displayUrl;
                                  }
                                }}
                              />
                              <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-slate-700">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold truncate">{fileName}</p>
                                  {fileSize && <p className="text-[8px] text-slate-400">{fileSize}</p>}
                                </div>
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-250 rounded text-indigo-600 transition-colors flex-shrink-0" title="Download from Google Drive">
                                  <LuDownload size={13} />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* General File Attachment Card */}
                          {hasAttachment && msg.type === 'file' && (
                            <div className="chat-file-preview-card shadow-sm flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200">
                              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[9px] flex items-center justify-center uppercase flex-shrink-0 border border-indigo-100 hover:bg-indigo-100 transition-colors" title="View Document">
                                {fileName.split('.').pop()?.substring(0, 4) || 'FILE'}
                              </a>
                              <div className="flex-1 min-w-0 text-slate-700">
                                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold truncate hover:underline hover:text-indigo-600 block">
                                  {fileName}
                                </a>
                                <p className="text-[9px] text-slate-400">{fileSize || 'Document'}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0" title="View/Preview File">
                                  <LuEye size={13} />
                                </a>
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-650 transition-colors flex-shrink-0" title="Download File">
                                  <LuDownload size={13} />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Timestamp below attachments if not owned */}
                          {!isOwn && hasAttachment && (
                            <span className="text-[9px] text-slate-400 mt-0.5">{moment(msg.createdAt).format('h:mm A')}</span>
                          )}
                          {isOwn && hasAttachment && (
                            <span className="text-[9px] text-slate-400 text-right mt-0.5">{moment(msg.createdAt).format('h:mm A')}</span>
                          )}
                        </div>
                      )}

                      {/* Thread Replies Badge */}
                      {msg.replyCount > 0 && (
                        <button
                          onClick={() => {
                            setSelectedThreadParent(msg);
                            setShowPinnedPanel(false);
                          }}
                          className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 p-1 px-2.5 rounded-full transition-colors w-max shadow-sm border border-indigo-100/40"
                        >
                          <LuMessageSquare size={11} className="text-indigo-500" />
                          <span>{msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}</span>
                        </button>
                      )}

                      <ReactionBar
                        messageId={msg.id}
                        reactions={msg.reactions}
                        onReact={react}
                      />

                                  {!isEditing && (
                        <div className="chat-hover-actions opacity-0 group-hover:opacity-100">
                          {QUICK_EMOJIS.slice(0, 4).map(e => (
                            <button key={e} className="chat-hover-emoji"
                              onClick={() => react(msg.id, e)}>{e}</button>
                          ))}

                          {/* Pin Toggle */}
                          <button
                            className="chat-hover-emoji hover:text-amber-500"
                            onClick={async () => {
                              try {
                                if (pinnedIds.has(msg.id)) {
                                  await unpinMessage(roomId, msg.id);
                                  toast.success('Message unpinned!');
                                } else {
                                  await pinMessage(roomId, msg.id, user.id);
                                  toast.success('Message pinned!');
                                }
                                loadPins();
                              } catch (err) {
                                toast.error('Failed to update pin state.');
                              }
                            }}
                            title={pinnedIds.has(msg.id) ? 'Unpin message' : 'Pin message'}
                          >
                            <LuPin size={11} className={pinnedIds.has(msg.id) ? 'fill-amber-500 text-amber-500' : ''} />
                          </button>

                          {/* Bookmark/Save Message Toggle */}
                          <button
                            className="chat-hover-emoji hover:text-indigo-600"
                            onClick={async () => {
                              try {
                                if (savedIds.has(msg.id)) {
                                  await unsaveMessage(user.id, msg.id);
                                  toast.success('Removed from bookmarks');
                                } else {
                                  await saveMessage(user.id, msg.id);
                                  toast.success('Added to bookmarks');
                                }
                                loadSaved();
                              } catch (err) {
                                toast.error('Failed to update bookmark state.');
                              }
                            }}
                            title={savedIds.has(msg.id) ? 'Remove bookmark' : 'Bookmark message'}
                          >
                            <LuBookmark size={11} className={savedIds.has(msg.id) ? 'fill-indigo-600 text-indigo-600' : ''} />
                          </button>

                          {/* Reply in Thread */}
                          <button
                            className="chat-hover-emoji hover:text-indigo-600"
                            onClick={() => {
                              setSelectedThreadParent(msg);
                              setShowPinnedPanel(false);
                              setShowSavedPanel(false);
                            }}
                            title="Reply in Thread"
                          >
                            <LuMessageSquare size={11} />
                          </button>

                          {isOwn && !hasAttachment && (
                            <button
                              className="chat-hover-del hover:text-indigo-600"
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditContent(msg.content);
                              }}
                              title="Edit message"
                            >
                              <LuPencil size={11} />
                            </button>
                          )}
                          {(isOwn || isOwnerOrAdmin) && (
                            <button className="chat-hover-del" onClick={() => remove(msg.id)} title="Delete message">
                              <LuTrash2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicators overlay */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-5 py-1 text-xs text-slate-400 italic bg-white/80 border-t border-slate-100 flex items-center gap-1.5 animate-fade-in flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          <span>
            {Object.values(typingUsers).map(u => u.name).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={send}
        onTyping={sendTyping}
        sending={sending}
        placeholder={`Message ${roomName?.startsWith('#') ? roomName.substring(2) : roomName || '…'}`}
        members={members}
      />

      {showMembersModal && (
        <ChannelMembersModal
          roomId={roomId}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onClose={() => setShowMembersModal(false)}
        />
      )}
    </div>

      {selectedThreadParent && (
        <ThreadPanel
          roomId={roomId}
          parentMessage={selectedThreadParent}
          onClose={() => setSelectedThreadParent(null)}
          user={user}
          members={members}
        />
      )}

      {showPinnedPanel && (
        <PinnedMessagesPanel
          roomId={roomId}
          onClose={() => setShowPinnedPanel(false)}
          onJumpToMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
              setTimeout(() => {
                el.classList.remove('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
              }, 2500);
            }
          }}
        />
      )}

      {showSavedPanel && (
        <SavedMessagesPanel
          userId={user?.id}
          currentRoomId={roomId}
          onClose={() => setShowSavedPanel(false)}
          onJumpToMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
              setTimeout(() => {
                el.classList.remove('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
              }, 2500);
            }
          }}
          onSwitchRoom={(targetRoomId, targetRoomName) => {
            if (onRoomSwitch) {
              onRoomSwitch(targetRoomId, targetRoomName);
            } else {
              toast.info(`Switched to channel: #${targetRoomName}`);
            }
          }}
        />
      )}
    </div>
  );
};

// Group messages by date label
const groupByDate = (messages) => {
  const groups = {};
  messages.forEach(m => {
    const d = moment(m.createdAt);
    const key = d.isSame(moment(), 'day')
      ? 'Today'
      : d.isSame(moment().subtract(1, 'day'), 'day')
        ? 'Yesterday'
        : d.format('MMMM D, YYYY');
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
};

export default ChatWindow;
