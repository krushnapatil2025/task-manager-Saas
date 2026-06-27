import React, { useContext, useState } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { exportTasksCSV, exportTasksJSON, exportTasksICal } from '../../services/exportService';
import {
  LuPuzzle, LuFileDown, LuCalendar, LuCode,
  LuWebhook, LuKey, LuFileJson, LuFileText,
  LuArrowRight, LuLoaderCircle, LuExternalLink,
} from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Integrations — hub page for exports, API access, and webhooks
// Route: /admin/integrations
// ─────────────────────────────────────────────────────────────────────────────

const Integrations = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();
  const [exporting, setExporting] = useState(null); // 'csv'|'json'|'ical'

  const handleExport = async (type) => {
    if (!workspace?.id) return;
    setExporting(type);
    try {
      if (type === 'csv')  await exportTasksCSV(workspace.id, workspace.name);
      if (type === 'json') await exportTasksJSON(workspace.id, workspace.name);
      if (type === 'ical') await exportTasksICal(workspace.id, workspace.name);
      toast.success(`${type.toUpperCase()} export downloaded!`);
    } catch (err) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(null);
    }
  };

  const EXPORT_CARDS = [
    {
      type:  'csv',
      icon:  LuFileText,
      label: 'CSV Data Export',
      desc:  'Download workspace tasks as a spreadsheet-compatible CSV file. Opens in Excel, Sheets, or Numbers.',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      type:  'json',
      icon:  LuFileJson,
      label: 'JSON Document Export',
      desc:  'Full database model dump in structured JSON — includes tasks, assignees, subtasks, and metadata.',
      color: 'from-indigo-500 to-violet-500',
    },
    {
      type:  'ical',
      icon:  LuCalendar,
      label: 'iCal Feed Export',
      desc:  'Export due dates as a calendar feed (.ics file format) to sync with Apple Calendar, Google, or Outlook.',
      color: 'from-purple-500 to-fuchsia-500',
    },
  ];

  const NAV_CARDS = [
    {
      icon:  LuKey,
      label: 'API Keys',
      desc:  'Generate secure access tokens to connect TaskFlow with external CLI tools, scripts, or pipelines.',
      path:  '/admin/api-keys',
      color: 'from-amber-500 to-orange-500',
      badge: 'Enterprise',
    },
    {
      icon:  LuWebhook,
      label: 'Webhooks',
      desc:  'Push instant event payloads (task.created, status_changed, etc.) directly to your backend or Zapier.',
      path:  '/admin/webhooks',
      color: 'from-indigo-500 to-purple-650',
      badge: 'Pro API',
    },
  ];

  const FUTURE_INTEGRATIONS = [
    { icon: '💬', name: 'Slack Feed',      desc: 'Send task logs directly to channels.' },
    { icon: '📧', name: 'Transactional',  desc: 'Dispatch customized notifications.' },
    { icon: '🐙', name: 'GitHub Issues',  desc: 'Sync workflow changes with issues.' },
    { icon: '⚡', name: 'Zapier Actions', desc: 'Trigger automated multi-app flows.' },
  ];

  return (
    <DashboardLayout activeMenu="Integrations">
      <div className="mt-4 pb-12 animate-fade-in font-sans">
        
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
            🧩 Integrations & Exports
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-555 mt-1.5 font-bold uppercase tracking-wider">
            Expose data channels or download raw records for <strong className="text-indigo-650 dark:text-indigo-400">{workspace?.name}</strong>
          </p>
        </div>

        {/* ── Data Exports ── */}
        <section className="mb-8">
          <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LuFileDown size={14} /> Data Exports
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EXPORT_CARDS.map((card) => (
              <div
                key={card.type}
                className="card flex flex-col justify-between hover:border-indigo-300 dark:hover:border-zinc-700/80 transition-all group"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-sm`}>
                    <card.icon className="text-white text-base" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-805 dark:text-zinc-200 mb-1">{card.label}</h4>
                  <p className="text-[11px] text-slate-450 dark:text-zinc-500 leading-relaxed mb-4 min-h-[50px] font-semibold">{card.desc}</p>
                </div>
                
                <button
                  onClick={() => handleExport(card.type)}
                  disabled={exporting === card.type}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-955/15 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/25 border border-indigo-100/50 dark:border-indigo-900/30 py-2 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
                >
                  {exporting === card.type
                    ? <><LuLoaderCircle className="animate-spin" size={12} /> Exporting...</>
                    : <><LuFileDown size={12} /> Download {card.type.toUpperCase()}</>
                  }
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── API & Webhooks ── */}
        <section className="mb-8">
          <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LuCode size={14} /> Developer Channels
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {NAV_CARDS.map((card) => (
              <div
                key={card.label}
                onClick={() => navigate(card.path)}
                className="card flex flex-col justify-between hover:border-indigo-305 dark:hover:border-zinc-700/80 cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                      <card.icon className="text-white text-base" />
                    </div>
                    {card.badge && (
                      <span className="text-[9px] font-extrabold text-amber-605 dark:text-amber-450 bg-amber-50 dark:bg-amber-955/15 border border-amber-200/50 dark:border-amber-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-850 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    {card.label}
                    <LuArrowRight size={12} className="text-slate-400 dark:text-slate-555 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </h4>
                  
                  <p className="text-[11px] text-slate-455 dark:text-zinc-500 leading-relaxed font-semibold">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── API Documentation Link Card ── */}
        <section className="mb-8">
          <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest">Workspace REST API Base Endpoint</p>
              <a
                href="https://supabase.com/docs/guides/functions"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-400 hover:text-indigo-350 transition-colors uppercase tracking-wider"
              >
                REST Guide <LuExternalLink size={12} />
              </a>
            </div>
            
            <div className="flex items-center gap-3 bg-[#0c0c0e] rounded-xl px-4 py-3 border border-zinc-850">
              <code className="text-xs text-emerald-450 dark:text-emerald-400 font-mono flex-1 break-all select-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tasks
              </code>
            </div>
            
            <p className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-600 mt-2 uppercase tracking-wider">
              Authenticate requests with <code className="text-slate-350 dark:text-zinc-450 bg-[#1c1c20] px-1 py-0.5 rounded font-mono lowercase">X-API-Key: tf_live_...</code> header
            </p>
          </div>
        </section>

        {/* ── Coming soon integrations ── */}
        <section>
          <h3 className="text-[10px] font-extrabold text-slate-405 dark:text-zinc-500 uppercase tracking-widest mb-4">Enterprise Integrations Coming Soon</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FUTURE_INTEGRATIONS.map((i) => (
              <div
                key={i.name}
                className="card border-dashed text-center opacity-65 hover:opacity-85 transition-opacity"
              >
                <div className="text-xl mb-2">{i.icon}</div>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{i.name}</p>
                <p className="text-[10px] text-slate-450 dark:text-zinc-500 mt-1 leading-snug font-semibold">{i.desc}</p>
              </div>
            ))}
          </div>
        </section>
        
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
