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
    tagColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    id:    'csv',
    icon:  LuFileSpreadsheet,
    title: 'CSV Export (.csv)',
    desc:  'Comma-separated values — import into any BI tool, Notion database or spreadsheet app.',
    color: 'bg-blue-500',
    tag:   'Universal',
    tagColor: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    id:    'json',
    icon:  LuFileJson,
    title: 'JSON Export (.json)',
    desc:  'Full data dump including all task fields. Useful for developers and data migrations.',
    color: 'bg-violet-500',
    tag:   'Developer',
    tagColor: 'bg-violet-50 text-violet-600 border-violet-200',
  },
  {
    id:    'ical',
    icon:  LuCalendar,
    title: 'Calendar Export (.ics)',
    desc:  'iCalendar format — import task deadlines into Google Calendar, Outlook or Apple Calendar.',
    color: 'bg-amber-500',
    tag:   'Calendar',
    tagColor: 'bg-amber-50 text-amber-600 border-amber-200',
  },
];

const Reports = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();
  const [busy, setBusy] = useState({});

  const handle = async (id) => {
    if (!workspace?.id) return toast.error('No workspace selected');
    setBusy(b => ({ ...b, [id]: true }));
    try {
      if (id === 'excel') {
        // Use ExcelJS (same as ManageTasks)
        const { default: ExcelJS } = await import('exceljs');
        const { getAllTasks, normalizeTask } = await import('../../services/taskService');
        const raw   = await getAllTasks(workspace.id, null);
        const tasks = raw.map(normalizeTask);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'TaskFlow';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Tasks', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        // Styled header row
        sheet.columns = [
          { header: 'Title',       key: 'title',       width: 32 },
          { header: 'Description', key: 'description', width: 44 },
          { header: 'Status',      key: 'status',      width: 14 },
          { header: 'Priority',    key: 'priority',    width: 12 },
          { header: 'Progress',    key: 'progress',    width: 12 },
          { header: 'Due Date',    key: 'dueDate',     width: 16 },
          { header: 'Assigned To', key: 'assignedTo',  width: 36 },
          { header: 'Created At',  key: 'createdAt',   width: 16 },
        ];

        // Style header
        sheet.getRow(1).eachCell(cell => {
          cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border    = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
        });
        sheet.getRow(1).height = 24;

        // Data rows
        tasks.forEach((t, idx) => {
          const row = sheet.addRow({
            title:       t.title,
            description: t.description,
            status:      t.status,
            priority:    t.priority?.toUpperCase(),
            progress:    `${t.progress || 0}%`,
            dueDate:     t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '—',
            assignedTo:  (t.assignedTo || []).map(u => u.name).join(', '),
            createdAt:   t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '—',
          });
          if (idx % 2 === 1) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } };
            });
          }
        });

        // Auto-fit rows
        sheet.eachRow(row => { row.height = 20; });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob   = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), {
          href: url, download: `${workspace.name}_report_${Date.now()}.xlsx`,
        });
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast.success('Excel report downloaded!');

      } else if (id === 'csv') {
        await exportTasksCSV(workspace.id, workspace.name);
        toast.success('CSV downloaded!');
      } else if (id === 'json') {
        await exportTasksJSON(workspace.id, workspace.name);
        toast.success('JSON exported!');
      } else if (id === 'ical') {
        await exportTasksICal(workspace.id, workspace.name);
        toast.success('Calendar file downloaded!');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed — ' + (err.message || 'unknown error'));
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  return (
    <DashboardLayout activeMenu="Reports">
      <div className="my-5 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              📤 Export Reports
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Download your workspace data in multiple formats
            </p>
          </div>
          <button
            className="card-btn"
            onClick={() => navigate('/admin/analytics')}
          >
            <LuChartBar size={14} /> View Analytics
          </button>
        </div>

        {/* ── Workspace info chip ── */}
        {workspace?.name && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-6">
            📁 {workspace.name}
          </div>
        )}

        {/* ── Export cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {REPORT_CARDS.map(card => (
            <div
              key={card.id}
              className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md hover:border-slate-300/60 transition-all duration-300"
            >
              {/* Icon + Tag */}
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 ${card.color} text-white rounded-xl flex items-center justify-center shadow-sm`}>
                  <card.icon size={20} />
                </div>
                <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 ${card.tagColor}`}>
                  {card.tag}
                </span>
              </div>

              {/* Title + desc */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">{card.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
              </div>

              {/* Download button */}
              <button
                id={`report-download-${card.id}`}
                onClick={() => handle(card.id)}
                disabled={busy[card.id]}
                className="mt-auto flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl py-2.5 px-4 transition-all hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20"
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
        <div className="mt-8 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">💡 Pro Tips</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• <strong>Excel</strong> report has styled headers and alternating row colours — ready to share.</li>
            <li>• <strong>CSV</strong> can be imported directly into Google Sheets or Notion databases.</li>
            <li>• <strong>iCal</strong> file lets your team see task deadlines inside their personal calendars.</li>
            <li>• All exports include <strong>every task</strong> in the workspace regardless of status filter.</li>
          </ul>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Reports;
