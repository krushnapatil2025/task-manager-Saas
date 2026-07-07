import React, { useEffect, useState } from 'react';
import { getEmailLogs, resendEmailLog } from '../../services/superAdminService';
import {
  LuMail, LuLoaderCircle, LuSearch, LuCalendar, 
  LuCircleCheck, LuCircleX, LuSparkles, LuRefreshCw
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// EmailLogs — Outbound notifications deliverability log auditor
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLOR = {
  approval:    'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  rejection:   'text-rose-400 bg-rose-500/10 border border-rose-500/20',
  restriction: 'text-red-400 bg-red-500/10 border border-red-500/20',
  registration:'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20',
};

const STATUS_BADGE = {
  sent:   'text-green-400 bg-green-500/10 border border-green-500/25',
  failed: 'text-rose-400 bg-rose-500/10 border border-rose-500/25',
};

const EmailLogs = () => {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getEmailLogs(100);
      setLogs(data);
    } catch (err) {
      toast.error('Failed to load email delivery logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleResend = async (logId) => {
    setResendingId(logId);
    try {
      await resendEmailLog(logId);
      toast.success('Email log re-queued successfully.');
      loadLogs();
    } catch (err) {
      toast.error('Re-send failed: ' + err.message);
    } finally {
      setResendingId(null);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipient.toLowerCase().includes(search.toLowerCase()) || 
                          (log.workspace?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || log.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate deliverability statistics
  const stats = {
    total:      logs.length,
    sent:       logs.filter(l => l.status === 'sent').length,
    failed:     logs.filter(l => l.status === 'failed').length,
    successRate: logs.length ? Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100) : 100,
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuMail className="text-red-400" /> Email Delivery Logs
          </h1>
          <p className="text-slate-400 text-xs mt-1">Audit platform-wide transactional and notification delivery statuses</p>
        </div>
        <button 
          onClick={loadLogs}
          className="px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-800 transition cursor-pointer"
        >
          Refresh Logs
        </button>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Outbound Emails', value: stats.total, color: 'from-slate-800 to-slate-900', text: 'text-white', sub: 'Last 100 delivery attempts' },
          { label: 'Successful Delivery', value: stats.sent, color: 'from-emerald-950/30 to-emerald-900/10 border-emerald-500/20', text: 'text-emerald-400', sub: 'Dispatched successfully' },
          { label: 'Failed Deliveries', value: stats.failed, color: 'from-rose-950/30 to-rose-900/10 border-rose-500/20', text: 'text-rose-400', sub: 'Rejected by mail server' },
          { label: 'Deliverability Rate', value: `${stats.successRate}%`, color: 'from-blue-950/30 to-blue-900/10 border-blue-500/20', text: 'text-blue-400', sub: 'Average platform uptime' },
        ].map((s, idx) => (
          <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
            <span className={`text-2xl font-black mt-1.5 ${s.text}`}>{s.value}</span>
            <span className="text-[9px] text-slate-500 font-semibold mt-1">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Filter panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email logs by recipient address or company name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Log Type</span>
          {[
            { value: null, label: 'All' },
            { value: 'registration', label: 'Invite' },
            { value: 'approval', label: 'Approval' },
            { value: 'rejection', label: 'Rejection' },
          ].map((t) => (
            <button
              key={t.value ?? 'all'}
              onClick={() => setTypeFilter(t.value)}
              className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition capitalize cursor-pointer ${
                typeFilter === t.value
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <LuMail className="text-slate-700 text-4xl mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No deliverability logs captured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">Associated Workspace</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Dispatched At</th>
                  <th className="px-6 py-4">Status Message / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition group">
                    
                    {/* Recipient */}
                    <td className="px-6 py-4 font-semibold text-slate-200 text-xs">
                      {log.recipient}
                    </td>

                    {/* Event Type */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${TYPE_COLOR[log.type] || 'text-slate-400 bg-slate-800 border-slate-750'}`}>
                        {log.type}
                      </span>
                    </td>

                    {/* Associated Workspace */}
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">
                      {log.workspace?.name || '—'}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${STATUS_BADGE[log.status || 'sent']}`}>
                        {log.status === 'sent' ? 'Delivered' : 'Failed'}
                      </span>
                    </td>

                    {/* Sent Date */}
                    <td className="px-6 py-4 text-[10px] text-slate-550 font-semibold">
                      {moment(log.sent_at).format('DD MMM YYYY, h:mm a')}
                      <span className="block text-[8px] text-slate-600 mt-0.5">{moment(log.sent_at).fromNow()}</span>
                    </td>

                    {/* Error / status details + Re-send */}
                    <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.status === 'sent' ? (
                          <span className="text-emerald-500/80 flex items-center gap-1">
                            <LuCircleCheck size={12} /> Dispatch Accepted by Brevo API
                          </span>
                        ) : (
                          <>
                            <span className="text-rose-400 flex items-center gap-1">
                              <LuCircleX size={12} /> {log.error_msg || 'Unknown MTA Reject'}
                            </span>
                            <button
                              onClick={() => handleResend(log.id)}
                              disabled={resendingId === log.id}
                              className="flex items-center gap-1 text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg hover:bg-indigo-500/20 transition cursor-pointer disabled:opacity-50"
                              title="Re-send this email"
                            >
                              <LuRefreshCw size={10} className={resendingId === log.id ? 'animate-spin' : ''} />
                              Re-send
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default EmailLogs;
