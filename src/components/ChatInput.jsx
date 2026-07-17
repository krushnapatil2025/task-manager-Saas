import React, { useState, useRef, useEffect } from 'react';
import { 
  LuSend, LuLoaderCircle, LuSmile, LuPaperclip, 
  LuMic, LuTrash2, LuBold, LuItalic, LuStrikethrough, 
  LuCode, LuTerminal, LuX, LuCheck, LuImage, LuChartPie,
  LuClock
} from 'react-icons/lu';
import { uploadFileToGoogleDrive, getReplyContentPreview } from '../services/chatService';
import FullEmojiPicker from './FullEmojiPicker';
import GifPickerPanel from './GifPickerPanel';
import SlashCommandPalette from './SlashCommandPalette';
import ScheduleSendModal from './ScheduleSendModal';
import { supabase } from '../utils/supabaseClient';
import { updateProfile } from '../services/userService';
import { toast } from 'react-hot-toast';

const ChatInput = ({ 
  onSend, 
  onTyping, 
  sending = false, 
  placeholder = 'Type a message…', 
  members = [],
  replyingToMessage = null,
  onClearReply = null,
  onPollClick = null,
  onScheduleSend = null
}) => {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [mentionList, setMentionList] = useState([]);
  const [mentionQ, setMentionQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // Auto-resize message input height based on content length
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

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

    const isCmd = v.startsWith('/') && !v.includes(' ');
    if (isCmd) {
      setShowCommands(true);
      setCommandQuery(v.substring(1));
    } else {
      setShowCommands(false);
      setCommandQuery('');
    }
  };

  const insertMention = (name) => {
    setValue(prev => prev.replace(/@\w*$/, `@${name} `));
    setMentionList([]);
    inputRef.current?.focus();
  };

  const handleSelectCommand = (commandItem) => {
    setShowCommands(false);
    if (commandItem.cmd === '/poll') {
      setValue('');
      if (onPollClick) {
        onPollClick();
      }
    } else if (commandItem.cmd === '/giphy') {
      setValue('/giphy ');
      inputRef.current?.focus();
    } else if (commandItem.cmd === '/status') {
      setValue('/status ');
      inputRef.current?.focus();
    } else if (commandItem.cmd === '/remind') {
      setValue('/remind ');
      inputRef.current?.focus();
    }
  };

  const handleSend = async () => {
    if (!value.trim() || sending) return;
    const content = value.trim();
    setValue('');
    setShowEmoji(false);
    setShowGif(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    if (onTyping) onTyping(false);

    // Process Slash Commands
    if (content.startsWith('/')) {
      const parts = content.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ').trim();

      if (cmd === '/poll') {
        if (onPollClick) {
          onPollClick();
        }
        return;
      }

      if (cmd === '/giphy') {
        if (!arg) {
          toast.error('Please specify a search term. Usage: /giphy [term]');
          return;
        }
        const mockGifs = [
          'https://media.giphy.com/media/l0MYEqEzw5FNMK9Ko/giphy.gif',
          'https://media.giphy.com/media/3o7abKhOpu0NXS3HLG/giphy.gif',
          'https://media.giphy.com/media/26fPplvPPA2PspW3C/giphy.gif',
          'https://media.giphy.com/media/l0HlIDZ4gW8gBvG4o/giphy.gif',
          'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
          'https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif',
          'https://media.giphy.com/media/5yLgoceFO3BdJW1QL68/giphy.gif',
        ];
        const randomGif = mockGifs[Math.floor(Math.random() * mockGifs.length)];
        const contentToSend = `Sent a Giphy GIF for **"${arg}"**:\n\n![${arg}](${randomGif})`;
        await onSend(contentToSend, 'text');
        return;
      }

      if (cmd === '/status') {
        if (!arg) {
          toast.error('Please specify a status. Usage: /status [text]');
          return;
        }
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await updateProfile(authUser.id, { status_text: arg, status_emoji: '💬' });
            toast.success(`Status updated to: "${arg}"`);
            window.dispatchEvent(new Event('user-profile-updated'));
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to update status.');
        }
        return;
      }

      if (cmd === '/remind') {
        if (!arg) {
          toast.error('Please specify a user and message. Usage: /remind @username [message]');
          return;
        }
        const contentToSend = `⏰ **Reminder Scheduled**:\n\n"${arg}"`;
        await onSend(contentToSend, 'text');
        return;
      }
    }

    await onSend(content, 'text');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowEmoji(false);
      setShowGif(false);
    }
  };

  const handleScheduleConfirm = async (scheduledAt) => {
    setShowScheduleModal(false);
    if (!value.trim() || !onScheduleSend) return;
    const content = value.trim();
    setValue('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    if (onTyping) onTyping(false);

    try {
      await onScheduleSend(content, 'text', null, scheduledAt);
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule message.');
      setValue(content); // restore text if scheduling failed
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToGoogleDrive(file);
      await onSend(res.name, res.type, res.url);
    } catch (err) {
      console.error(err);
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Markdown injection helper
  const insertMarkdown = (syntaxBefore, syntaxAfter = '') => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end);
    const replacement = syntaxBefore + selectedText + (syntaxAfter || syntaxBefore);
    
    setValue(text.substring(0, start) + replacement + text.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntaxBefore.length, start + syntaxBefore.length + selectedText.length);
    }, 0);
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioChunksRef.current.length === 0 || audioBlob.size < 100) return;

        setUploading(true);
        try {
          const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          const res = await uploadFileToGoogleDrive(file);
          // Send as voice message type
          await onSend('Voice Message', 'audio', res.url);
        } catch (err) {
          console.error('Failed to send audio:', err);
          alert('Failed to send voice message.');
        } finally {
          setUploading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Microphone access denied or not supported.');
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    if (!shouldSend) {
      audioChunksRef.current = [];
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectGif = async (gif) => {
    setShowGif(false);
    // Send directly formatted URL
    const fileUrl = `${gif.url}||${gif.url}||${gif.title}.gif||GIF`;
    await onSend(gif.title, 'image', fileUrl);
  };

  return (
    <div className="chat-input-wrap relative border border-slate-200/80 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
      {/* 1. Reply Quoted Message Bar */}
      {replyingToMessage && (
        <div className="flex items-center justify-between bg-indigo-50/50 px-4 py-2.5 border-b border-slate-100 text-xs text-slate-600 animate-fade-in">
          <div className="border-l-3 border-indigo-500 pl-2.5 min-w-0">
            <span className="font-bold text-indigo-700 block text-[10px] uppercase tracking-wider mb-0.5">
              Replying to {replyingToMessage.senderName}
            </span>
            <span className="truncate block text-slate-500 max-w-[280px] sm:max-w-md">
              {getReplyContentPreview(replyingToMessage.content, replyingToMessage.type, replyingToMessage.fileUrl)}
            </span>
          </div>
          <button 
            onClick={onClearReply} 
            className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center cursor-pointer"
          >
            <LuX size={14} />
          </button>
        </div>
      )}

      {/* 2. Rich Text Formatting Toolbar */}
      {!isRecording && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-100/60 bg-slate-50/30">
          <button
            onClick={() => insertMarkdown('**')}
            className="p-1 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Bold (Ctrl+B)"
          >
            <LuBold size={13} />
          </button>
          <button
            onClick={() => insertMarkdown('*')}
            className="p-1 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Italic (Ctrl+I)"
          >
            <LuItalic size={13} />
          </button>
          <button
            onClick={() => insertMarkdown('~~')}
            className="p-1 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Strikethrough"
          >
            <LuStrikethrough size={13} />
          </button>
          <div className="h-3 w-[1px] bg-slate-200" />
          <button
            onClick={() => insertMarkdown('`', '`')}
            className="p-1 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Code Inline"
          >
            <LuCode size={13} />
          </button>
          <button
            onClick={() => insertMarkdown('```\n', '\n```')}
            className="p-1 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Code Block"
          >
            <LuTerminal size={13} />
          </button>
        </div>
      )}

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

      {/* Slash Commands Palette */}
      {showCommands && (
        <SlashCommandPalette
          query={commandQuery}
          onSelectCommand={handleSelectCommand}
        />
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

      {/* GIF Picker */}
      {showGif && (
        <GifPickerPanel
          onSelect={handleSelectGif}
          onClose={() => setShowGif(false)}
        />
      )}

      {/* 3. Input Row */}
      <div className="chat-input-row flex items-center px-3 py-2 bg-white gap-2">
        {/* File Attach Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {isRecording ? (
          // Recording UI Overlay
          <div className="flex-1 flex items-center justify-between bg-rose-50/50 rounded-xl px-3 py-1.5 border border-rose-100/50 animate-pulse-slow">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping flex-shrink-0" />
              <span className="text-xs font-semibold text-rose-700">Recording</span>
              <span className="text-xs text-rose-500 font-mono pl-1">{formatTime(recordingTime)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => stopRecording(false)} 
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 rounded-lg transition-colors cursor-pointer"
                title="Cancel Recording"
              >
                <LuTrash2 size={15} />
              </button>
              <button 
                onClick={() => stopRecording(true)} 
                className="p-1 bg-rose-600 hover:bg-rose-750 text-white rounded-lg transition-colors flex items-center justify-center w-7 h-7 cursor-pointer"
                title="Send Recording"
              >
                <LuCheck size={14} />
              </button>
            </div>
          </div>
        ) : (
          // Standard Composer Row
          <>
            <button
              className="chat-input-icon-btn text-slate-400 hover:text-slate-655 p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
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

            {onPollClick && (
              <button 
                className="chat-input-icon-btn text-slate-400 hover:text-slate-655 p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                onClick={onPollClick} 
                title="Create Poll" 
                disabled={uploading || sending}
              >
                <LuChartPie size={17} />
              </button>
            )}

            <button 
              className={`chat-input-icon-btn p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${showEmoji ? 'text-indigo-650 bg-indigo-50' : 'text-slate-400 hover:text-slate-655'}`}
              onClick={() => {
                setShowEmoji(v => !v);
                setShowGif(false);
              }} 
              title="Emoji" 
              disabled={uploading || sending}
            >
              <LuSmile size={17} />
            </button>

            <button 
              className={`chat-input-icon-btn p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${showGif ? 'text-indigo-650 bg-indigo-50' : 'text-slate-400 hover:text-slate-655'}`}
              onClick={() => {
                setShowGif(v => !v);
                setShowEmoji(false);
              }} 
              title="GIFs" 
              disabled={uploading || sending}
            >
              <LuImage size={17} />
            </button>

            <textarea
              ref={inputRef}
              id="chat-main-input"
              className="chat-input-field flex-1 bg-transparent text-xs text-slate-700 outline-none border-none resize-none max-h-24 py-1.5 pl-1 custom-scrollbar placeholder:text-slate-400"
              placeholder={uploading ? "Uploading attachment..." : placeholder}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending || uploading}
            />

            {value.trim() ? (
              <div className="flex items-center gap-1">
                {onScheduleSend && (
                  <button
                    type="button"
                    className="chat-input-icon-btn text-slate-400 hover:text-indigo-650 p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => setShowScheduleModal(true)}
                    disabled={sending || uploading}
                    title="Schedule Send"
                  >
                    <LuClock size={17} />
                  </button>
                )}
                <button
                  className="chat-send-btn bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl w-7.5 h-7.5 flex items-center justify-center transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 cursor-pointer flex-shrink-0"
                  onClick={handleSend}
                  disabled={sending || uploading}
                  title="Send (Enter)"
                >
                  {sending ? (
                    <LuLoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <LuSend size={15} />
                  )}
                </button>
              </div>
            ) : (
              <button
                className="chat-input-icon-btn text-slate-400 hover:text-slate-655 p-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                onClick={startRecording}
                disabled={sending || uploading}
                title="Record Voice Message"
              >
                <LuMic size={17} />
              </button>
            )}
          </>
        )}
      </div>

      {showScheduleModal && (
        <ScheduleSendModal
          message={value}
          onSchedule={handleScheduleConfirm}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
};

export default ChatInput;
