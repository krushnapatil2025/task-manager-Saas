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
// AuditLog — admin page showing workspace activity trail
// Route: /admin/audit
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_META = {
  'task.created':        { icon: <LuClipboard  />, color: 'text-blue-500  bg-blue-50'   },
  'task.deleted':        { icon: <LuTrash2     />, color: 'text-red-500   bg-red-50'    },
  'task.status_changed': { icon: <LuActivity   />, color: 'text-amber-500 bg-amber-50'  },
  'task.title_updated':  { icon: <LuPencil     />, color: 'text-violet-500 bg-violet-50' },
  'member.added':        { icon: <LuUserPlus   />, color: 'text-lime-500  bg-lime-50'   },
  'member.removed':      { icon: <LuUserMinus  />, color: 'text-red-500   bg-red-50'    },
  'member.invited':      { icon: <LuUserPlus   />, color: 'text-cyan-500  bg-cyan-50'   },
  'member.joined':       { icon: <LuUserPlus   />, color: 'text-lime-500  bg-lime-50'   },
  'auth.login':          { icon: <LuLogIn      />, color: 'text-gray-500  bg-gray-100'  },
};

const getActionMeta = (action) => ACTION_META[action] || {
  icon: <LuActivity />, color: 'text-gray-500 bg-gray-100',
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
  { label: 'All',     value: null      },
  { label: 'Tasks',   value: 'task.'   },
  { label: 'Members', value: 'member.' },
  { label: 'Auth',    value: 'auth.'   },
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
      <div className="mt-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <LuShield className="text-blue-500" /> Audit Log
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Complete activity trail for <strong className="text-gray-600">{workspace?.name}</strong>
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-56"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilterAction(f.value)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition ${
                filterAction === f.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              <LuFilter className="text-[10px]" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Log table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <LuLoaderCircle className="text-blue-500 text-2xl animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No audit events found.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((log) => {
                const meta = getActionMeta(log.action);
                const detail = formatMeta(log.metadata);

                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition">
                    {/* Action icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm mt-0.5 ${meta.color}`}>
                      {meta.icon}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">
                          {formatAction(log.action)}
                        </span>
                        {detail && (
                          <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                            {detail}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        {/* User */}
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          {log.userAvatar ? (
                            <img src={log.userAvatar} className="w-3.5 h-3.5 rounded-full" alt="" />
                          ) : (
                            <LuUser className="text-[10px]" />
                          )}
                          {log.userName}
                        </span>

                        <span className="text-gray-200">·</span>

                        {/* Time */}
                        <span className="text-[11px] text-gray-400">
                          {moment(log.createdAt).format('DD MMM YYYY, HH:mm')}
                          <span className="text-gray-300 ml-1">({moment(log.createdAt).fromNow()})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Count footer */}
        {!loading && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Showing {filtered.length} of {logs.length} events · Last 100 entries
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLog;
