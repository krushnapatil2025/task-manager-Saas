import React, { useState, useEffect, useCallback } from 'react';
import { LuBookmark, LuX, LuTrash2, LuFileText, LuLoaderCircle, LuExternalLink } from 'react-icons/lu';
import { getSavedMessages, unsaveMessage } from '../services/chatService';
import { parseMarkdownAndMentions } from '../utils/markdown';
import moment from 'moment';
import { toast } from 'react-hot-toast';

const SavedMessagesPanel = ({ userId, currentRoomId, onClose, onJumpToMessage, onSwitchRoom }) => {
  const [savedMsgs, setSavedMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getSavedMessages(userId);
      setSavedMsgs(data);
    } catch (err) {
      console.error('Failed to fetch saved messages:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSaved();
  }, [userId, fetchSaved]);

  const handleUnsave = async (messageId) => {
    if (!userId) return;
    try {
      await unsaveMessage(userId, messageId);
      setSavedMsgs(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message removed from bookmarks');
    } catch (err) {
      console.error('Failed to unsave message:', err);
      toast.error('Failed to remove bookmark');
    }
  };

  const handleMessageClick = (msg) => {
    if (msg.roomId === currentRoomId) {
      onJumpToMessage && onJumpToMessage(msg.id);
    } else {
      if (onSwitchRoom) {
        onSwitchRoom(msg.roomId, msg.roomName, msg.id);
      } else {
        toast.info(`This message is in channel: ${msg.roomName || 'another room'}`);
      }
    }
  };

  return (
    <div className="w-[340px] md:w-[380px] flex-shrink-0 border-l border-slate-100 bg-white flex flex-col h-full overflow-hidden animate-slide-in-right z-30 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <LuBookmark className="text-indigo-600 fill-indigo-600/10" size={18} />
          <h3 className="font-bold text-slate-800 text-sm">Saved Messages</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <LuX size={16} />
        </button>
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={24} />
          </div>
        ) : savedMsgs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10 text-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <LuBookmark size={20} />
            </div>
            <span className="text-xs font-semibold">No saved messages yet</span>
            <span className="text-[10px] text-slate-300 max-w-[200px]">Hover over any message and click the bookmark icon to save it for later.</span>
          </div>
        ) : (
          savedMsgs.map((msg) => {
            const isDifferentRoom = msg.roomId !== currentRoomId;
            return (
              <div 
                key={msg.id} 
                className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all relative group flex flex-col gap-2 cursor-pointer"
                onClick={() => handleMessageClick(msg)}
              >
                {/* Meta details */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {msg.senderAvatar ? (
                      <img src={msg.senderAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                        {msg.senderName?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-700 truncate max-w-[100px]">
                          {msg.senderName}
                        </span>
                        {isDifferentRoom && (
                          <span className="text-[8px] bg-slate-200/80 text-slate-550 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                            #{msg.roomName || 'channel'}
                            <LuExternalLink size={8} />
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-slate-400">
                        {moment(msg.createdAt).format('MMM D, h:mm A')}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnsave(msg.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    title="Remove Bookmark"
                  >
                    <LuTrash2 size={12} />
                  </button>
                </div>

                {/* Content */}
                <div 
                  className="text-xs text-slate-650 break-words line-clamp-3 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(msg.content) }}
                />

                {msg.fileUrl && (
                  <div className="text-[10px] text-indigo-600 flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-200">
                    <LuFileText size={12} className="text-indigo-500" />
                    <span className="truncate">{msg.fileUrl.split('||')[2] || 'Attachment'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SavedMessagesPanel;
