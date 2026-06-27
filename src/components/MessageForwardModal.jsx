import React, { useState, useEffect, useContext } from 'react';
import { LuX, LuSearch, LuSend, LuLoaderCircle } from 'react-icons/lu';
import { getMyRooms, getOrCreateDM, sendChatMessage } from '../services/chatService';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'react-hot-toast';

export const MessageForwardModal = ({ message, currentRoomName, onClose }) => {
  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null); // { id: '...', type: 'channel'|'dm', name: '...' }
  const [optionalNote, setOptionalNote] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!workspace?.id || !user?.id) return;
      setLoading(true);
      try {
        // Fetch rooms
        const roomsData = await getMyRooms(workspace.id, user.id);
        setRooms(roomsData);

        // Fetch workspace members
        const { data: membersData, error: membersErr } = await supabase
          .from('workspace_members')
          .select(`
            user_id,
            profile:profiles!user_id(name, profile_image_url)
          `)
          .eq('workspace_id', workspace.id);

        if (membersErr) throw membersErr;

        const mappedMembers = (membersData || [])
          .map(m => ({
            id: m.user_id,
            name: m.profile?.name || 'Workspace Member',
            avatar: m.profile?.profile_image_url
          }))
          .filter(m => m.id !== user.id);

        setMembers(mappedMembers);
      } catch (err) {
        console.error('Failed to load targets for forwarding:', err);
        toast.error('Failed to load channels & members');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspace?.id, user?.id]);

  const handleForward = async () => {
    if (!selectedTarget) {
      toast.error('Please select a destination');
      return;
    }

    setForwarding(true);
    try {
      let targetRoomId = selectedTarget.id;

      // If forwarding to a DM, resolve/create the DM room ID first
      if (selectedTarget.type === 'dm') {
        targetRoomId = await getOrCreateDM(workspace.id, user.id, selectedTarget.id);
      }

      // Build the forwarded message content
      const source = currentRoomName || 'Another Channel';
      const quoteBlock = message.content 
        ? `\n> ${message.content.split('\n').join('\n> ')}` 
        : '';
      
      const fileHeader = message.fileUrl ? `\n📎 *Attachment:* ${message.fileUrl.split('||')[2] || 'File'}` : '';

      const formattedContent = `*Forwarded from ${source}*:${quoteBlock}${fileHeader}${
        optionalNote.trim() ? `\n\n${optionalNote.trim()}` : ''
      }`;

      // Send the chat message
      await sendChatMessage(
        targetRoomId,
        user.id,
        formattedContent,
        message.type === 'image' ? 'image' : (message.type === 'file' ? 'file' : 'text'),
        message.fileUrl
      );

      toast.success(`Message forwarded to ${selectedTarget.name}!`);
      onClose();
    } catch (err) {
      console.error('Forward failed:', err);
      toast.error('Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  // Filter lists based on search
  const filteredChannels = rooms.filter(r => 
    r.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <div className="modal-card max-w-md w-full animate-fade-in bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
          <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Forward Message</h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 dark:text-zinc-500 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        {/* Message Preview */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-100 dark:border-zinc-900/60 max-h-24 overflow-y-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Message Preview</span>
          {message.content ? (
            <p className="text-xs text-slate-600 dark:text-zinc-300 italic line-clamp-3">"{message.content}"</p>
          ) : (
            <p className="text-xs text-slate-550 dark:text-zinc-400 italic">📎 Attachment ({message.type})</p>
          )}
        </div>

        {/* Content body */}
        <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
          
          {/* Search bar */}
          <div className="relative mb-3">
            <LuSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search channels or people..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900 outline-none focus:border-indigo-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Target List */}
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Select destination</span>
          <div className="flex-1 overflow-y-auto border border-slate-150 dark:border-zinc-900 rounded-xl p-1 bg-slate-50/20 dark:bg-zinc-950/20 max-h-48 min-h-36">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <LuLoaderCircle className="animate-spin text-indigo-500" size={20} />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {/* Channels */}
                {filteredChannels.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-bold text-slate-400/80 px-2 uppercase tracking-wider">Channels</span>
                    {filteredChannels.map(room => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedTarget({ id: room.id, type: 'channel', name: `#${room.name}` })}
                        className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedTarget?.id === room.id 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-bold' 
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <span># {room.name}</span>
                        {selectedTarget?.id === room.id && <span className="text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Direct Messages */}
                {filteredMembers.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold text-slate-400/80 px-2 uppercase tracking-wider">People</span>
                    {filteredMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => setSelectedTarget({ id: member.id, type: 'dm', name: member.name })}
                        className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedTarget?.id === member.id 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-bold' 
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {member.avatar ? (
                            <img src={member.avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-205 dark:bg-zinc-800 text-[8px] font-extrabold flex items-center justify-center text-slate-500 dark:text-zinc-400">
                              {member.name[0].toUpperCase()}
                            </div>
                          )}
                          <span>{member.name}</span>
                        </div>
                        {selectedTarget?.id === member.id && <span className="text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {filteredChannels.length === 0 && filteredMembers.length === 0 && (
                  <p className="text-center text-[11px] text-slate-400 italic py-8">No matching channels or people</p>
                )}
              </div>
            )}
          </div>

          {/* Optional Note */}
          <div className="mt-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Add optional message</span>
            <textarea
              placeholder="Say something about this forwarded message..."
              className="w-full text-xs p-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900 outline-none focus:border-indigo-500 min-h-[50px] max-h-[80px] resize-none"
              value={optionalNote}
              onChange={e => setOptionalNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-900 bg-slate-50 dark:bg-zinc-900/20 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900 px-3 py-1.5 rounded-xl transition-colors"
            disabled={forwarding}
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            className="text-xs bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            disabled={forwarding || !selectedTarget}
          >
            {forwarding ? (
              <>
                <LuLoaderCircle className="animate-spin" size={13} />
                <span>Forwarding...</span>
              </>
            ) : (
              <>
                <LuSend size={13} />
                <span>Forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageForwardModal;
