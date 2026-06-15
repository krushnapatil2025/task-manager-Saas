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
      label: 'CSV Export',
      desc:  'Download all tasks as a spreadsheet-compatible CSV file. Opens in Excel, Google Sheets, or Numbers.',
      color: 'from-lime-500 to-emerald-500',
    },
    {
      type:  'json',
      icon:  LuFileJson,
      label: 'JSON Export',
      desc:  'Full data dump in JSON format — includes all fields, assignees, and checklist items.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      type:  'ical',
      icon:  LuCalendar,
      label: 'iCal Export',
      desc:  'Export due dates as a calendar feed (.ics) — import into Google Calendar, Apple Calendar, or Outlook.',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  const NAV_CARDS = [
    {
      icon:  LuKey,
      label: 'API Keys',
      desc:  'Generate secure API keys to integrate TaskFlow with CI/CD pipelines, scripts, or external tools.',
      path:  '/admin/api-keys',
      color: 'from-amber-500 to-orange-500',
      badge: 'Enterprise',
    },
    {
      icon:  LuWebhook,
      label: 'Webhooks',
      desc:  'Push real-time events (task.created, status_changed, member.added) to Slack, Zapier, or your server.',
      path:  '/admin/webhooks',
      color: 'from-violet-500 to-purple-600',
      badge: 'Pro+',
    },
  ];

  const FUTURE_INTEGRATIONS = [
    { icon: '💬', name: 'Slack',         desc: 'Post task updates directly to Slack channels.' },
    { icon: '📧', name: 'Email (Resend)', desc: 'Send task notifications via transactional email.' },
    { icon: '🐙', name: 'GitHub Issues', desc: 'Link tasks to GitHub issues and PRs.' },
    { icon: '⚡', name: 'Zapier',         desc: 'Connect TaskFlow to 6,000+ apps via Zapier.' },
  ];

  return (
    <DashboardLayout activeMenu="Integrations">
      <div className="mt-5">
        <div className="mb-7">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <LuPuzzle className="text-blue-500" /> Integrations & Exports
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Connect <strong className="text-gray-600">{workspace?.name}</strong> to external tools and export your data.
          </p>
        </div>

        {/* ── Data Exports ── */}
        <section className="mb-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LuFileDown className="text-sm" /> Data Exports
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EXPORT_CARDS.map((card) => (
              <div
                key={card.type}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4`}>
                  <card.icon className="text-white text-base" />
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-1">{card.label}</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{card.desc}</p>
                <button
                  onClick={() => handleExport(card.type)}
                  disabled={exporting === card.type}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 py-2 rounded-xl transition disabled:opacity-60"
                >
                  {exporting === card.type
                    ? <><LuLoaderCircle className="animate-spin" /> Exporting...</>
                    : <><LuFileDown /> Download {card.type.toUpperCase()}</>
                  }
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── API & Webhooks ── */}
        <section className="mb-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LuCode className="text-sm" /> API & Webhooks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {NAV_CARDS.map((card) => (
              <div
                key={card.label}
                onClick={() => navigate(card.path)}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="text-white text-base" />
                  </div>
                  {card.badge && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {card.badge}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1">
                  {card.label}
                  <LuArrowRight className="text-gray-400 text-xs group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── API Docs quick link ── */}
        <section className="mb-8">
          <div className="bg-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">REST API Base URL</p>
              <a
                href="https://supabase.com/docs/guides/functions"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Docs <LuExternalLink className="text-xs" />
              </a>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3">
              <code className="text-xs text-green-400 font-mono flex-1 break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tasks
              </code>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Authenticate with <code className="text-slate-300">X-API-Key: tf_live_...</code> header
            </p>
          </div>
        </section>

        {/* ── Coming soon integrations ── */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Coming Soon</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FUTURE_INTEGRATIONS.map((i) => (
              <div
                key={i.name}
                className="bg-white border border-dashed border-gray-200 rounded-2xl p-4 text-center opacity-60"
              >
                <div className="text-2xl mb-2">{i.icon}</div>
                <p className="text-xs font-bold text-gray-700">{i.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">{i.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
