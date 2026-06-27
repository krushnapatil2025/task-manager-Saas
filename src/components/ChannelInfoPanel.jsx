import React, { useState, useEffect } from 'react';
import { LuX, LuInfo, LuCalendar, LuUser, LuUsers, LuPin, LuCornerDownRight } from 'react-icons/lu';
import { supabase } from '../utils/supabaseClient';
import moment from 'moment';

export const ChannelInfoPanel = ({ roomId, roomName, roomDetails, members = [], createdBy, onClose, onJumpToMessage }) => {
  const [creator, setCreator] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [showPins, setShowPins] = useState(true);

  // Fetch Room Creator profile
  useEffect(() => {
    if (!createdBy) {
      setCreator(null);
      return;
    }
    const fetchCreator = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', createdBy)
          .single();
        if (!error && data) {
          setCreator(data.name);
        }
      } catch (err) {
        console.error('Error fetching creator:', err);
      }
    };
    fetchCreator();
  }, [createdBy]);

  // Fetch Pinned messages for this room
  useEffect(() => {
    if (!roomId) return;
    const fetchPins = async () => {
      setLoadingPins(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            id,
            content,
            type,
            created_at,
            sender:profiles!sender_id (name, profile_image_url)
          `)
          .eq('room_id', roomId)
          .eq('is_pinned', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPinnedMessages(data.map(m => ({
            id: m.id,
            content: m.content,
            type: m.type,
            createdAt: m.created_at,
            senderName: m.sender?.name || 'User',
            senderAvatar: m.sender?.profile_image_url
          })));
        }
      } catch (err) {
        console.error('Error fetching pins for info panel:', err);
      } finally {
        setLoadingPins(false);
      }
    };
    fetchPins();

    // Set up subscription for message updates (pin/unpin events)
    const ch = supabase
      .channel(`room-pins-${roomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchPins();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  const displayRoomName = roomName?.startsWith('#') ? roomName.substring(2) : roomName || 'Room';
  const displayTopic = roomDetails?.topic || 'No topic set';
  const displayDesc = roomDetails?.description || 'No description provided';

  return (
    <div className="w-80 border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-full flex flex-col overflow-hidden animate-slide-in-right">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-100">
          <LuInfo size={16} className="text-indigo-650" />
          <span className="font-bold text-xs uppercase tracking-wider">About Room</span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 dark:text-zinc-550 transition-colors"
          title="Close details panel"
        >
          <LuX size={16} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        
        {/* Name and Basic Metadata */}
        <div className="bg-slate-50/50 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-900">
          <h3 className="font-extrabold text-slate-900 dark:text-zinc-150 text-sm truncate">
            #{displayRoomName}
          </h3>
          
          <div className="flex flex-col gap-2 mt-3.5 text-[10px] text-slate-500 dark:text-zinc-400">
            {creator && (
              <div className="flex items-center gap-2">
                <LuUser size={13} className="text-slate-400 flex-shrink-0" />
                <span>Created by <strong className="text-slate-700 dark:text-zinc-200 font-bold">{creator}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <LuCalendar size={13} className="text-slate-400 flex-shrink-0" />
              <span>Created {moment(roomDetails?.created_at).isValid() ? moment(roomDetails?.created_at).format('MMM D, YYYY') : 'recently'}</span>
            </div>
          </div>
        </div>

        {/* Topic & Description */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-550 block mb-1">Topic</label>
            <p className="text-xs text-slate-650 dark:text-zinc-300 leading-relaxed font-medium bg-slate-50/30 dark:bg-zinc-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-zinc-900/60">
              {displayTopic}
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-550 block mb-1">Description</label>
            <p className="text-xs text-slate-650 dark:text-zinc-300 leading-relaxed bg-slate-50/30 dark:bg-zinc-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-zinc-900/60">
              {displayDesc}
            </p>
          </div>
        </div>

        {/* Members List Accordion */}
        <div className="border-t border-slate-100 dark:border-zinc-900 pt-4">
          <button 
            onClick={() => setShowMembers(s => !s)}
            className="w-full flex items-center justify-between font-bold text-[10px] uppercase text-slate-400 dark:text-zinc-500 hover:text-slate-600 mb-2"
          >
            <span className="flex items-center gap-1.5">
              <LuUsers size={12} />
              <span>Members ({members.length})</span>
            </span>
            <span className="text-[8px]">{showMembers ? '▲' : '▼'}</span>
          </button>
          
          {showMembers && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto mt-2 pr-1">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-2 py-0.5">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="w-5.5 h-5.5 rounded-lg object-cover" />
                  ) : (
                    <div className="w-5.5 h-5.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[9px] flex items-center justify-center">
                      {(member.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-250 truncate">{member.name}</span>
                  {member.role === 'owner' && (
                    <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 px-1.5 py-0.2 rounded-full font-bold ml-auto uppercase tracking-wide">Owner</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinned Messages Summary Accordion */}
        <div className="border-t border-slate-100 dark:border-zinc-900 pt-4">
          <button 
            onClick={() => setShowPins(s => !s)}
            className="w-full flex items-center justify-between font-bold text-[10px] uppercase text-slate-400 dark:text-zinc-500 hover:text-slate-600 mb-2"
          >
            <span className="flex items-center gap-1.5">
              <LuPin size={12} />
              <span>Pinned Messages ({pinnedMessages.length})</span>
            </span>
            <span className="text-[8px]">{showPins ? '▲' : '▼'}</span>
          </button>

          {showPins && (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mt-2 pr-1">
              {loadingPins ? (
                <p className="text-[10px] text-slate-400 italic">Loading pins...</p>
              ) : pinnedMessages.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic pl-1">No pinned messages in this room</p>
              ) : (
                pinnedMessages.map(pin => (
                  <div 
                    key={pin.id}
                    onClick={() => onJumpToMessage(pin.id)}
                    className="p-2 border border-slate-100 dark:border-zinc-900 hover:border-indigo-100 dark:hover:border-indigo-950 rounded-xl bg-slate-50/40 dark:bg-zinc-900/20 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-800 dark:text-zinc-200 truncate">{pin.senderName}</span>
                      <span className="text-[7.5px] text-slate-400">{moment(pin.createdAt).format('M/D h:mm A')}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {pin.type === 'poll' ? '📊 Poll message' : pin.content || '📎 Attachment'}
                    </p>
                    <div className="flex items-center gap-1 text-[8px] text-indigo-650 dark:text-indigo-400 font-bold mt-0.5">
                      <LuCornerDownRight size={8} />
                      <span>Click to view</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ChannelInfoPanel;
