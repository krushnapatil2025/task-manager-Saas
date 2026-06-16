import React, { useState, useRef, useEffect } from 'react';
import { LuSend, LuLoaderCircle, LuSmile, LuPaperclip } from 'react-icons/lu';
import { uploadFileToGoogleDrive } from '../services/chatService';
import FullEmojiPicker from './FullEmojiPicker';

// ─────────────────────────────────────────────────────────────────────────────
// ChatInput — message composer for TeamChat / DirectMessages
// Props:
//   onSend(content, type, fileUrl)   async
//   sending                          boolean
//   placeholder                      string
//   members                          Array<{ id, name }> — for @mention autocomplete
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍','❤️','😂','🔥','✅','🎉','😮','🙏'];

const ChatInput = ({ onSend, onTyping, sending = false, placeholder = 'Type a message…', members = [] }) => {
  const [value,       setValue      ] = useState('');
  const [showEmoji,   setShowEmoji  ] = useState(false);
  const [mentionList, setMentionList] = useState([]);
  const [mentionQ,    setMentionQ   ] = useState('');
  const [uploading,   setUploading  ] = useState(false);
  const [isTyping,    setIsTyping   ] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);

    if (onTyping) {
      if (!isTyping && v.trim().length > 0) {
        setIsTyping(true);
        onTyping(true);
      } else if (v.trim().length === 0 && isTyping) {
        setIsTyping(false);
        onTyping(false);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 3000);
    }

    const match = v.match(/@(\w*)$/);
    if (match && members.length) {
      setMentionQ(match[1].toLowerCase());
      setMentionList(members.filter(m => m.name.toLowerCase().startsWith(match[1].toLowerCase())));
    } else {
      setMentionList([]);
    }
  };

  const insertMention = (name) => {
    setValue(prev => prev.replace(/@\w*$/, `@${name} `));
    setMentionList([]);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!value.trim() || sending) return;
    const content = value.trim();
    setValue('');
    setShowEmoji(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    if (onTyping) onTyping(false);
    await onSend(content, 'text');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setShowEmoji(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToGoogleDrive(file);
      // Send the file details immediately
      await onSend(res.name, res.type, res.url);
    } catch (err) {
      console.error(err);
      alert('Failed to upload file to Google Drive.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="chat-input-wrap">
      {/* @mention dropdown */}
      {mentionList.length > 0 && (
        <div className="chat-mention-dropdown">
          {mentionList.slice(0, 6).map(m => (
            <button key={m.id} className="chat-mention-item" onClick={() => insertMention(m.name)}>
              <span className="chat-mention-avatar">
                {m.avatar
                  ? <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                  : <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">{m.name[0]}</span>}
              </span>
              @{m.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="absolute bottom-full left-4 z-50 mb-2">
          <FullEmojiPicker
            onSelect={(emoji) => {
              setValue(v => v + emoji);
              inputRef.current?.focus();
            }}
            onClose={() => setShowEmoji(false)}
          />
        </div>
      )}

      <div className="chat-input-row">
        {/* File Attach Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          className="chat-input-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach File / Image"
          disabled={uploading || sending}
        >
          {uploading ? (
            <LuLoaderCircle size={17} className="animate-spin text-indigo-500" />
          ) : (
            <LuPaperclip size={17} />
          )}
        </button>

        <button className="chat-input-icon-btn" onClick={() => setShowEmoji(v => !v)} title="Emoji" disabled={uploading || sending}>
          <LuSmile size={17} />
        </button>

        <textarea
          ref={inputRef}
          id="chat-main-input"
          className="chat-input-field"
          placeholder={uploading ? "Uploading attachment..." : placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending || uploading}
        />

        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!value.trim() || sending || uploading}
          title="Send (Enter)"
        >
          {sending
            ? <LuLoaderCircle size={15} className="animate-spin" />
            : <LuSend size={15} />}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
