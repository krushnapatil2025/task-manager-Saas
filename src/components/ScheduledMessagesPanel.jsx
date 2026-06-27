import React, { useEffect, useState, useCallback } from 'react';
import { LuClock, LuX, LuTrash2, LuSend, LuCalendar, LuLoaderCircle, LuPencil } from 'react-icons/lu';
import moment from 'moment';
import { getScheduledMessages, cancelScheduledMessage, publishScheduledMessage } from '../services/chatService';
import { toast } from 'react-hot-toast';

export const ScheduledMessagesPanel = ({ userId, roomId, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(null); // messageId being published

  const load = useCallback(async () => {
    if (!userId || !roomId) return;
    setLoading(true);
    try {
      const data = await getScheduledMessages(userId, roomId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load scheduled messages:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSendNow = async (msg) => {
    setPublishing(msg.id);
    try {
      await publishScheduledMessage(msg.id);
      toast.success('Message sent now!');
      await load();
    } catch (err) {
      toast.error('Failed to send message.');
    } finally {
      setPublishing(null);
    }
  };

  const handleCancel = async (msgId) => {
    if (!window.confirm('Delete this scheduled message?')) return;
    try {
      await cancelScheduledMessage(msgId);
      toast.success('Scheduled message deleted.');
      await load();
    } catch (err) {
      toast.error('Failed to delete scheduled message.');
    }
  };

  return (
    <div className="w-80 border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-full flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <LuClock size={14} className="text-violet-600 dark:text-violet-400" />
          </div>
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-200">
            Scheduled Messages
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 transition-colors"
        >
          <LuX size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LuLoaderCircle size={22} className="animate-spin text-indigo-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-zinc-900 flex items-center justify-center">
              <LuCalendar size={24} className="text-slate-300 dark:text-zinc-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">No scheduled messages</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">
                Use the clock icon to schedule a message
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const scheduledMoment = moment(msg.scheduledAt);
            const isOverdue = scheduledMoment.isBefore(moment());
            const isPub = publishing === msg.id;

            return (
              <div
                key={msg.id}
                className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all ${
                  isOverdue
                    ? 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10'
                    : 'border-slate-100 dark:border-zinc-900 bg-slate-50/40 dark:bg-zinc-900/20'
                }`}
              >
                {/* Scheduled time badge */}
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                    isOverdue
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                      : 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400'
                  }`}>
                    <LuClock size={9} />
                    <span>{isOverdue ? '⚠ Overdue — ' : ''}{scheduledMoment.format('MMM D [at] h:mm A')}</span>
                  </div>
                  <span className="text-[8.5px] text-slate-400 dark:text-zinc-600">
                    {scheduledMoment.fromNow()}
                  </span>
                </div>

                {/* Message content preview */}
                <p className="text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed line-clamp-3">
                  {msg.content || <span className="italic text-slate-400">📎 Attachment</span>}
                </p>

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleSendNow(msg)}
                    disabled={isPub}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold disabled:opacity-60 transition-all cursor-pointer"
                    title="Send Now"
                  >
                    {isPub ? (
                      <LuLoaderCircle size={11} className="animate-spin" />
                    ) : (
                      <LuSend size={11} />
                    )}
                    <span>Send Now</span>
                  </button>
                  <button
                    onClick={() => handleCancel(msg.id)}
                    disabled={isPub}
                    className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 text-slate-500 hover:text-rose-600 transition-all text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    title="Delete scheduled message"
                  >
                    <LuTrash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer refresh */}
      <div className="p-3 border-t border-slate-100 dark:border-zinc-900">
        <button
          onClick={load}
          className="w-full text-center text-[10px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors py-1"
        >
          Refresh list
        </button>
      </div>
    </div>
  );
};

export default ScheduledMessagesPanel;
