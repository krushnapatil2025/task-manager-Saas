import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ChatWindow from '../../components/ChatWindow';
import { UserContext }      from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { getOrCreateDM, joinRoom, getRoomMembers } from '../../services/chatService';
import { getWorkspaceMembers } from '../../services/workspaceService';
import { LuLoaderCircle, LuMessageSquare, LuArrowLeft } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// DirectMessages — Phase 16
// Route: /chat/dm/:userId  or  /chat  (shows member list to pick)
// ─────────────────────────────────────────────────────────────────────────────

const DirectMessages = () => {
  const { userId: targetUserId } = useParams();
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();

  const [roomId,   setRoomId  ] = useState(null);
  const [roomName, setRoomName] = useState('Direct Message');
  const [members,  setMembers ] = useState([]);
  const [wsMembers, setWsMembers] = useState([]);
  const [loading,  setLoading ] = useState(false);

  // ── Open a DM room with a specific user ──────────────────────────────────
  const openDM = useCallback(async (toUserId, toUserName) => {
    if (!workspace?.id || !user?.id) return;
    setLoading(true);
    try {
      const id = await getOrCreateDM(workspace.id, user.id, toUserId);
      await joinRoom(id, user.id);
      const roomMems = await getRoomMembers(id);
      setRoomId(id);
      setRoomName(toUserName || 'DM');
      setMembers(roomMems);
    } catch {
      toast.error('Could not open conversation');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, user?.id]);

  // ── If targetUserId in URL, open DM immediately ───────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!workspace?.id || !user?.id) return;
      const mems = await getWorkspaceMembers(workspace.id);
      setWsMembers(mems.filter(m => m.id !== user.id));

      if (targetUserId) {
        const target = mems.find(m => m.id === targetUserId);
        await openDM(targetUserId, target?.name || 'User');
      }
    };
    init();
  }, [workspace?.id, user?.id, targetUserId, openDM]);

  return (
    <DashboardLayout activeMenu="Team Chat">
      <div className="dm-layout">
        {/* Member list sidebar */}
        <div className={`${targetUserId ? 'hidden md:flex' : 'flex w-full md:w-[220px] md:shrink-0'} flex-col h-full border-r border-slate-100 dark:border-zinc-805`}>
          <div className="chat-sidebar-header">
            <div className="flex items-center gap-2">
              <LuMessageSquare size={15} className="text-indigo-400" />
              <span className="chat-sidebar-title">Direct Messages</span>
            </div>
          </div>
          <div className="chat-sidebar-section">
            <div className="chat-sidebar-section-header"><span>WORKSPACE MEMBERS</span></div>
            {wsMembers.map(m => (
              <button
                key={m.id}
                className={`chat-sidebar-item ${roomId && m.id === targetUserId ? 'chat-sidebar-item--active' : ''}`}
                onClick={() => {
                  navigate(`/chat/dm/${m.id}`);
                  openDM(m.id, m.name || 'User');
                }}
              >
                {m.profileImageUrl
                  ? <img src={m.profileImageUrl} alt={m.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-5 h-5 rounded-full bg-indigo-400 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                      {(m.name || 'U')[0].toUpperCase()}
                    </div>}
                <span className="chat-sidebar-item-name truncate">{m.name || 'Member'}</span>
              </button>
            ))}
            {wsMembers.length === 0 && (
              <p className="chat-sidebar-empty">No other members</p>
            )}
          </div>
        </div>

        {/* Chat window */}
        <div className={`${targetUserId ? 'flex w-full' : 'hidden md:flex md:flex-1'} flex-col h-full overflow-hidden bg-white dark:bg-[#121215]`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LuLoaderCircle className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : (
            <ChatWindow 
              roomId={roomId} 
              roomName={roomName} 
              members={members} 
              onRoomSwitch={(id, name) => {
                if (name.startsWith('#')) {
                  navigate('/chat');
                }
              }}
              onBack={() => navigate('/chat')}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DirectMessages;
