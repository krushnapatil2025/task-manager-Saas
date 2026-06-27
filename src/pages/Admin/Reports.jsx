import React, { useContext, useState } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import {
  LuFileSpreadsheet, LuFileJson, LuCalendar,
  LuDownload, LuLoaderCircle, LuChartBar,
} from 'react-icons/lu';
import { exportTasksCSV, exportTasksJSON, exportTasksICal } from '../../services/exportService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ExportPreviewDrawer from '../../components/ExportPreviewDrawer';

// ─────────────────────────────────────────────────────────────────────────────
// Reports — Phase 10 — Export Centre
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_CARDS = [
  {
    id:    'excel',
    icon:  LuFileSpreadsheet,
    title: 'Excel Report (.xlsx)',
    desc:  'Full task list with status, priority, assignees and due dates. Opens in Excel / Google Sheets.',
    color: 'bg-emerald-500',
    tag:   'Most popular',
    tagColor: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-955/15 dark:text-emerald-450 dark:border-emerald-900/30',
  },
  {
    id:    'csv',
    icon:  LuFileSpreadsheet,
    title: 'CSV Export (.csv)',
    desc:  'Comma-separated values — import into any BI tool, Notion database or spreadsheet app.',
    color: 'bg-blue-500',
    tag:   'Universal',
    tagColor: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-955/15 dark:text-blue-450 dark:border-blue-900/30',
  },
  {
    id:    'json',
    icon:  LuFileJson,
    title: 'JSON Export (.json)',
    desc:  'Full data dump including all task fields. Useful for developers and data migrations.',
    color: 'bg-violet-500',
    tag:   'Developer',
    tagColor: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30',
  },
  {
    id:    'ical',
    icon:  LuCalendar,
    title: 'Calendar Export (.ics)',
    desc:  'iCalendar format — import task deadlines into Google Calendar, Outlook or Apple Calendar.',
    color: 'bg-amber-500',
    tag:   'Calendar',
    tagColor: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30',
  },
];

const Reports = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();
  const [busy, setBusy] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFormat, setDrawerFormat] = useState('csv');

  const handle = (id) => {
    if (!workspace?.id) return toast.error('No workspace selected');
    setDrawerFormat(id);
    setDrawerOpen(true);
  };

  return (
    <DashboardLayout activeMenu="Reports">
      <div className="my-5 pb-12 font-sans animate-fade-in">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">
              📤 Export Reports
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              Download your workspace data in multiple formats
            </p>
          </div>
          <button
            className="card-btn flex items-center justify-center gap-1.5 text-xs"
            onClick={() => navigate('/admin/analytics')}
          >
            <LuChartBar size={14} /> View Analytics
          </button>
        </div>

        {/* ── Workspace info chip ── */}
        {workspace?.name && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-650 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-6 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">
            📁 {workspace.name}
          </div>
        )}

        {/* ── Export cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {REPORT_CARDS.map(card => (
            <div
              key={card.id}
              className="card flex flex-col gap-4 hover:-translate-y-0.5 transition-all duration-250"
            >
              {/* Icon + Tag */}
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 ${card.color} text-white rounded-xl flex items-center justify-center shadow-sm`}>
                  <card.icon size={20} />
                </div>
                <span className={`text-[10px] font-extrabold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${card.tagColor}`}>
                  {card.tag}
                </span>
              </div>

              {/* Title + desc */}
              <div>
                <h3 className="text-sm font-bold text-slate-805 dark:text-zinc-200 mb-1">{card.title}</h3>
                <p className="text-xs text-slate-450 dark:text-zinc-450 leading-relaxed font-semibold">{card.desc}</p>
              </div>

              {/* Download button */}
              <button
                id={`report-download-${card.id}`}
                onClick={() => handle(card.id)}
                disabled={busy[card.id]}
                className="mt-auto card-btn-fill flex items-center justify-center gap-2 text-xs py-2.5 w-full cursor-pointer"
              >
                {busy[card.id]
                  ? <><LuLoaderCircle size={14} className="animate-spin" /> Exporting…</>
                  : <><LuDownload size={14} /> Download</>
                }
              </button>
            </div>
          ))}
        </div>

        {/* ── Tips ── */}
        <div className="mt-8 bg-indigo-50/60 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5">
          <p className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest mb-2.5">💡 Pro Tips</p>
          <ul className="space-y-1.5 text-xs text-slate-505 dark:text-zinc-400 font-bold uppercase tracking-wider">
            <li>• <strong className="text-slate-700 dark:text-zinc-200">Excel</strong> report has styled headers and alternating row colours — ready to share.</li>
            <li>• <strong className="text-slate-700 dark:text-zinc-200">CSV</strong> can be imported directly into Google Sheets or Notion databases.</li>
            <li>• <strong className="text-slate-700 dark:text-zinc-200">iCal</strong> file lets your team see task deadlines inside their personal calendars.</li>
            <li>• All exports include <strong className="text-slate-700 dark:text-zinc-200">every task</strong> in the workspace regardless of status filter.</li>
          </ul>
        </div>

        {/* Export Preview Drawer */}
        <ExportPreviewDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          workspace={workspace}
          format={drawerFormat}
        />

      </div>
    </DashboardLayout>
  );
};

export default Reports;
