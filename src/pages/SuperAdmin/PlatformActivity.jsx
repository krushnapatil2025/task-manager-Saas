import React, { useEffect, useState } from 'react';
import { getPlatformAuditLogs } from '../../services/superAdminService';
import { LuActivity, LuLoaderCircle, LuSearch } from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

const ACTION_COLOR = {
  'task.created':        'bg-blue-500/20  text-blue-400',
  'task.deleted':        'bg-red-500/20   text-red-400',
  'task.status_changed': 'bg-amber-500/20 text-amber-400',
  'member.added':        'bg-lime-500/20  text-lime-400',
  'member.invited':      'bg-cyan-500/20  text-cyan-400',
  'auth.login':          'bg-slate-500/20 text-slate-300',
};

const PlatformActivity = () => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    getPlatformAuditLogs(100)
      .then(setLogs)
      .catch(() => toast.error('Failed to load activity'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? logs.filter((l) => l.action.includes(search) || l.userName.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LuActivity className="text-blue-400" /> Platform Activity
          </h1>
          <p className="text-slate-400 text-sm mt-1">Last 100 events across all workspaces</p>
        </div>
        <div className="relative">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition w-56"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LuLoaderCircle className="text-blue-400 text-2xl animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-slate-800/30 transition">
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ACTION_COLOR[log.action] || 'bg-slate-700 text-slate-300'}`}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">
                    <strong className="text-white">{log.userName}</strong>
                    {log.metadata?.title && <> · <span className="text-slate-400">{log.metadata.title}</span></>}
                    {log.metadata?.email && <> · <span className="text-slate-400">{log.metadata.email}</span></>}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{log.workspaceId?.slice(0, 8)}</p>
                </div>
                <span className="text-[10px] text-slate-600 whitespace-nowrap">
                  {moment(log.createdAt).format('DD MMM, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformActivity;
