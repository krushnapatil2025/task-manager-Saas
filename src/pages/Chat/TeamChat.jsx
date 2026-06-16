import React, { useState } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ChatSidebar from '../../components/ChatSidebar';
import ChatWindow  from '../../components/ChatWindow';

// ─────────────────────────────────────────────────────────────────────────────
// TeamChat — Phase 17 — Main chat page
// Combines ChatSidebar (left) + ChatWindow (right)
// ─────────────────────────────────────────────────────────────────────────────

const TeamChat = () => {
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
