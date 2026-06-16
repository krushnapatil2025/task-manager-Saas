import React, { useState, useEffect, useCallback } from 'react';
import { LuPin, LuX, LuTrash2, LuFileText, LuLoaderCircle } from 'react-icons/lu';
import { getRoomPins, unpinMessage } from '../services/chatService';
import { parseMarkdownAndMentions } from '../utils/markdown';
import moment from 'moment';

const PinnedMessagesPanel = ({ roomId, onClose, onJumpToMessage }) => {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await getRoomPins(roomId);
      setPins(data);
    } catch (err) {
      console.error('Failed to fetch pinned messages:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchPins();
  }, [roomId, fetchPins]);

  const handleUnpin = async (messageId) => {
    if (!roomId) return;
    try {
      await unpinMessage(roomId, messageId);
      setPins(prev => prev.filter(p => p.message?.id !== messageId));
    } catch (err) {
      console.error('Failed to unpin message:', err);
    }
  };

  return (
    <div className="w-[340px] md:w-[380px] flex-shrink-0 border-l border-slate-100 bg-white flex flex-col h-full overflow-hidden animate-slide-in-right z-30 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-55/30">
        <div className="flex items-center gap-2">
          <LuPin className="text-amber-500 fill-amber-500/20" size={18} />
          <h3 className="font-bold text-slate-800 text-sm">Pinned Messages</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <LuX size={16} />
        </button>
      </div>

      {/* Pins List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={24} />
          </div>
        ) : pins.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10 text-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <LuPin size={20} />
            </div>
            <span className="text-xs font-semibold">No pinned messages yet</span>
            <span className="text-[10px] text-slate-300 max-w-[200px]">Keep important links, announcements, or messages quick to access by pinning them.</span>
          </div>
        ) : (
          pins.map((pin) => {
            const msg = pin.message;
            if (!msg) return null;
            return (
              <div 
                key={pin.id} 
                className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all relative group flex flex-col gap-2 cursor-pointer"
                onClick={() => onJumpToMessage && onJumpToMessage(msg.id)}
              >
                {/* Meta details */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {msg.sender?.profile_image_url ? (
                      <img src={msg.sender.profile_image_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-[9px] flex items-center justify-center">
                        {msg.sender?.name?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">
                      {msg.sender?.name || 'User'}
                    </span>
                    <span className="text-[8px] text-slate-400">
                      {moment(msg.created_at).format('MMM D, h:mm A')}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpin(msg.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    title="Unpin Message"
                  >
                    <LuTrash2 size={12} />
                  </button>
                </div>

                {/* Content */}
                <div 
                  className="text-xs text-slate-605 break-words line-clamp-3 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(msg.content) }}
                />

                {msg.file_url && (
                  <div className="text-[10px] text-indigo-650 flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-150">
                    <LuFileText size={12} />
                    <span className="truncate">{msg.file_url.split('||')[2] || 'Attachment'}</span>
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

export default PinnedMessagesPanel;
