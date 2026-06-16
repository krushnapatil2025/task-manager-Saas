import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LuHash, LuUser, LuPlus, LuLoaderCircle, LuMessageSquare, LuLock } from 'react-icons/lu';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import UnreadBadge from './UnreadBadge';
import CreateChannelModal from './CreateChannelModal';
import {
  getMyRooms, getOrCreateTeamRoom, joinRoom,
  getUnreadCounts, getOrCreateDM, createCustomChannel,
} from '../services/chatService';
import { getWorkspaceMembers } from '../services/workspaceService';
import { supabase } from '../utils/supabaseClient';

const DEFAULT_CHANNELS = ['general', 'announcements', 'random'];

const ChatSidebar = ({ selectedRoomId, activeDMUserId, onSelectRoom, refreshTrigger }) => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [rooms,            setRooms           ] = useState([]);
  const [members,          setMembers         ] = useState([]);
  const [unread,           setUnread          ] = useState({});
  const [loading,          setLoading         ] = useState(true);
  const [showCreateModal,  setShowCreateModal ] = useState(false);

  const load = useCallback(async () => {
    if (!workspace?.id || !user?.id) return;
    setLoading(true);
    try {
      // Ensure default channels exist and user is in them
      try {
        for (const name of DEFAULT_CHANNELS) {
          const roomId = await getOrCreateTeamRoom(workspace.id, name);
          await joinRoom(roomId, user.id);
        }
      } catch (err) {
        console.warn('Default channels initialization warning:', err);
      }

      const [roomList, memberList, unreadMap] = await Promise.all([
        getMyRooms(workspace.id, user.id),
        getWorkspaceMembers(workspace.id),
        getUnreadCounts(user.id),
      ]);

      setRooms(roomList);
      const filteredMembers = memberList.filter(m => m.id !== user.id);
      setMembers(filteredMembers);
      setUnread(unreadMap);
    } catch (err) {
      console.error('ChatSidebar load:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, user?.id]);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // Real-time workspace user presence tracking
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    if (!workspace?.id || !user?.id) return;

    const presenceChannel = supabase.channel(`presence-workspace-${workspace.id}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = {};
        Object.values(state).forEach((presenceInfo) => {
          presenceInfo.forEach((item) => {
            if (item.user_id) onlineIds[item.user_id] = true;
          });
        });
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            name: user.name || 'User',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [workspace?.id, user?.id]);

  // Auto-select general or first channel if nothing is selected
  useEffect(() => {
    if (loading || selectedRoomId || rooms.length === 0) return;
    const general = rooms.find(r => r.name === 'general' && r.type === 'team') || rooms.find(r => r.type === 'team');
    if (general) {
      onSelectRoom(general.id, `# ${general.name}`, 'team', members, null, general.isPrivate, general.createdBy);
    }
  }, [rooms, selectedRoomId, onSelectRoom, loading, members]);

  // Real-time unread counter refresh
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel('unread-counter')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async () => {
          const counts = await getUnreadCounts(user.id);
          setUnread(counts);
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  const handleCreateChannelSubmit = async (name, isPrivate, memberIds) => {
    const roomId = await createCustomChannel(workspace.id, name, isPrivate, memberIds);
    await load();
    onSelectRoom(roomId, `# ${name}`, 'team', members, null, isPrivate, user.id);
  };

  const handleRoomSelect = async (room) => {
    // Join the room if not already in members
    await joinRoom(room.id, user.id);
    onSelectRoom(room.id, `# ${room.name}`, 'team', members, null, room.isPrivate, room.createdBy);
  };

  const handleDM = async (member) => {
    const roomId = await getOrCreateDM(workspace.id, user.id, member.id);
    await joinRoom(roomId, user.id);
    onSelectRoom(roomId, member.name || member.fullName || 'DM', 'direct', [], member.id, false, null);
  };

  const teamRooms   = rooms.filter(r => r.type === 'team');
  const totalUnread = Object.values(unread).reduce((s, c) => s + c, 0);

  return (
    <div className="chat-sidebar">
      {/* Header */}
      <div className="chat-sidebar-header">
        <div className="flex items-center gap-2">
          <LuMessageSquare size={16} className="text-indigo-400" />
          <span className="chat-sidebar-title">Team Chat</span>
          {totalUnread > 0 && <UnreadBadge count={totalUnread} />}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <LuLoaderCircle className="animate-spin text-indigo-400" size={20} />
        </div>
      ) : (
        <>
          {/* ── Channels ── */}
          <div className="chat-sidebar-section">
            <div className="chat-sidebar-section-header">
              <span>CHANNELS</span>
              <button className="chat-sidebar-add-btn" onClick={() => setShowCreateModal(true)} title="New channel">
                <LuPlus size={12} />
              </button>
            </div>

            {teamRooms.map(room => (
              <button
                key={room.id}
                className={`chat-sidebar-item ${selectedRoomId === room.id ? 'chat-sidebar-item--active' : ''}`}
                onClick={() => handleRoomSelect(room)}
              >
                {room.isPrivate ? (
                  <LuLock size={13} className="flex-shrink-0 text-amber-500" />
                ) : (
                  <LuHash size={13} className="flex-shrink-0 opacity-60" />
                )}
                <span className="chat-sidebar-item-name">{room.name}</span>
                <UnreadBadge count={unread[room.id] || 0} />
              </button>
            ))}
          </div>

          {/* ── Direct Messages ── */}
          <div className="chat-sidebar-section">
            <div className="chat-sidebar-section-header">
              <span>DIRECT MESSAGES</span>
            </div>

            {members.map(member => {
              const isOnline = !!onlineUsers[member.id];
              return (
                <button
                  key={member.id}
                  className={`chat-sidebar-item ${activeDMUserId === member.id ? 'chat-sidebar-item--active' : ''}`}
                  onClick={() => handleDM(member)}
                >
                  {member.profileImageUrl
                    ? <img src={member.profileImageUrl} alt={member.name}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-5 h-5 rounded-full bg-indigo-400 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {(member.name || 'U')[0].toUpperCase()}
                      </div>}
                  <span className="chat-sidebar-item-name truncate">
                    {member.name || member.fullName || 'Member'}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-300'
                  }`} />
                </button>
              );
            })}

            {members.length === 0 && (
              <p className="chat-sidebar-empty">No other members yet</p>
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateChannelModal
          workspaceMembers={members}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateChannelSubmit}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
