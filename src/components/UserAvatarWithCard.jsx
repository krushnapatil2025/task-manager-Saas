import React, { useState, useRef } from 'react';
import UserProfileHoverCard from './UserProfileHoverCard';

const UserAvatarWithCard = ({ 
  userId, 
  userName, 
  userAvatar, 
  onlineUsers = {}, 
  avatarClass = "chat-msg-av",
  fallbackStyle = {},
  fallbackClass = "chat-msg-av chat-msg-av--fallback"
}) => {
  const [showCard, setShowCard] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowCard(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowCard(false);
    }, 450); // 450ms leeway to let the user move their cursor onto the card
  };

  const isOnline = !!onlineUsers[userId];

  return (
    <div 
      className="relative flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {userAvatar ? (
        <img
          src={userAvatar}
          alt={userName}
          className={`${avatarClass} transition-all duration-300 ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
        />
      ) : (
        <div
          className={`${fallbackClass} transition-all duration-300 ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
          style={fallbackStyle}
        >
          {userName?.[0]?.toUpperCase() || 'U'}
        </div>
      )}

      {isOnline && (
        <span className="absolute bottom-0 right-0 block w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" />
      )}

      {showCard && (
        <UserProfileHoverCard 
          userId={userId} 
          onClose={() => setShowCard(false)} 
        />
      )}
    </div>
  );
};

export default UserAvatarWithCard;
