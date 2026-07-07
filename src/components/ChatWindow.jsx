import React, { useContext, useRef, useEffect, useState, useCallback } from 'react';
import {
  LuLoaderCircle, LuRefreshCcw, LuTrash2, LuSmile,
  LuLock, LuHash, LuSettings, LuPencil, LuUsers, LuX,
  LuDownload, LuFileText, LuEye, LuPin, LuMessageSquare, LuSearch,
  LuBookmark, LuSparkles, LuForward, LuBell, LuBellOff, LuInfo, LuLink,
  LuClock, LuReply, LuEllipsis, LuMenu, LuArrowLeft
} from 'react-icons/lu';
import { useChat } from '../hooks/useChat';
import { UserContext } from '../context/userContext';
import StatusPickerModal from './StatusPickerModal';
import { updateProfile } from '../services/userService';
import { WorkspaceContext } from '../context/WorkspaceContext';
import ChatInput from './ChatInput';
import ReactionBar from './ReactionBar';
import FullEmojiPicker from './FullEmojiPicker';
import ChannelMembersModal from './ChannelMembersModal';
import ThreadPanel from './ThreadPanel';
import MessageForwardModal from './MessageForwardModal';
import PollCreateModal from './PollCreateModal';
import PollMessage from './PollMessage';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import SavedMessagesPanel from './SavedMessagesPanel';
import ScheduledMessagesPanel from './ScheduledMessagesPanel';
import LinkPreviewCard from './LinkPreviewCard';
import UserAvatarWithCard from './UserAvatarWithCard';
import {
  renameRoom, deleteChatRoom, removeRoomMember, uploadFileToGoogleDrive,
  pinMessage, unpinMessage, getRoomPins, saveMessage, unsaveMessage, getSavedMessages,
  getNotificationPreference, updateNotificationPreference, sendScheduledMessage,
  activeBlobUrls
} from '../services/chatService';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import ChannelInfoPanel from './ChannelInfoPanel';
import { exportChatHistoryJSON, exportChatHistoryCSV } from '../services/exportService';
import { supabase } from '../utils/supabaseClient';
import { summariseChannelActivity } from '../services/aiService';
import moment from 'moment';
import { toast } from 'react-hot-toast';
import { parseMarkdownAndMentions } from '../utils/markdown';
import VoiceMessageBubble from './VoiceMessageBubble';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '✅', '😮', '🎉'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#14b8a6'];

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
  onRoomSwitch,
  onBack
}) => {
  const { user, updateUser } = useContext(UserContext);
  const { workspace, onlineUsers } = useContext(WorkspaceContext);
  const isDirectDM = !roomName?.startsWith('#');
  const {
    messages, loading, sending, sendError, typingUsers = {},
    send, remove, edit, react, markRead, sendTyping, refresh,
    hasMore, loadingMore, loadMore,
    removeForMe, removeForEveryone
  } = useChat(roomId);

  // WhatsApp-style delete confirmation: stores the message to be deleted
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null);

  const bottomRef = useRef(null);
  const feedRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Read message observer state
  const observedRefs = useRef({});
  const readObserver = useRef(null);

  // Phase 3 Features States
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [showNotificationPrefsModal, setShowNotificationPrefsModal] = useState(false);
  const [notificationLevel, setNotificationLevel] = useState('all');
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // UI States
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [activeReactMessageId, setActiveReactMessageId] = useState(null);

  // Threads, Pins, Saved & Scheduled Messages State
  const [selectedThreadParent, setSelectedThreadParent] = useState(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);
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
    setShowInfoPanel(false);
    setSearchQuery('');
    setActiveMenuMessageId(null);
    setActiveReactMessageId(null);
  }, [roomId, loadPins, loadSaved, loadRoomDetails]);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    const fetchPref = async () => {
      try {
        const level = await getNotificationPreference(user.id, roomId);
        setNotificationLevel(level);
      } catch (err) {
        console.error('Failed to fetch notification preference:', err);
      }
    };
    fetchPref();
  }, [roomId, user?.id]);

  const handleSaveNotificationPreference = async (level) => {
    try {
      await updateNotificationPreference(user.id, roomId, level);
      setNotificationLevel(level);
      toast.success('Notification preferences saved!');
    } catch (err) {
      toast.error('Failed to save notification preferences.');
    } finally {
      setShowNotificationPrefsModal(false);
    }
  };

  // Deep Link scrolling & highlight effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msgId = params.get('msg');
    if (!msgId || loading || messages.length === 0) return;

    const scrollToTarget = () => {
      const el = document.getElementById(`msg-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
        setTimeout(() => {
          el.classList.remove('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
        }, 3000);
      }
    };

    const timer = setTimeout(scrollToTarget, 400);
    return () => clearTimeout(timer);
  }, [loading, messages, roomId]);



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

  // Set up intersection observer on bottomRef to detect if user has scrolled up
  useEffect(() => {
    const feedEl = feedRef.current;
    const bottomEl = bottomRef.current;
    if (!feedEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      {
        root: feedEl,
        threshold: 0.05,
      }
    );

    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [roomId, messages]);

  // Intersection Observer to mark incoming messages as read
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const feedEl = feedRef.current;
    if (!feedEl) return;

    readObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
              markRead(messageId);
              // Unobserve immediately after marking read
              if (readObserver.current) {
                readObserver.current.unobserve(entry.target);
              }
              delete observedRefs.current[messageId];
            }
          }
        });
      },
      {
        root: feedEl,
        threshold: 0.1,
      }
    );

    return () => {
      if (readObserver.current) {
        readObserver.current.disconnect();
      }
    };
  }, [roomId, user?.id, markRead]);

  // Auto-scroll on new messages only if already at the bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-scroll to bottom instantly on fresh room load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [roomId]);

  // Scroll-to-top detection: trigger loadMore when user reaches top 100px
  useEffect(() => {
    const feedEl = feedRef.current;
    if (!feedEl) return;

    const handleScrollForPagination = () => {
      if (feedEl.scrollTop < 100 && hasMore && !loadingMore && !loading) {
        // Preserve scroll position after prepend
        const prevScrollHeight = feedEl.scrollHeight;
        loadMore().then(() => {
          // After state updates, adjust scroll to keep viewport stable
          requestAnimationFrame(() => {
            feedEl.scrollTop = feedEl.scrollHeight - prevScrollHeight;
          });
        });
      }
    };

    feedEl.addEventListener('scroll', handleScrollForPagination, { passive: true });
    return () => feedEl.removeEventListener('scroll', handleScrollForPagination);
  }, [hasMore, loadingMore, loading, loadMore]);

  // Close dropdown on click outside
  useEffect(() => {
    const clickOutside = () => setShowMoreMenu(false);
    window.addEventListener('click', clickOutside);
    return () => window.removeEventListener('click', clickOutside);
  }, []);

  // Close message dropdowns and reaction popovers on scroll or click outside
  useEffect(() => {
    if (activeMenuMessageId === null && activeReactMessageId === null) return;

    const handleOutsideClick = (e) => {
      const isDropdownClick = e.target.closest('.chat-msg-more-btn') || 
                              e.target.closest('.chat-hover-emoji') || 
                              e.target.closest('.chat-quick-react-bar') || 
                              e.target.closest('.chat-quick-react-add') || 
                              e.target.closest('.chat-emoji-picker') || 
                              e.target.closest('.chat-msg-more-dropdown');
      if (!isDropdownClick) {
        setActiveMenuMessageId(null);
        setActiveReactMessageId(null);
      }
    };

    const handleScroll = () => {
      setActiveMenuMessageId(null);
      setActiveReactMessageId(null);
    };

    const feedEl = feedRef.current;
    if (feedEl) {
      feedEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    document.addEventListener('click', handleOutsideClick, { capture: true });

    return () => {
      if (feedEl) {
        feedEl.removeEventListener('scroll', handleScroll);
      }
      document.removeEventListener('click', handleOutsideClick, { capture: true });
    };
  }, [activeMenuMessageId, activeReactMessageId]);

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
              {onBack && (
                <button
                  onClick={onBack}
                  className="md:hidden mr-1.5 p-1 rounded-lg text-slate-555 hover:text-slate-755 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer flex-shrink-0"
                  aria-label="Back to conversations list"
                >
                  <LuArrowLeft size={16} />
                </button>
              )}
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

            {/* Soft Refresh Button */}
            <button
              className={`chat-icon-btn text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors p-2 rounded-xl flex items-center justify-center ${loading ? 'animate-spin' : ''}`}
              onClick={refresh}
              title="Soft Refresh Chat"
            >
              <LuRefreshCcw size={14} />
            </button>



            {/* Unified Actions Dropdown Menu (Three Dashes) */}
            <div className="relative">
              <button
                className={`chat-icon-btn ${showMoreMenu ? 'bg-slate-150 text-slate-800' : 'text-slate-500'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(prev => !prev);
                }}
                title="More Options"
              >
                <LuMenu size={16} />
              </button>

              {showMoreMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* General Features */}
                  <button
                    className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${showSavedPanel
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-semibold'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowSavedPanel(prev => !prev);
                      setShowPinnedPanel(false);
                      setShowScheduledPanel(false);
                      setSelectedThreadParent(null);
                    }}
                  >
                    <LuBookmark size={13} className={showSavedPanel ? 'text-indigo-500' : 'text-slate-400'} />
                    <span>Saved Messages</span>
                  </button>

                  <button
                    className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${showPinnedPanel
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-semibold'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowPinnedPanel(prev => !prev);
                      setShowSavedPanel(false);
                      setShowScheduledPanel(false);
                      setSelectedThreadParent(null);
                    }}
                  >
                    <LuPin size={13} className={showPinnedPanel ? 'text-indigo-500' : 'text-slate-400'} />
                    <span>Pinned Messages</span>
                  </button>

                  <button
                    className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${showScheduledPanel
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-semibold'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowScheduledPanel(prev => !prev);
                      setShowSavedPanel(false);
                      setShowPinnedPanel(false);
                      setSelectedThreadParent(null);
                    }}
                  >
                    <LuClock size={13} className={showScheduledPanel ? 'text-indigo-500' : 'text-slate-400'} />
                    <span>Scheduled Messages</span>
                  </button>

                  <button
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowMoreMenu(false);
                      refresh();
                    }}
                  >
                    <LuRefreshCcw size={13} className="text-slate-400" />
                    <span>Refresh Chat</span>
                  </button>

                  {/* Channel-Specific Features (Non-DM) */}
                  {!isDirectDM && (
                    <>
                      <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

                      <button
                        className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${showInfoPanel
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-semibold'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                          }`}
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowInfoPanel(prev => !prev);
                          setShowSavedPanel(false);
                          setShowPinnedPanel(false);
                          setShowScheduledPanel(false);
                          setSelectedThreadParent(null);
                        }}
                      >
                        <LuInfo size={13} className={showInfoPanel ? 'text-indigo-500' : 'text-slate-400'} />
                        <span>Channel Details</span>
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowNotificationPrefsModal(true);
                        }}
                      >
                        <LuBell size={13} className="text-slate-400" />
                        <span>Notifications Level ({notificationLevel})</span>
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowMoreMenu(false);
                          handleAISummarizeChannel();
                        }}
                      >
                        <LuSparkles size={13} className="text-indigo-505" />
                        <span>Generate AI Summary</span>
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowMembersModal(true);
                        }}
                      >
                        <LuUsers size={13} className="text-slate-400" />
                        <span>Members & Invites</span>
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        onClick={async () => {
                          setShowMoreMenu(false);
                          try {
                            await exportChatHistoryJSON(roomId, roomName);
                            toast.success('Chat history exported as JSON!');
                          } catch (err) {
                            toast.error('Failed to export chat history.');
                          }
                        }}
                      >
                        <LuFileText size={13} className="text-slate-400" />
                        <span>Export as JSON</span>
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        onClick={async () => {
                          setShowMoreMenu(false);
                          try {
                            await exportChatHistoryCSV(roomId, roomName);
                            toast.success('Chat history exported as CSV!');
                          } catch (err) {
                            toast.error('Failed to export chat history.');
                          }
                        }}
                      >
                        <LuDownload size={13} className="text-slate-400" />
                        <span>Export as CSV</span>
                      </button>

                      <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

                      {isOwnerOrAdmin ? (
                        <>
                          <button
                            className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                            onClick={() => {
                              setShowMoreMenu(false);
                              setRenameValue(roomName?.startsWith('#') ? roomName.substring(2) : roomName);
                              setRenaming(true);
                            }}
                          >
                            <LuPencil size={13} className="text-slate-400" />
                            <span>Rename Channel</span>
                          </button>
                          <button
                            className="w-full text-left px-4 py-2 text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors flex items-center gap-2"
                            onClick={() => {
                              setShowMoreMenu(false);
                              handleDelete();
                            }}
                          >
                            <LuTrash2 size={13} className="text-red-500" />
                            <span className="font-semibold">Delete Channel</span>
                          </button>
                        </>
                      ) : (
                        <button
                          className="w-full text-left px-4 py-2 text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors flex items-center gap-2"
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleLeave();
                          }}
                        >
                          <LuX size={13} className="text-red-500" />
                          <span className="font-semibold">Leave Channel</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Shipped User Profile in Top Bar Right Side */}
            <div
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-2 pl-2.5 border-l border-slate-200/60 dark:border-zinc-800/80 cursor-pointer hover:opacity-85 transition-opacity"
              title="Set status / Profile details"
            >
              <div className="relative flex-shrink-0">
                {user?.profile_image_url ? (
                  <img src={user.profile_image_url} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-650 text-white font-extrabold text-[11px] flex items-center justify-center">
                    {(user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${user?.dnd_until && new Date(user.dnd_until) > new Date()
                    ? 'bg-rose-500'
                    : 'bg-emerald-400'
                  }`} />
              </div>
              <div className="hidden md:flex flex-col text-left min-w-0 max-w-[90px]">
                <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 truncate">{user?.name}</span>
                {user?.status_text ? (
                  <span className="text-[9px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-0.5">
                    <span>{user.status_emoji || '🟢'}</span>
                    <span className="italic">"{user.status_text}"</span>
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 truncate">Set status...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Send Error Banner */}
        {sendError && (
          <div className="chat-send-error">
            <span>⚠️ {sendError}</span>
          </div>
        )}


        {/* Message feed */}
        <div ref={feedRef} className="chat-feed">
          {/* ── Top pagination zone ─────────────────────────────────────── */}
          {loadingMore && (
            <div className="flex flex-col gap-2.5 px-4 py-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex items-start gap-2.5 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-800 flex-shrink-0" />
                  <div className="flex flex-col gap-1.5" style={{ maxWidth: '60%' }}>
                    <div className="h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800" style={{ width: `${60 + i * 20}px` }} />
                    <div className="h-8 rounded-xl bg-slate-100 dark:bg-zinc-900" style={{ width: `${120 + i * 30}px` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Show when all history has been loaded */}
          {!hasMore && !loading && messages.length > 0 && !loadingMore && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-800" />
              <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-600 whitespace-nowrap">
                📜 Beginning of conversation history
              </span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-800" />
            </div>
          )}
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
                  const isNearTop = messages.findIndex(m => m.id === msg.id) < 3;


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

                  const hasBeenRead = msg.reads?.some(r => r.user_id === user?.id);
                  const readRefCallback = (!isOwn && !hasBeenRead) ? (el) => {
                    if (el && readObserver.current) {
                      el.dataset.messageId = msg.id;
                      readObserver.current.observe(el);
                      observedRefs.current[msg.id] = el;
                    }
                  } : undefined;

                  const getReadersNames = (msgReads) => {
                    if (!msgReads || msgReads.length === 0) return '';
                    return msgReads
                      .map(r => {
                        const m = members.find(item => item.id === r.user_id);
                        return m ? (m.name || m.fullName) : null;
                      })
                      .filter(Boolean)
                      .join(', ');
                  };

                  const readByOthers = msg.reads?.some(r => r.user_id !== user?.id);

                  if (msg.type === 'poll') {
                    return (
                      <div key={msg.id} id={`msg-${msg.id}`} ref={readRefCallback} className={`chat-msg ${isOwn ? 'chat-msg--own' : ''} ${isContinued ? 'chat-msg--continued' : ''} transition-all duration-550 rounded-xl p-0.5`}>
                        {/* Avatar */}
                        {!isOwn && !isContinued && (
                          <UserAvatarWithCard
                            userId={msg.senderId}
                            userName={msg.senderName}
                            userAvatar={msg.senderAvatar}
                            onlineUsers={onlineUsers}
                            fallbackStyle={{ background: color }}
                          />
                        )}
                        {!isOwn && isContinued && <div className="chat-msg-av-spacer" />}

                        {/* Content */}
                        <div className={`chat-msg-body ${isOwn ? 'chat-msg-body--own' : ''}`}>
                          {!isContinued && !isOwn && (
                            <div className="chat-msg-meta mb-1">
                              <span className="chat-msg-name" style={{ color }}>{msg.senderName}</span>
                              <span className="chat-msg-time">{moment(msg.createdAt).format('h:mm A')}</span>
                            </div>
                          )}

                          <PollMessage
                            message={msg}
                            userId={user?.id}
                            onVote={async (updatedContent) => {
                              await edit(msg.id, updatedContent);
                            }}
                          />

                          {/* Poll Footer - read receipts & time */}
                          <div className="flex items-center gap-1.5 mt-1 justify-end w-full max-w-sm px-1">
                            <span className="text-[9px] text-slate-400">{moment(msg.createdAt).format('h:mm A')}</span>
                            {isOwn && (
                              isDirectDM ? (
                                readByOthers ? (
                                  <span className="text-[9.5px] text-sky-500 font-bold leading-none select-none ml-0.5" title="Read">✓✓</span>
                                ) : (
                                  <span className="text-[9.5px] text-slate-400 font-bold leading-none select-none ml-0.5" title="Delivered">✓</span>
                                )
                              ) : (
                                msg.reads?.length > 0 && (
                                  <span className="text-[8px] text-slate-500 font-semibold select-none ml-0.5" title={`Seen by: ${getReadersNames(msg.reads)}`}>
                                    👀 {msg.reads.length}
                                  </span>
                                )
                              )
                            )}
                          </div>
                        </div>

                        {/* Hover Action Menu for Polls */}
                        <div className={`chat-msg-actions opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-1.5 flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-md gap-0.5 z-20`}>
                          {/* Forward Poll */}
                          <button
                            className="chat-hover-emoji hover:text-indigo-650"
                            onClick={() => setForwardingMessage(msg)}
                            title="Forward poll"
                          >
                            <LuForward size={11} />
                          </button>

                          {/* Delete Poll */}
                          {(isOwn || isOwnerOrAdmin) && (
                            <button className="chat-hover-del" onClick={() => remove(msg.id)} title="Delete poll">
                              <LuTrash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── Soft-deleted message (WhatsApp-style) ────────────────
                  if (msg.isDeleted) {
                    return (
                      <div key={msg.id} id={`msg-${msg.id}`} className={`chat-msg ${isOwn ? 'chat-msg--own' : ''} ${isContinued ? 'chat-msg--continued' : ''}`}>
                        {!isOwn && !isContinued && <div className="chat-msg-av-spacer" />}
                        {!isOwn && isContinued && <div className="chat-msg-av-spacer" />}
                        <div className={`chat-msg-body ${isOwn ? 'chat-msg-body--own' : ''}`}>
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 bg-slate-50 dark:bg-zinc-900/60 italic text-slate-400 dark:text-zinc-500 text-[11px] max-w-xs select-none">
                            <LuTrash2 size={11} className="flex-shrink-0 opacity-60" />
                            <span>This message was deleted</span>
                          </div>
                          <span className="text-[9px] text-slate-350 dark:text-zinc-600 mt-0.5 block text-right">
                            {moment(msg.createdAt).format('h:mm A')}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} ref={readRefCallback} className={`chat-msg ${isOwn ? 'chat-msg--own' : ''} ${isContinued ? 'chat-msg--continued' : ''} transition-all duration-550 rounded-xl p-0.5`}>
                      {/* Avatar */}
                      {!isOwn && !isContinued && (
                        <UserAvatarWithCard
                          userId={msg.senderId}
                          userName={msg.senderName}
                          userAvatar={msg.senderAvatar}
                          onlineUsers={onlineUsers}
                          fallbackStyle={{ background: color }}
                        />
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
                            {/* Quoted Message Preview block (WhatsApp style) */}
                            {msg.replyTo && (
                              <div
                                className={`text-[10px] p-2 rounded-lg border-l-2 bg-slate-100/60 mb-1 cursor-pointer max-w-sm hover:bg-slate-200/50 transition-colors border-indigo-500 text-slate-700`}
                                onClick={() => {
                                  const el = document.getElementById(`msg-${msg.replyTo.id}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
                                    setTimeout(() => {
                                      el.classList.remove('bg-indigo-50/85', 'ring-2', 'ring-indigo-500/20');
                                    }, 2000);
                                  }
                                }}
                              >
                                <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5 text-indigo-650">
                                  {msg.replyTo.senderName}
                                </span>
                                <span className="truncate block">
                                  {msg.replyTo.content}
                                </span>
                              </div>
                            )}

                            {/* Voice Message Bubble (Audio type) */}
                            {msg.type === 'audio' ? (
                              <VoiceMessageBubble fileUrl={msg.fileUrl} isOwn={isOwn} />
                            ) : (
                              <>
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
                                          <div className="flex items-center gap-0.5 justify-end">
                                            <span className="chat-bubble-time">{moment(msg.createdAt).format('h:mm A')}</span>
                                            {isDirectDM ? (
                                              readByOthers ? (
                                                <span className="text-[9.5px] text-sky-305 font-bold leading-none select-none ml-0.5" title="Read">✓✓</span>
                                              ) : (
                                                <span className="text-[9.5px] text-white/50 font-bold leading-none select-none ml-0.5" title="Delivered">✓</span>
                                              )
                                            ) : (
                                              msg.reads?.length > 0 && (
                                                <span className="text-[8px] text-white/70 font-semibold select-none ml-0.5" title={`Seen by: ${getReadersNames(msg.reads)}`}>
                                                  👀 {msg.reads.length}
                                                </span>
                                              )
                                            )}
                                          </div>
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
                                      const isBlob = displayUrl.startsWith('blob:');
                                      if (!isBlob || activeBlobUrls.has(displayUrl)) {
                                        e.target.src = displayUrl;
                                      }
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
                              <div className="flex items-center gap-1 justify-end mt-0.5 w-full">
                                <span className="text-[9px] text-slate-400">{moment(msg.createdAt).format('h:mm A')}</span>
                                {isDirectDM ? (
                                  readByOthers ? (
                                    <span className="text-[9.5px] text-sky-500 font-bold leading-none select-none" title="Read">✓✓</span>
                                  ) : (
                                    <span className="text-[9.5px] text-slate-400 font-bold leading-none select-none" title="Delivered">✓</span>
                                  )
                                ) : (
                                  msg.reads?.length > 0 && (
                                    <span className="text-[8px] text-slate-500 font-semibold select-none" title={`Seen by: ${getReadersNames(msg.reads)}`}>
                                      👀 {msg.reads.length}
                                    </span>
                                  )
                                )}
                              </div>
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
                          reactionsList={msg.reactionsList}
                          currentUserId={user?.id}
                          onReact={react}
                        />

                        {/* ── Always-visible Forward button (WhatsApp style) ── */}
                        {!isEditing && (
                          <button
                            className="chat-msg-forward-btn"
                            title="Forward"
                            onClick={() => setForwardingMessage(msg)}
                          >
                            <LuForward size={13} />
                          </button>
                        )}

                        {/* ── Always-visible More Actions (three-dots) button ── */}
                        {!isEditing && (
                          <button
                            className={`chat-msg-more-btn${activeMenuMessageId === msg.id ? ' is-open' : ''}`}
                            title="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMessageId(prev => prev === msg.id ? null : msg.id);
                              setActiveReactMessageId(null);
                            }}
                          >
                            <LuEllipsis size={13} />
                          </button>
                        )}

                        {!isEditing && (
                          <div
                            className={`chat-hover-actions${(activeReactMessageId === msg.id || activeReactMessageId === `full-${msg.id}`) ? ' is-active' : ''}`}
                          >

                            {/* ── Emoji Reaction trigger ── */}
                            <button
                              className="chat-hover-emoji"
                              title="React"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactMessageId(prev => prev === msg.id ? null : msg.id);
                                setActiveMenuMessageId(null);
                              }}
                            >
                              <LuSmile size={13} />
                            </button>

                            {/* ── Quick-reaction popover ── */}
                            {activeReactMessageId === msg.id && !activeMenuMessageId && (
                              <div
                                className={`absolute z-50 ${isNearTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isOwn ? 'left-0' : 'right-0'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="chat-quick-react-bar">
                                  {QUICK_EMOJIS.map(e => (
                                    <button
                                      key={e}
                                      className="chat-quick-react-btn"
                                      onClick={() => { react(msg.id, e); setActiveReactMessageId(null); }}
                                      title={e}
                                    >
                                      {e}
                                    </button>
                                  ))}
                                  <button
                                    className="chat-quick-react-add"
                                    title="More reactions"
                                    onClick={(ev) => { ev.stopPropagation(); setActiveReactMessageId(`full-${msg.id}`); }}
                                  >
                                    <LuSmile size={14} />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ── Full emoji picker ── */}
                            {activeReactMessageId === `full-${msg.id}` && (
                              <div
                                className={`absolute z-50 ${isNearTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isOwn ? 'left-0' : 'right-0'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FullEmojiPicker
                                  onSelect={(emoji) => { react(msg.id, emoji); setActiveReactMessageId(null); }}
                                  onClose={() => setActiveReactMessageId(null)}
                                />
                              </div>
                            )}

                          </div>
                        )}

                        {/* ── More-actions dropdown (anchored to the always-visible ⋯ button) ── */}
                        {!isEditing && activeMenuMessageId === msg.id && (
                          <div
                            className={`chat-msg-more-dropdown absolute z-50 ${isNearTop ? 'top-8' : 'bottom-8'} w-44 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl shadow-xl py-1 overflow-hidden animate-fade-in-up ${isOwn ? 'right-0' : 'left-0'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                              {/* Reply Quote */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setActiveMenuMessageId(null);
                                  setReplyingToMessage(msg);
                                  setTimeout(() => document.getElementById('chat-main-input')?.focus(), 50);
                                }}
                              >
                                <LuReply size={13} className="text-slate-400" />
                                <span>Reply</span>
                              </button>

                              {/* Reply in Thread */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setActiveMenuMessageId(null);
                                  setSelectedThreadParent(msg);
                                  setShowPinnedPanel(false);
                                  setShowSavedPanel(false);
                                }}
                              >
                                <LuMessageSquare size={13} className="text-slate-400" />
                                <span>Reply in Thread</span>
                              </button>

                              {/* Forward */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setActiveMenuMessageId(null);
                                  setForwardingMessage(msg);
                                }}
                              >
                                <LuForward size={13} className="text-slate-400" />
                                <span>Forward</span>
                              </button>

                              {/* Pin / Unpin */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={async () => {
                                  setActiveMenuMessageId(null);
                                  try {
                                    if (pinnedIds.has(msg.id)) {
                                      await unpinMessage(roomId, msg.id);
                                      toast.success('Message unpinned!');
                                    } else {
                                      await pinMessage(roomId, msg.id, user.id);
                                      toast.success('Message pinned!');
                                    }
                                    loadPins();
                                  } catch { toast.error('Failed to update pin state.'); }
                                }}
                              >
                                <LuPin size={13} className={pinnedIds.has(msg.id) ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                                <span>{pinnedIds.has(msg.id) ? 'Unpin' : 'Pin'}</span>
                              </button>

                              {/* Save / Unsave */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={async () => {
                                  setActiveMenuMessageId(null);
                                  try {
                                    if (savedIds.has(msg.id)) {
                                      await unsaveMessage(user.id, msg.id);
                                      toast.success('Removed from bookmarks');
                                    } else {
                                      await saveMessage(user.id, msg.id);
                                      toast.success('Added to bookmarks');
                                    }
                                    loadSaved();
                                  } catch { toast.error('Failed to update bookmark state.'); }
                                }}
                              >
                                <LuBookmark size={13} className={savedIds.has(msg.id) ? 'fill-indigo-500 text-indigo-500' : 'text-slate-400'} />
                                <span>{savedIds.has(msg.id) ? 'Unsave' : 'Save'}</span>
                              </button>

                              {/* Copy Link */}
                              <button
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setActiveMenuMessageId(null);
                                  navigator.clipboard.writeText(`${window.location.origin}/chat?room=${roomId}&msg=${msg.id}`);
                                  toast.success('Deep link copied!');
                                }}
                              >
                                <LuLink size={13} className="text-slate-400" />
                                <span>Copy link</span>
                              </button>

                              {/* Edit */}
                              {isOwn && !hasAttachment && (
                                <button
                                  className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                  onClick={() => {
                                    setActiveMenuMessageId(null);
                                    setEditingMessageId(msg.id);
                                    setEditContent(msg.content);
                                  }}
                                >
                                  <LuPencil size={13} className="text-slate-400" />
                                  <span>Edit</span>
                                </button>
                              )}

                               {/* Delete — WhatsApp-style */}
                               {(isOwn || isOwnerOrAdmin) && (
                                 <button
                                   className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-zinc-800 mt-1 pt-1.5"
                                   onClick={() => {
                                     setActiveMenuMessageId(null);
                                     setDeleteConfirmMsg(msg);
                                   }}
                                 >
                                   <LuTrash2 size={13} className="text-rose-500" />
                                   <span>Delete</span>
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

        {/* Floating Jump to Bottom Button */}
        {!isAtBottom && messages.length > 0 && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-indigo-650/95 hover:bg-indigo-750 text-white px-4 py-2 rounded-full shadow-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 z-40 border border-white/10 backdrop-blur-sm cursor-pointer animate-fade-in-up"
          >
            <span>Jump to bottom</span>
            <span className="text-[12px] font-extrabold">↓</span>
          </button>
        )}

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
          onSend={async (content, type = 'text', fileUrl = null) => {
            await send(content, type, fileUrl, replyingToMessage?.id);
            setReplyingToMessage(null);
          }}
          onScheduleSend={async (content, type, fileUrl, scheduledAt) => {
            await sendScheduledMessage(roomId, user?.id, content, type, fileUrl, replyingToMessage?.id, scheduledAt);
            setReplyingToMessage(null);
            toast.success('Message scheduled successfully!');
          }}
          onTyping={sendTyping}
          sending={sending}
          placeholder={`Message ${roomName?.startsWith('#') ? roomName.substring(2) : roomName || '…'}`}
          members={members}
          replyingToMessage={replyingToMessage}
          onClearReply={() => setReplyingToMessage(null)}
          onPollClick={() => setShowPollCreate(true)}
        />

        {showMembersModal && (
          <ChannelMembersModal
            roomId={roomId}
            isOwnerOrAdmin={isOwnerOrAdmin}
            onClose={() => setShowMembersModal(false)}
          />
        )}

        {/* Phase 3 feature modals */}
        {forwardingMessage && (
          <MessageForwardModal
            message={forwardingMessage}
            currentRoomName={roomName}
            onClose={() => setForwardingMessage(null)}
          />
        )}

        {showPollCreate && (
          <PollCreateModal
            onSubmit={async (pollJsonString) => {
              setShowPollCreate(false);
              await send(pollJsonString, 'poll');
            }}
            onClose={() => setShowPollCreate(false)}
          />
        )}

        {showNotificationPrefsModal && (
          <NotificationPreferencesModal
            roomName={roomName}
            initialLevel={notificationLevel}
            onSave={handleSaveNotificationPreference}
            onClose={() => setShowNotificationPrefsModal(false)}
          />
        )}

        {showStatusModal && (
          <StatusPickerModal
            userProfile={{
              statusEmoji: user?.status_emoji,
              statusText: user?.status_text,
              statusExpiresAt: user?.status_expires_at,
              dndUntil: user?.dnd_until,
            }}
            onSave={async (updates) => {
              try {
                await updateProfile(user.id, updates);
                await updateUser();
                toast.success('Status updated successfully!');
              } catch (err) {
                toast.error('Failed to update status.');
              } finally {
                setShowStatusModal(false);
              }
            }}
            onClose={() => setShowStatusModal(false)}
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
          onlineUsers={onlineUsers}
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

      {showInfoPanel && !isDirectDM && (
        <ChannelInfoPanel
          roomId={roomId}
          roomName={roomName}
          roomDetails={{
            ...roomDetails,
            created_at: roomDetails?.created_at
          }}
          members={members}
          createdBy={createdBy}
          onClose={() => setShowInfoPanel(false)}
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

      {showScheduledPanel && (
        <ScheduledMessagesPanel
          userId={user?.id}
          roomId={roomId}
          onClose={() => setShowScheduledPanel(false)}
        />
      )}

      {/* ── WhatsApp-style Delete Confirmation Modal ──────────────────── */}
      {deleteConfirmMsg && (
        <div
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setDeleteConfirmMsg(null)}
        >
          <div
            className="w-full sm:w-auto sm:min-w-[320px] bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/50 dark:border-zinc-800 overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0">
                  <LuTrash2 size={16} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Delete message?</h3>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Choose who to delete it for</p>
                </div>
              </div>
              {/* Message preview */}
              <div className="mt-3 px-3 py-2 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800/80">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate italic">
                  {deleteConfirmMsg.content ? `"${deleteConfirmMsg.content.slice(0, 80)}${deleteConfirmMsg.content.length > 80 ? '…' : ''}"` : '📎 Attachment'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col p-3 gap-2">
              {/* Delete for Me — always available */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-left group"
                onClick={() => {
                  removeForMe(deleteConfirmMsg.id);
                  setDeleteConfirmMsg(null);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
                  <span className="text-sm">🙈</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Delete for Me</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">Only you won't see this message</p>
                </div>
              </button>

              {/* Delete for Everyone — ONLY the original message sender */}
              {deleteConfirmMsg.senderId === user?.id && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left group"
                  onClick={async () => {
                    await removeForEveryone(deleteConfirmMsg.id);
                    setDeleteConfirmMsg(null);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center group-hover:bg-rose-200 dark:group-hover:bg-rose-900/40 transition-colors">
                    <LuTrash2 size={15} className="text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Delete for Everyone</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Removes this message for all members</p>
                  </div>
                </button>
              )}

              {/* Cancel */}
              <button
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setDeleteConfirmMsg(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
