import React, { useState, useEffect, useContext, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { getAuditLogs } from '../../services/auditService';
import {
  LuShield, LuLoaderCircle, LuUser, LuActivity,
  LuClipboard, LuUserPlus, LuUserMinus, LuLogIn,
  LuPencil, LuTrash2, LuSearch, LuFilter,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AuditLog — admin page showing workspace activity trail in a timeline view
// Route: /admin/audit
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_META = {
  'task.created':        { icon: <LuClipboard  />, color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-450 dark:bg-indigo-950/20 ring-indigo-100 dark:ring-indigo-900/30 border border-indigo-205/30' },
  'task.deleted':        { icon: <LuTrash2     />, color: 'text-rose-600 bg-rose-50 dark:text-rose-455 dark:bg-rose-955/15 ring-rose-100 dark:ring-rose-900/30 border border-rose-205/30' },
  'task.status_changed': { icon: <LuActivity   />, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-955/15 ring-amber-100 dark:ring-amber-900/30 border border-amber-205/30' },
  'task.title_updated':  { icon: <LuPencil     />, color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/20 ring-violet-100 dark:ring-violet-900/30 border border-violet-205/30' },
  'member.added':        { icon: <LuUserPlus   />, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-455 dark:bg-emerald-950/20 ring-emerald-100 dark:ring-emerald-900/30 border border-emerald-205/30' },
  'member.removed':      { icon: <LuUserMinus  />, color: 'text-rose-600 bg-rose-50 dark:text-rose-455 dark:bg-rose-955/15 ring-rose-100 dark:ring-rose-900/30 border border-rose-205/30' },
  'member.invited':      { icon: <LuUserPlus   />, color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-450 dark:bg-cyan-950/20 ring-cyan-100 dark:ring-cyan-900/30 border border-cyan-205/30' },
  'member.joined':       { icon: <LuUserPlus   />, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-455 dark:bg-emerald-950/20 ring-emerald-100 dark:ring-emerald-900/30 border border-emerald-205/30' },
  'auth.login':          { icon: <LuLogIn      />, color: 'text-slate-600 bg-slate-50 dark:text-zinc-400 dark:bg-zinc-800/40 ring-slate-100 dark:ring-zinc-700/50 border border-slate-205/30' },
};

const getActionMeta = (action) => ACTION_META[action] || {
  icon: <LuActivity />, color: 'text-slate-600 bg-slate-50 dark:text-zinc-400 dark:bg-zinc-800/40 ring-slate-100 dark:ring-zinc-700/50 border border-slate-205/30',
};

const formatAction = (action) =>
  action.replace(/\./g, ' · ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatMeta = (metadata) => {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const parts = [];
  if (metadata.title)       parts.push(metadata.title);
  if (metadata.old_status)  parts.push(`${metadata.old_status} → ${metadata.new_status}`);
  if (metadata.email)       parts.push(metadata.email);
  if (metadata.role)        parts.push(`Role: ${metadata.role}`);
  return parts.join(' · ') || null;
};

const ACTION_FILTERS = [
  { label: 'All Activities', value: null      },
  { label: 'Tasks',          value: 'task.'   },
  { label: 'Members',        value: 'member.' },
  { label: 'Auth Logins',    value: 'auth.'   },
];

const AuditLog = () => {
  const { workspace } = useContext(WorkspaceContext);

  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterAction, setFilterAction] = useState(null);
  const [search,       setSearch]       = useState('');

  const loadLogs = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const data = await getAuditLogs(workspace.id, { limit: 100, action: filterAction });
      setLogs(data);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, filterAction]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = search
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.userName.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.metadata).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <DashboardLayout activeMenu="Audit Log">
      <div className="mt-4 pb-12 animate-fade-in font-sans">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              🛡️ Audit Activity Trail
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              Complete security trail for <strong className="text-indigo-650 dark:text-indigo-400">{workspace?.name}</strong>
            </p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event type or user..."
              className="field-input pl-9 w-full sm:w-64 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
            />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl w-fit border border-slate-205 dark:border-zinc-800/80 mb-6">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilterAction(f.value)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-transparent transition-all cursor-pointer ${
                filterAction === f.value
                  ? 'bg-white dark:bg-zinc-805 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}
            >
              <LuFilter size={12} />
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline Log View */}
        <div className="card overflow-hidden !p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <LuLoaderCircle className="animate-spin text-indigo-655" size={28} />
              <p className="text-xs text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">Loading system logs...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-zinc-500 font-bold text-xs flex flex-col items-center gap-2 uppercase tracking-wider">
              <LuActivity size={32} className="opacity-30" />
              No audit activities matching query.
            </div>
          ) : (
            <div className="relative border-l border-slate-100 dark:border-zinc-800/80 ml-4 pl-6 space-y-6">
              {filtered.map((log) => {
                const meta = getActionMeta(log.action);
                const detail = formatMeta(log.metadata);

                return (
                  <div key={log.id} className="relative group animate-fade-in">
                    
                    {/* Timeline Node Point with Icon */}
                    <div className={`absolute -left-[38px] top-0.5 w-8 h-8 rounded-xl flex items-center justify-center ring-4 ring-white dark:ring-[#121215] ${meta.color} transition-transform duration-250 group-hover:scale-105`}>
                      {React.cloneElement(meta.icon, { size: 14 })}
                    </div>

                    {/* Timeline Log Box */}
                    <div className="bg-slate-50/40 dark:bg-[#121215]/30 hover:bg-slate-50 dark:hover:bg-[#121215]/80 border border-slate-100 dark:border-zinc-800/80 rounded-xl p-4 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-805 dark:text-zinc-200">
                            {formatAction(log.action)}
                          </span>
                          {detail && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-slate-200/40 dark:border-zinc-700/50">
                              {detail}
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <span className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">
                          {moment(log.createdAt).format('DD MMM, hh:mm A')} · <span className="font-semibold text-slate-400/85 dark:text-zinc-600">{moment(log.createdAt).fromNow()}</span>
                        </span>
                      </div>

                      {/* Actor Badge */}
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100/50 dark:border-zinc-800/50">
                        {log.userAvatar ? (
                          <img src={log.userAvatar} className="w-4 h-4 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-205 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-extrabold text-slate-600 dark:text-zinc-300">
                            <LuUser size={9} />
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                          {log.userName || 'System Agent'}
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Timeline Footer count */}
        {!loading && (
          <p className="text-[10px] text-slate-400 dark:text-zinc-550 text-center mt-4 font-bold uppercase tracking-wider">
            Showing {filtered.length} of {logs.length} system events · Max logs display limit: 100
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLog;
