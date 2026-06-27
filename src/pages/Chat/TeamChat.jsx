import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ChatSidebar from '../../components/ChatSidebar';
import ChatWindow  from '../../components/ChatWindow';
import { UserContext } from '../../context/userContext';
import { supabase } from '../../utils/supabaseClient';
import { joinRoom } from '../../services/chatService';

// ─────────────────────────────────────────────────────────────────────────────
// TeamChat — Phase 17 — Main chat page
// Combines ChatSidebar (left) + ChatWindow (right)
// ─────────────────────────────────────────────────────────────────────────────

const TeamChat = () => {
  const { user } = useContext(UserContext);
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
            setActiveRoom({
              id: room.id,
              name: partnerName,
              type: 'direct',
              members: [],
              dmUserId: partnerId,
              isPrivate: false,
              createdBy: null
            });
          } else {
            setActiveRoom({
              id: room.id,
              name: `# ${room.name}`,
              type: 'team',
              members: [],
              dmUserId: null,
              isPrivate: room.is_private,
              createdBy: room.created_by
            });
          }
        }
      } catch (err) {
        console.error('Error fetching room from deep link:', err);
      }
    };
    fetchRoom();
  }, [roomParam, user?.id]);

  const handleSelectRoom = (id, name, type, members, dmUserId = null, isPrivate = false, createdBy = null) => {
    setActiveRoom({ id, name, type, members, dmUserId, isPrivate, createdBy });
  };

  const handleRoomUpdated = (newName) => {
    setActiveRoom(prev => ({ ...prev, name: `# ${newName}` }));
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
    setSidebarRefreshKey(k => k + 1);
  };

  return (
    <DashboardLayout activeMenu="Team Chat">
      <div className="team-chat-layout">
        {/* Left: channels + DMs */}
        <ChatSidebar
          selectedRoomId={activeRoom.id}
          activeDMUserId={activeRoom.dmUserId}
          onSelectRoom={handleSelectRoom}
          refreshTrigger={sidebarRefreshKey}
        />

        {/* Right: message feed */}
        <div className="team-chat-main">
          <ChatWindow
            roomId={activeRoom.id}
            roomName={activeRoom.name}
            members={activeRoom.members}
            isPrivate={activeRoom.isPrivate}
            createdBy={activeRoom.createdBy}
            onRoomUpdated={handleRoomUpdated}
            onRoomDeleted={handleRoomDeleted}
            onRoomSwitch={(id, name) => handleSelectRoom(id, name, 'team', [])}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeamChat;
