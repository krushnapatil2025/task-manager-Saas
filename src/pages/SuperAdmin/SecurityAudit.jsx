import React, { useEffect, useState } from 'react';
import { getPlatformAuditLogs } from '../../services/superAdminService';
import {
  LuLock, LuLoaderCircle, LuSearch, LuEye,
  LuShieldAlert, LuX, LuInfo, LuDownload, LuCalendar
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SecurityAudit — Full compliance event trace auditor for Super Admins (Phase 8)
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_COLOR = {
  'task.created':                    'text-blue-400 bg-blue-500/10 border border-blue-500/20',
  'task.deleted':                    'text-rose-400 bg-rose-500/10 border border-rose-500/20',
  'task.status_changed':             'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  'member.added':                    'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  'member.invited':                  'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
  'auth.login':                      'text-slate-400 bg-slate-700/30 border border-slate-650',
  'auth.failed_login':               'text-red-400 bg-red-500/10 border border-red-500/20',
  'company.registration.approved':   'text-green-400 bg-green-500/10 border border-green-500/20',
  'company.registration.rejected':   'text-rose-400 bg-rose-500/10 border border-rose-500/20',
  'company.registration.restricted': 'text-red-400 bg-red-500/10 border border-red-500/20',
};

const SecurityAudit = () => {
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [selectedLog,  setSelectedLog]  = useState(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getPlatformAuditLogs(500); // fetch large set for client filtering
      setLogs(data);
    } catch (err) {
      toast.error('Failed to load compliance audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = logs.filter(log => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      log.userName.toLowerCase().includes(searchLower) ||
      (log.resource || '').toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower);
    const matchesAction = !actionFilter || log.action === actionFilter;
    const logDate = moment(log.createdAt);
    const matchesFrom = !dateFrom || logDate.isSameOrAfter(moment(dateFrom), 'day');
    const matchesTo   = !dateTo   || logDate.isSameOrBefore(moment(dateTo), 'day');
    return matchesSearch && matchesAction && matchesFrom && matchesTo;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) { toast.error('No audit logs to export.'); return; }
    const headers = ['Event ID', 'Operator', 'Action', 'Resource', 'Workspace ID', 'Timestamp'];
    const rows = filteredLogs.map(l => [l.id, l.userName, l.action, l.resource || '', l.workspaceId || '', moment(l.createdAt).format('YYYY-MM-DD HH:mm:ss')]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `security_audit_${moment().format('YYYYMMDD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit CSV exported!');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuLock className="text-red-500" /> Security Audit Logs
          </h1>
          <p className="text-slate-400 text-xs mt-1">Platform compliance logging, SA credential events, and operation audits</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-800 transition cursor-pointer">
            <LuDownload size={13} /> Export CSV
          </button>
          <button onClick={loadLogs} className="flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-800 transition cursor-pointer">
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by operator, action, or resource ID..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        {/* Action type filter */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
          <LuShieldAlert className="text-slate-500 text-sm flex-shrink-0" />
          <select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(act => (
              <option key={act} value={act} className="bg-slate-950 text-slate-300">{act}</option>
            ))}
          </select>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3 py-2 rounded-xl">
          <LuCalendar className="text-slate-500 text-sm flex-shrink-0" />
          <span className="text-[10px] text-slate-500 font-bold uppercase">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-xs text-slate-300 border-none focus:outline-none cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 font-bold uppercase">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-xs text-slate-300 border-none focus:outline-none cursor-pointer"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-slate-500 hover:text-white transition cursor-pointer">
              <LuX size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
        <span>{filteredLogs.length} of {logs.length} events</span>
        {(search || actionFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setActionFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-indigo-400 hover:text-indigo-300 transition cursor-pointer ml-1"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <LuShieldAlert className="text-slate-700 text-4xl mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No compliance logs matched your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">Action Type</th>
                  <th className="px-6 py-4">Resource Target</th>
                  <th className="px-6 py-4">Captured Time</th>
                  <th className="px-6 py-4">Workspace Context</th>
                  <th className="px-6 py-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition group">
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-[10px] text-slate-300">
                          {log.userName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-200 text-xs">{log.userName}</p>
                          <p className="text-[9px] text-slate-550 font-mono mt-0.5">{log.userId?.slice(0, 8) || 'system'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border tracking-wider ${ACTION_COLOR[log.action] || 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-bold text-slate-300 text-xs">
                      {log.resource || '—'}
                    </td>

                    <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                      {moment(log.createdAt).format('DD MMM YYYY, h:mm a')}
                      <span className="block text-[8px] text-slate-600 mt-0.5">{moment(log.createdAt).fromNow()}</span>
                    </td>

                    <td className="px-6 py-4 font-mono text-[10px] text-slate-550">
                      {log.workspaceId ? log.workspaceId.slice(0, 8) + '…' : 'Global Domain'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-750 hover:border-slate-650 rounded-lg transition cursor-pointer"
                        title="View JSON Payload"
                      >
                        <LuEye size={13} />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/30">
              <div className="flex items-center gap-2">
                <LuInfo className="text-indigo-400 text-lg" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Event Metadata Inspector</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
                <LuX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Operation ID</span>
                  <span className="text-slate-300 font-semibold font-mono text-[10px]">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Triggered Action</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${ACTION_COLOR[selectedLog.action] || 'text-slate-400 bg-slate-800 border-slate-700'}`}>{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Operator</span>
                  <span className="text-slate-300 font-semibold">{selectedLog.userName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Timestamp</span>
                  <span className="text-slate-300 font-semibold">{moment(selectedLog.createdAt).format('DD MMM YYYY, h:mm:ss a')}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Metadata JSON Payload</span>
                <pre className="w-full bg-slate-950 border border-slate-850 p-4 rounded-xl text-[11px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap select-all max-h-64">
                  {JSON.stringify(selectedLog.metadata, null, 2) || 'null'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/30">
              <button onClick={() => setSelectedLog(null)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer">
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SecurityAudit;
