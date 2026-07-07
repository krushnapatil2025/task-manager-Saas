import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ChatSidebar from '../../components/ChatSidebar';
import ChatWindow  from '../../components/ChatWindow';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { supabase } from '../../utils/supabaseClient';
import { joinRoom } from '../../services/chatService';
import { 
  LuMessageSquare, LuHash, LuSparkles, 
  LuShield, LuUserCheck, LuServer 
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// TeamChat — Phase 17 — Main chat page
// Combines ChatSidebar (left) + ChatWindow (right) or ChatLandingView (default)
// ─────────────────────────────────────────────────────────────────────────────

const ChatLandingView = ({ user, workspace }) => {
  const userName = user?.name || 'Teammate';
  const companyName = workspace?.name || 'your workspace';

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-8 bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-zinc-950 dark:to-zinc-900/40 text-center h-full overflow-y-auto pt-16">
      <div className="max-w-2xl w-full space-y-8 animate-fade-in py-12">
        {/* Welcome Section */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl w-24 h-24 mx-auto" />
          {workspace?.logo_url ? (
            <img 
              src={workspace.logo_url} 
              alt={companyName}
              className="w-16 h-16 rounded-2xl border border-slate-200/50 dark:border-zinc-800 shadow-lg relative z-10 animate-bounce object-cover bg-white"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-650 text-white flex items-center justify-center shadow-lg relative z-10 animate-bounce">
              <LuMessageSquare size={30} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-650 dark:text-indigo-400 text-xs font-bold font-mono tracking-wide uppercase">
            <LuSparkles size={12} className="animate-pulse" />
            Collaboration Hub Active
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight leading-tight">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{userName}</span>! 👋
            <br />
            <span className="text-sm sm:text-base font-medium text-slate-405 block mt-2">
              Ready to collaborate in <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent font-extrabold">{companyName}</span>?
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-lg mx-auto font-medium leading-relaxed">
            Select any team channel or start a secure direct message from the sidebar to connect in real-time with your team.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-8">
          <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200/50 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 flex items-center justify-center mb-3">
              <LuHash size={18} />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
              Team Channels
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Create and join public or private channels like <span className="font-semibold text-slate-700 dark:text-zinc-300">#general</span> and <span className="font-semibold text-slate-700 dark:text-zinc-300">#announcements</span> to keep discussions organized.
            </p>
          </div>

          <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200/50 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 group">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-650 dark:text-purple-400 flex items-center justify-center mb-3">
              <LuUserCheck size={18} />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-1.5">
              Direct Messages
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Start secure, private 1-on-1 chats with any colleague in your workspace. Simply click their profile in the sidebar.
            </p>
          </div>

          <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200/50 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 flex items-center justify-center mb-3">
              <LuShield size={18} />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-1.5">
              Secure Communications
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              All discussions are encrypted in transit and at rest. Strict access controls ensure only authorized members view your workspace data.
            </p>
          </div>

          <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200/50 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 group">
            <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-650 dark:text-pink-400 flex items-center justify-center mb-3">
              <LuServer size={18} />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-1.5">
              Enterprise Trust & SLA
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Backed by robust cloud infrastructure with 99.9% uptime, regular automated backups, and real-time operational transparency.
            </p>
          </div>
        </div>

        {/* Dynamic Tip banner */}
        <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-4 flex items-center gap-3 text-left">
          <div className="text-indigo-500 dark:text-indigo-400">
            <LuSparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Quick Tip</h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              You can search for users or channels in the sidebar search input. Use custom status emojis to express your availability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TeamChat = () => {
  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');

  const [activeRoom, setActiveRoom] = useState({
    id:        null,
    name:      '',
    type:      'team',
    members:   [],
    dmUserId:  null,
    isPrivate: false,
    createdBy: null,
  });

  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // Restore last active room from localStorage on load (if not overridden by roomParam link)
  useEffect(() => {
    if (roomParam) return; // Prioritize deep link room
    if (!workspace?.id || !user?.id) return;

    try {
      const saved = localStorage.getItem(`last_active_room_${workspace.id}_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setActiveRoom(parsed);
        }
      }
    } catch (err) {
      console.warn('Error restoring last active room:', err);
    }
  }, [workspace?.id, user?.id, roomParam]);

  // Parse deep link room param
  useEffect(() => {
    if (!roomParam || !user?.id) return;
    const fetchRoom = async () => {
      try {
        const { data: room, error } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('id', roomParam)
          .single();

        if (!error && room) {
          await joinRoom(room.id, user.id);
          let newRoomState;
          if (room.type === 'direct') {
            const { data: mData } = await supabase
              .from('chat_room_members')
              .select('user_id')
              .eq('room_id', room.id);
            const partner = mData?.find(m => m.user_id !== user.id);
            let partnerName = 'Direct Message';
            let partnerId = null;
            if (partner) {
              partnerId = partner.user_id;
              const { data: pData } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', partnerId)
                .single();
              if (pData) partnerName = pData.name;
            }
            newRoomState = {
              id: room.id,
              name: partnerName,
              type: 'direct',
              members: [],
              dmUserId: partnerId,
              isPrivate: false,
              createdBy: null
            };
          } else {
            newRoomState = {
              id: room.id,
              name: `# ${room.name}`,
              type: 'team',
              members: [],
              dmUserId: null,
              isPrivate: room.is_private,
              createdBy: room.created_by
            };
          }
          setActiveRoom(newRoomState);
          if (workspace?.id && user?.id) {
            localStorage.setItem(`last_active_room_${workspace.id}_${user.id}`, JSON.stringify(newRoomState));
          }
        }
      } catch (err) {
        console.error('Error fetching room from deep link:', err);
      }
    };
    fetchRoom();
  }, [roomParam, user?.id, workspace?.id]);

  const handleSelectRoom = (id, name, type, members, dmUserId = null, isPrivate = false, createdBy = null) => {
    const newRoomState = { id, name, type, members, dmUserId, isPrivate, createdBy };
    setActiveRoom(newRoomState);
    if (workspace?.id && user?.id) {
      if (id) {
        localStorage.setItem(`last_active_room_${workspace.id}_${user.id}`, JSON.stringify(newRoomState));
      } else {
        localStorage.removeItem(`last_active_room_${workspace.id}_${user.id}`);
      }
    }
  };

  const handleRoomUpdated = (newName) => {
    setActiveRoom(prev => {
      const updated = { ...prev, name: `# ${newName}` };
      if (workspace?.id && user?.id && updated.id) {
        localStorage.setItem(`last_active_room_${workspace.id}_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    setSidebarRefreshKey(k => k + 1);
  };

  const handleRoomDeleted = () => {
    setActiveRoom({
      id:        null,
      name:      '',
      type:      'team',
      members:   [],
      dmUserId:  null,
      isPrivate: false,
      createdBy: null,
    });
    if (workspace?.id && user?.id) {
      localStorage.removeItem(`last_active_room_${workspace.id}_${user.id}`);
    }
    setSidebarRefreshKey(k => k + 1);
  };

  return (
    <DashboardLayout activeMenu="Team Chat">
      <div className="team-chat-layout">
        {/* Left: channels + DMs */}
        <div className={`${activeRoom.id ? 'hidden md:flex' : 'flex w-full md:w-[240px] md:shrink-0'} flex-col h-full border-r border-slate-100 dark:border-zinc-800`}>
          <ChatSidebar
            selectedRoomId={activeRoom.id}
            activeDMUserId={activeRoom.dmUserId}
            onSelectRoom={handleSelectRoom}
            refreshTrigger={sidebarRefreshKey}
          />
        </div>

        {/* Right: message feed or landing feature board */}
        <div className={`${activeRoom.id ? 'flex w-full' : 'hidden md:flex md:flex-1'} flex-col h-full overflow-hidden bg-white dark:bg-[#121215]`}>
          {activeRoom.id ? (
            <ChatWindow
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              members={activeRoom.members}
              isPrivate={activeRoom.isPrivate}
              createdBy={activeRoom.createdBy}
              onRoomUpdated={handleRoomUpdated}
              onRoomDeleted={handleRoomDeleted}
              onRoomSwitch={(id, name) => handleSelectRoom(id, name, 'team', [])}
              onBack={() => handleSelectRoom(null, '', 'team', [])}
            />
          ) : (
            <ChatLandingView user={user} workspace={workspace} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeamChat;
