import React, { useContext } from 'react';
import moment from 'moment';
import { LuTrash2, LuPencil } from 'react-icons/lu';
import { UserContext } from '../context/userContext';
import ReactionBar from './ReactionBar';

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessage — single message bubble for TaskChatPanel
// ─────────────────────────────────────────────────────────────────────────────

const ChatMessage = ({ message, onDelete, onReact }) => {
  const { user } = useContext(UserContext);
  const isOwn    = message.authorId === user?.id;
  const isSystem = message.type === 'system';

  // ── System event messages (status change, assignment, etc.) ───────────────
  if (isSystem) {
    return (
      <div className="chat-msg-system">
        <span className="chat-msg-system-dot" />
        <span className="chat-msg-system-text">{message.content}</span>
        <span className="chat-msg-system-time">
          {moment(message.createdAt).fromNow()}
        </span>
      </div>
    );
  }

  return (
    <div className={`chat-msg-wrap group ${isOwn ? 'chat-msg-wrap--own' : ''}`}>
      {/* Avatar */}
      {!isOwn && (
        message.authorAvatar
          ? <img src={message.authorAvatar} alt={message.authorName}
              className="chat-msg-avatar" />
          : <div className="chat-msg-avatar-fallback">
              {message.authorName?.[0]?.toUpperCase()}
            </div>
      )}

      {/* Bubble + metadata */}
      <div className={`chat-msg-content ${isOwn ? 'chat-msg-content--own' : ''}`}>
        {/* Author + time */}
        {!isOwn && (
          <div className="chat-msg-meta">
            <span className="chat-msg-author">{message.authorName}</span>
            <span className="chat-msg-time">{moment(message.createdAt).format('h:mm A')}</span>
            {message.editedAt && (
              <span className="chat-msg-edited">
                <LuPencil size={9} /> edited
              </span>
            )}
          </div>
        )}

        <div className={`chat-msg-bubble ${isOwn ? 'chat-msg-bubble--own' : 'chat-msg-bubble--other'}`}>
          {/* Highlight @mentions */}
          <p className="chat-msg-text">
            {message.content.split(/(@\w+)/g).map((part, i) =>
              part.startsWith('@')
                ? <strong key={i} className="chat-msg-mention">{part}</strong>
                : part
            )}
          </p>
        </div>

        {/* Own: time on right */}
        {isOwn && (
          <div className="chat-msg-meta chat-msg-meta--own">
            {message.editedAt && (
              <span className="chat-msg-edited"><LuPencil size={9} /> edited</span>
            )}
            <span className="chat-msg-time">{moment(message.createdAt).format('h:mm A')}</span>
          </div>
        )}

        {/* Reactions */}
        <ReactionBar
          messageId={message.id}
          reactions={message.reactions}
          onReact={onReact}
        />
      </div>

      {/* Delete button (own messages only) */}
      {isOwn && (
        <button
          onClick={() => onDelete(message.id)}
          className="chat-msg-del opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete message"
        >
          <LuTrash2 size={12} />
        </button>
      )}
    </div>
  );
};

export default ChatMessage;
