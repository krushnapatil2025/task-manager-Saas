import React, { useContext, useEffect, useState, useCallback } from 'react';
import { 
  LuHash, LuPlus, LuLoaderCircle, LuMessageSquare, LuLock, 
  LuChevronDown, LuChevronRight, LuStar, LuSearch, LuX 
} from 'react-icons/lu';
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
import { toast } from 'react-hot-toast';

const DEFAULT_CHANNELS = ['general', 'announcements', 'random'];

const ChatSidebar = ({ selectedRoomId, activeDMUserId, onSelectRoom, refreshTrigger }) => {
  const { user, updateUser } = useContext(UserContext);
  const { workspace, onlineUsers } = useContext(WorkspaceContext);

  const [rooms,           setRooms          ] = useState([]);
  const [members,         setMembers        ] = useState([]);
  const [unread,          setUnread         ] = useState({});
  // Map: userId → roomId for DMs, so we can look up badge counts
  const [dmRoomMap,       setDmRoomMap      ] = useState({});
  const [loading,         setLoading        ] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Starred rooms list
  const [starredRoomIds, setStarredRoomIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`starred_rooms_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Collapsible section state
  const [sectionsExpanded, setSectionsExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(`chat_sections_${user?.id}`);
      return saved ? JSON.parse(saved) : { starred: true, channels: true, dms: true };
    } catch {
      return { starred: true, channels: true, dms: true };
    }
  });

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

      // Build userId → roomId map for DM rooms
      const dmMap = {};
      roomList
        .filter(r => r.type === 'direct')
        .forEach(r => {
          // DM room name is usually "dm-<uid1>-<uid2>" — find the other user
          if (r.dmPartnerId) {
            dmMap[r.dmPartnerId] = r.id;
          }
        });
      setDmRoomMap(dmMap);
    } catch (err) {
      console.error('ChatSidebar load:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, user?.id]);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // Auto-select general room removed to support chat landing page feature summary

  // Real-time unread counter refresh
  useEffect(() => {
    if (!user?.id) return;
    const refreshUnread = async () => {
      try {
        const counts = await getUnreadCounts(user.id);
        setUnread(counts);
      } catch { /* ignore */ }
    };
    const ch = supabase
      .channel('unread-counter')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, refreshUnread)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, refreshUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_room_members', filter: `user_id=eq.${user.id}` }, refreshUnread)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  const handleCreateChannelSubmit = async (name, isPrivate, memberIds) => {
    const roomId = await createCustomChannel(workspace.id, name, isPrivate, memberIds);
    await load();
    onSelectRoom(roomId, `# ${name}`, 'team', members, null, isPrivate, user.id);
  };

  const handleRoomSelect = async (room) => {
    await joinRoom(room.id, user.id);
    onSelectRoom(room.id, `# ${room.name}`, 'team', members, null, room.isPrivate, room.createdBy);
  };

  const handleDM = useCallback(async (member) => {
    const roomId = await getOrCreateDM(workspace.id, user.id, member.id);
    await joinRoom(roomId, user.id);
    // Cache this DM room mapping for unread badges
    setDmRoomMap(prev => ({ ...prev, [member.id]: roomId }));
    onSelectRoom(roomId, member.name || member.fullName || 'DM', 'direct', [], member.id, false, null);
  }, [workspace?.id, user?.id, onSelectRoom]);

  // Listen for the select-dm-user custom event from the UserProfileHoverCard
  useEffect(() => {
    const handleSelectDMEvent = async (e) => {
      const { userId, name } = e.detail;
      const member = members.find(m => m.id === userId) || { id: userId, name };
      await handleDM(member);
    };

    window.addEventListener('select-dm-user', handleSelectDMEvent);
    return () => window.removeEventListener('select-dm-user', handleSelectDMEvent);
  }, [members, handleDM]);

  const toggleStar = (e, roomId) => {
    e.stopPropagation();
    e.preventDefault();
    setStarredRoomIds(prev => {
      const next = prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId];
      localStorage.setItem(`starred_rooms_${user?.id}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleSection = (section) => {
    setSectionsExpanded(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem(`chat_sections_${user?.id}`, JSON.stringify(next));
      return next;
    });
  };

  const isSectionExpanded = (section) => {
    if (searchQuery.trim() !== '') return true; // force expand during active search
    return !!sectionsExpanded[section];
  };

  // Filter lists based on search query
  const query = searchQuery.toLowerCase();

  const teamRooms = rooms.filter(r => r.type === 'team');
  const filteredTeamRooms = teamRooms.filter(r => r.name.toLowerCase().includes(query));

  const filteredMembers = members.filter(m => (m.name || m.fullName || 'Member').toLowerCase().includes(query));

  // Starred lists (Channels & DMs)
  const starredRoomsList = teamRooms.filter(r => starredRoomIds.includes(r.id) && r.name.toLowerCase().includes(query));
  const starredMembersList = members.filter(m => {
    const dmRoomId = dmRoomMap[m.id];
    return dmRoomId && starredRoomIds.includes(dmRoomId) && (m.name || m.fullName || 'Member').toLowerCase().includes(query);
  });

  const totalUnread = Object.values(unread).reduce((s, c) => s + c, 0);

  return (
    <div className="chat-sidebar flex flex-col h-full">
      {/* ── Header ── */}
      <div className="chat-sidebar-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <LuMessageSquare size={15} className="text-indigo-500" />
          <span className="chat-sidebar-title font-bold text-sm">Team Chat</span>
          {totalUnread > 0 && <UnreadBadge count={totalUnread} />}
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="chat-sidebar-search px-3 py-2 flex-shrink-0 border-b border-slate-100/50">
        <div className="relative flex items-center bg-slate-100/80 hover:bg-slate-150/70 border border-slate-200/50 rounded-xl px-2.5 py-1.5 text-slate-500 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:bg-white focus-within:border-indigo-400">
          <LuSearch size={13} className="text-slate-400 mr-1.5 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search channels & people..."
            className="bg-transparent border-none outline-none text-[11px] text-slate-700 w-full placeholder-slate-400"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <LuX size={10} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="chat-sidebar-body flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <LuLoaderCircle className="animate-spin text-indigo-400" size={20} />
          </div>
        ) : (
          <>
            {/* ── Starred Section ── */}
            {(starredRoomsList.length > 0 || starredMembersList.length > 0) && (
              <div className="chat-sidebar-section mb-4">
                <div 
                  className="chat-sidebar-section-header cursor-pointer select-none flex items-center justify-between hover:text-slate-700 transition-colors"
                  onClick={() => toggleSection('starred')}
                >
                  <div className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                    {isSectionExpanded('starred') ? <LuChevronDown size={12} /> : <LuChevronRight size={12} />}
                    <span>Starred</span>
                  </div>
                </div>

                {isSectionExpanded('starred') && (
                  <div className="flex flex-col gap-[2px] mt-1 pl-1">
                    {starredRoomsList.map(room => {
                      const count  = unread[room.id] || 0;
                      const isActive  = selectedRoomId === room.id;
                      const hasUnread = count > 0 && !isActive;
                      return (
                        <div 
                          key={room.id} 
                          className={`chat-sidebar-item-container flex items-center justify-between group rounded-xl transition-all ${isActive ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                        >
                          <button
                            className={`chat-sidebar-item flex-1 ${isActive ? 'chat-sidebar-item--active' : ''} ${hasUnread ? 'chat-sidebar-item--unread' : ''} py-1.5 px-2 flex items-center gap-2`}
                            onClick={() => handleRoomSelect(room)}
                          >
                            {room.isPrivate ? (
                              <LuLock size={12} className="flex-shrink-0 text-amber-500" />
                            ) : (
                              <span className="text-slate-400 font-bold text-[13px] flex-shrink-0 leading-none">#</span>
                            )}
                            <span className="chat-sidebar-item-name truncate text-[12px]">{room.name}</span>
                            {hasUnread && <UnreadBadge count={count} />}
                          </button>
                          <button 
                            onClick={(e) => toggleStar(e, room.id)}
                            className="chat-sidebar-star-btn opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:scale-110 transition-all mr-2 cursor-pointer"
                            title="Unstar channel"
                          >
                            <LuStar size={11} className="fill-amber-400 text-amber-400" />
                          </button>
                        </div>
                      );
                    })}

                    {starredMembersList.map(member => {
                      const isDnd     = member.dndUntil && new Date(member.dndUntil) > new Date();
                      const isOnline  = !isDnd && !!onlineUsers[member.id];
                      const isActive  = activeDMUserId === member.id;
                      const dmRoomId  = dmRoomMap[member.id];
                      const count     = dmRoomId ? (unread[dmRoomId] || 0) : 0;
                      const hasUnread = count > 0 && !isActive;

                      return (
                        <div 
                          key={member.id}
                          className={`chat-sidebar-item-container flex items-center justify-between group rounded-xl transition-all ${isActive ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                        >
                          <button
                            className={`chat-sidebar-item flex-1 ${isActive ? 'chat-sidebar-item--active' : ''} ${hasUnread ? 'chat-sidebar-item--unread' : ''} py-1.5 px-2 flex items-center gap-2`}
                            onClick={() => handleDM(member)}
                          >
                            <div className="relative flex-shrink-0">
                              {member.profileImageUrl ? (
                                <img src={member.profileImageUrl} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                                  {(member.name || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white ${isDnd ? 'bg-rose-500' : (isOnline ? 'bg-emerald-400' : 'bg-slate-300')}`} />
                            </div>
                            <span className="chat-sidebar-item-name truncate text-[12px] flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="truncate">{member.name || member.fullName || 'Member'}</span>
                              {isDnd && <span className="text-[9px] text-rose-500" title="Do Not Disturb">🔕</span>}
                              {member.statusText && (!member.statusExpiresAt || new Date(member.statusExpiresAt) > new Date()) && (
                                <span className="text-[10px]" title={member.statusText}>{member.statusEmoji || '🟢'}</span>
                              )}
                            </span>
                            {hasUnread && <UnreadBadge count={count} />}
                          </button>
                          <button 
                            onClick={(e) => toggleStar(e, dmRoomId)}
                            className="chat-sidebar-star-btn opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:scale-110 transition-all mr-2 cursor-pointer"
                            title="Unstar user"
                          >
                            <LuStar size={11} className="fill-amber-400 text-amber-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Channels ── */}
            <div className="chat-sidebar-section mb-4">
              <div 
                className="chat-sidebar-section-header cursor-pointer select-none flex items-center justify-between hover:text-slate-700 transition-colors"
                onClick={() => toggleSection('channels')}
              >
                <div className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  {isSectionExpanded('channels') ? <LuChevronDown size={12} /> : <LuChevronRight size={12} />}
                  <span>Channels</span>
                </div>
                {isSectionExpanded('channels') && (
                  <button
                    className="chat-sidebar-add-btn p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateModal(true);
                    }}
                    title="New channel"
                  >
                    <LuPlus size={13} />
                  </button>
                )}
              </div>

              {isSectionExpanded('channels') && (
                <div className="flex flex-col gap-[2px] mt-1 pl-1">
                  {filteredTeamRooms.map(room => {
                    const count  = unread[room.id] || 0;
                    const isActive  = selectedRoomId === room.id;
                    const hasUnread = count > 0 && !isActive;
                    const isStarred = starredRoomIds.includes(room.id);
                    return (
                      <div 
                        key={room.id} 
                        className={`chat-sidebar-item-container flex items-center justify-between group rounded-xl transition-all ${isActive ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <button
                          className={`chat-sidebar-item flex-1 ${isActive ? 'chat-sidebar-item--active' : ''} ${hasUnread ? 'chat-sidebar-item--unread' : ''} py-1.5 px-2 flex items-center gap-2`}
                          onClick={() => handleRoomSelect(room)}
                        >
                          {room.isPrivate ? (
                            <LuLock size={12} className="flex-shrink-0 text-amber-500" />
                          ) : (
                            <span className="text-slate-400 font-bold text-[13px] flex-shrink-0 leading-none">#</span>
                          )}
                          <span className="chat-sidebar-item-name truncate text-[12px]">{room.name}</span>
                          {hasUnread && <UnreadBadge count={count} />}
                        </button>
                        <button 
                          onClick={(e) => toggleStar(e, room.id)}
                          className={`chat-sidebar-star-btn opacity-0 group-hover:opacity-100 p-1 transition-all mr-2 cursor-pointer ${isStarred ? 'text-amber-400 scale-105' : 'text-slate-300 hover:text-amber-400'}`}
                          title={isStarred ? "Unstar channel" : "Star channel"}
                        >
                          <LuStar size={11} className={isStarred ? "fill-amber-400 text-amber-400" : ""} />
                        </button>
                      </div>
                    );
                  })}
                  {filteredTeamRooms.length === 0 && (
                    <p className="text-[10px] text-slate-400/80 italic pl-5 py-1">No channels found</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Direct Messages ── */}
            <div className="chat-sidebar-section">
              <div 
                className="chat-sidebar-section-header cursor-pointer select-none flex items-center justify-between hover:text-slate-700 transition-colors"
                onClick={() => toggleSection('dms')}
              >
                <div className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  {isSectionExpanded('dms') ? <LuChevronDown size={12} /> : <LuChevronRight size={12} />}
                  <span>Direct Messages</span>
                </div>
              </div>

              {isSectionExpanded('dms') && (
                <div className="flex flex-col gap-[2px] mt-1 pl-1">
                  {filteredMembers.map(member => {
                    const isDnd     = member.dndUntil && new Date(member.dndUntil) > new Date();
                    const isOnline  = !isDnd && !!onlineUsers[member.id];
                    const isActive  = activeDMUserId === member.id;
                    const dmRoomId  = dmRoomMap[member.id];
                    const count     = dmRoomId ? (unread[dmRoomId] || 0) : 0;
                    const hasUnread = count > 0 && !isActive;
                    const isStarred = dmRoomId && starredRoomIds.includes(dmRoomId);

                    return (
                      <div 
                        key={member.id}
                        className={`chat-sidebar-item-container flex items-center justify-between group rounded-xl transition-all ${isActive ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <button
                          className={`chat-sidebar-item flex-1 ${isActive ? 'chat-sidebar-item--active' : ''} ${hasUnread ? 'chat-sidebar-item--unread' : ''} py-1.5 px-2 flex items-center gap-2`}
                          onClick={() => handleDM(member)}
                        >
                          {/* Avatar with online dot */}
                          <div className="relative flex-shrink-0">
                            {member.profileImageUrl ? (
                              <img src={member.profileImageUrl} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                                {(member.name || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white ${isDnd ? 'bg-rose-500' : (isOnline ? 'bg-emerald-400' : 'bg-slate-300')}`} />
                          </div>

                          <span className="chat-sidebar-item-name truncate text-[12px] flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate">{member.name || member.fullName || 'Member'}</span>
                            {isDnd && <span className="text-[9px] text-rose-500" title="Do Not Disturb">🔕</span>}
                            {member.statusText && (!member.statusExpiresAt || new Date(member.statusExpiresAt) > new Date()) && (
                              <span className="text-[10px]" title={member.statusText}>{member.statusEmoji || '🟢'}</span>
                            )}
                          </span>

                          {hasUnread && <UnreadBadge count={count} />}
                        </button>
                        <button 
                          onClick={(e) => toggleStar(e, dmRoomId)}
                          className={`chat-sidebar-star-btn opacity-0 group-hover:opacity-100 p-1 transition-all mr-2 cursor-pointer ${isStarred ? 'text-amber-400 scale-105' : 'text-slate-350 hover:text-amber-400'}`}
                          title={isStarred ? "Unstar user" : "Star user"}
                        >
                          <LuStar size={11} className={isStarred ? "fill-amber-400 text-amber-400" : ""} />
                        </button>
                      </div>
                    );
                  })}

                  {filteredMembers.length === 0 && (
                    <p className="text-[10px] text-slate-400/80 italic pl-5 py-1">No people found</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
