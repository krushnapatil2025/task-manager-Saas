import React, { useState, useEffect } from 'react';
import { LuX, LuDownload, LuSlidersHorizontal, LuEye, LuSquareCheck, LuSquare } from 'react-icons/lu';
import { getAllTasks, normalizeTask } from '../services/taskService';
import toast from 'react-hot-toast';

const COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'progress', label: 'Progress' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'createdAt', label: 'Created At' }
];

const ExportPreviewDrawer = ({ isOpen, onClose, workspace, format: initialFormat }) => {
  const [format, setFormat] = useState(initialFormat || 'csv');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Customization States
  const [selectedCols, setSelectedCols] = useState(COLUMNS.map(c => c.id));
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  useEffect(() => {
    if (isOpen && workspace?.id) {
      loadTasks();
    }
  }, [isOpen, workspace?.id]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const raw = await getAllTasks(workspace.id, null);
      setTasks(raw.map(normalizeTask));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tasks for preview');
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on custom settings
  const filteredTasks = tasks.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status?.toLowerCase() === filterStatus.toLowerCase();
    const matchPriority = filterPriority === 'all' || t.priority?.toLowerCase() === filterPriority.toLowerCase();
    return matchStatus && matchPriority;
  });

  const toggleColumn = (colId) => {
    if (selectedCols.includes(colId)) {
      if (selectedCols.length === 1) return toast.error('At least one column must be exported');
      setSelectedCols(selectedCols.filter(id => id !== colId));
    } else {
      setSelectedCols([...selectedCols, colId]);
    }
  };

  const handleExport = async () => {
    if (filteredTasks.length === 0) {
      return toast.error('No tasks match your selected filters');
    }
    
    try {
      const { default: ExcelJS } = await import('exceljs');
      const filename = `${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_export_${Date.now()}`;

      if (format === 'excel' || format === 'csv') {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Exported Tasks');

        const activeCols = COLUMNS.filter(c => selectedCols.includes(c.id));
        sheet.columns = activeCols.map(c => ({
          header: c.label,
          key: c.id,
          width: c.id === 'description' ? 40 : c.id === 'title' ? 30 : 18
        }));

        // Style header
        sheet.getRow(1).eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // slate-800
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
        sheet.getRow(1).height = 26;

        filteredTasks.forEach((t, idx) => {
          const rowData = {};
          activeCols.forEach(col => {
            if (col.id === 'assignedTo') {
              rowData[col.id] = (t.assignedTo || []).map(u => u.name).join(', ');
            } else if (col.id === 'dueDate') {
              rowData[col.id] = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB') : '';
            } else if (col.id === 'createdAt') {
              rowData[col.id] = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '';
            } else if (col.id === 'progress') {
              rowData[col.id] = `${t.progress || 0}%`;
            } else {
              rowData[col.id] = t[col.id] || '';
            }
          });

          const row = sheet.addRow(rowData);
          if (idx % 2 === 1) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // slate-50
            });
          }
        });

        sheet.eachRow(row => { row.height = 20; });

        if (format === 'excel') {
          const buffer = await workbook.xlsx.writeBuffer();
          triggerDownload(buffer, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } else {
          // Custom CSV Generation
          const buffer = await workbook.csv.writeBuffer();
          triggerDownload(buffer, `${filename}.csv`, 'text/csv;charset=utf-8;');
        }
      } else if (format === 'json') {
        const activeCols = COLUMNS.filter(c => selectedCols.includes(c.id));
        const jsonTasks = filteredTasks.map(t => {
          const item = {};
          activeCols.forEach(col => {
            if (col.id === 'assignedTo') {
              item[col.id] = t.assignedTo;
            } else {
              item[col.id] = t[col.id];
            }
          });
          return item;
        });

        const jsonContent = JSON.stringify({
          workspace_id: workspace.id,
          exported_at: new Date().toISOString(),
          tasks: jsonTasks
        }, null, 2);
        
        triggerDownload(jsonContent, `${filename}.json`, 'application/json');
      } else if (format === 'ical') {
        // iCal matches only tasks with due dates
        const icalTasks = filteredTasks.filter(t => t.dueDate);
        if (icalTasks.length === 0) {
          return toast.error('No tasks with due dates exist to generate iCal events');
        }

        const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const events = icalTasks.map(t => {
          const dueStr = new Date(t.dueDate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
          const summary = (t.title || "").replace(/[\\;,]/g, "\\$&");
          const desc = (t.description || "").replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n");

          return [
            "BEGIN:VEVENT",
            `UID:strideo-${workspace.id}-${t.id}`,
            `DTSTAMP:${now}`,
            `DTSTART;VALUE=DATE:${dueStr.slice(0, 8)}`,
            `DTEND;VALUE=DATE:${dueStr.slice(0, 8)}`,
            `SUMMARY:[${t.status}] ${summary}`,
            `DESCRIPTION:Priority: ${t.priority}\\n${desc}`,
            `STATUS:${t.status === "Completed" ? "COMPLETED" : "NEEDS-ACTION"}`,
            `PRIORITY:${t.priority === "high" ? 1 : t.priority === "medium" ? 5 : 9}`,
            "END:VEVENT"
          ].join("\r\n");
        });

        const icalContent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Strideo//Calendar Export//EN",
          `X-WR-CALNAME:${workspace.name} Tasks`,
          "X-WR-TIMEZONE:Asia/Kolkata",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          ...events,
          "END:VCALENDAR"
        ].join("\r\n");

        triggerDownload(icalContent, `${filename}.ics`, 'text/calendar;charset=utf-8;');
      }
      toast.success('Download initiated!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl border-l border-slate-150 flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-100 rounded-xl text-slate-800">
              <LuSlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Export Config & Preview</h2>
              <p className="text-xs text-slate-450 mt-0.5">Customize fields and filter rows before download</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg transition-all"
          >
            <LuX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">File Format</label>
            <div className="grid grid-cols-4 gap-3">
              {['excel', 'csv', 'json', 'ical'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`py-3 px-2 rounded-xl border-2 text-center text-xs font-bold transition-all capitalize cursor-pointer ${
                    format === fmt 
                      ? 'border-slate-800 bg-slate-900 text-white shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {fmt === 'ical' ? 'iCalendar (.ics)' : fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Filtering Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="todo">Todo</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Priority</label>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Column Toggle Checklist */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Fields to Export</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLUMNS.map(col => {
                const isActive = selectedCols.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      isActive 
                        ? 'border-slate-350 bg-slate-50 text-slate-900 font-bold' 
                        : 'border-slate-100 text-slate-450 hover:bg-slate-50'
                    }`}
                  >
                    {isActive ? <LuSquareCheck className="text-slate-800" size={15} /> : <LuSquare size={15} />}
                    <span className="truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Data Preview */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <LuEye size={14} />
              <span>Live Dataset Preview ({filteredTasks.length} matching rows)</span>
            </div>
            
            {loading ? (
              <div className="h-40 flex items-center justify-center border border-slate-150 rounded-2xl bg-slate-50">
                <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center border border-slate-150 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                No matching tasks found for active filters.
              </div>
            ) : (
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 shadow-sm max-w-full overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      {COLUMNS.filter(c => selectedCols.includes(c.id)).map(col => (
                        <th key={col.id} className="p-3 text-slate-650 font-bold uppercase tracking-wider">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.slice(0, 5).map((task, idx) => (
                      <tr key={task.id} className="border-b border-slate-200/50 last:border-b-0 bg-white">
                        {COLUMNS.filter(c => selectedCols.includes(c.id)).map(col => {
                          let val = '';
                          if (col.id === 'assignedTo') {
                            val = (task.assignedTo || []).map(u => u.name).join(', ');
                          } else if (col.id === 'dueDate') {
                            val = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : '—';
                          } else if (col.id === 'createdAt') {
                            val = task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-GB') : '—';
                          } else if (col.id === 'progress') {
                            val = `${task.progress || 0}%`;
                          } else {
                            val = task[col.id] || '—';
                          }

                          return (
                            <td key={col.id} className="p-3 font-semibold text-slate-850 truncate max-w-[150px]" title={val}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTasks.length > 5 && (
                  <div className="bg-slate-50 border-t border-slate-200 p-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Showing first 5 of {filteredTasks.length} rows
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 border-t border-slate-150 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading || filteredTasks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-slate-900/10"
          >
            <LuDownload size={14} />
            <span>Generate & Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPreviewDrawer;
