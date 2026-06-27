import React, { useContext, useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext }      from '../../context/userContext';
import {
  LuPlus, LuLoaderCircle, LuToggleLeft, LuToggleRight,
  LuTrash2, LuZap, LuHistory, LuX, LuChevronDown,
} from 'react-icons/lu';
import {
  getAutomationRules, createRule, toggleRule,
  deleteRule, getAutomationLogs,
  TRIGGER_LABELS, ACTION_LABELS,
} from '../../services/automationService';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import moment from 'moment';

// ─────────────────────────────────────────────────────────────────────────────
// AutomationRules — Phase 15 — Admin page
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGERS = Object.entries(TRIGGER_LABELS);
const ACTIONS  = Object.entries(ACTION_LABELS);

const STATUS_CHIP = {
  success: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-250/30',
  failed:  'bg-rose-50  dark:bg-rose-955/15  text-rose-500  dark:text-rose-455  border-rose-250/30',
  skipped: 'bg-slate-50 dark:bg-zinc-900/40 text-slate-500 dark:text-zinc-450 border-slate-205 dark:border-zinc-800',
};

// ── Rule Form Modal ───────────────────────────────────────────────────────────
const CreateRuleModal = ({ onClose, onCreated }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);
  const [form, setForm] = useState({
    name:              '',
    description:       '',
    trigger_type:      'task_status_changed',
    trigger_condition: {},
    action_type:       'send_notification',
    action_config:     {},
  });
  const [busy, setBusy] = useState(false);

  // Trigger condition helpers
  const [toStatus,  setToStatus ] = useState('');
  const [toPriority, setToPrio  ] = useState('');

  // Action config helpers
  const [notifMsg,  setNotifMsg ] = useState('');
  const [actStatus, setActStatus] = useState('');
  const [actPriority, setActPri ] = useState('');

  const buildCondition = () => {
    const c = {};
    if (toStatus)   c.to_status   = toStatus;
    if (toPriority) c.to_priority = toPriority;
    return c;
  };

  const buildActionConfig = () => {
    switch (form.action_type) {
      case 'send_notification': return { title: '🤖 Automation', message: notifMsg || 'Automation triggered' };
      case 'change_status':     return { status: actStatus };
      case 'change_priority':   return { priority: actPriority };
      default: return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Rule name is required');
    setBusy(true);
    try {
      const rule = await createRule({
        workspace_id:      workspace.id,
        name:              form.name,
        description:       form.description,
        trigger_type:      form.trigger_type,
        trigger_condition: buildCondition(),
        action_type:       form.action_type,
        action_config:     buildActionConfig(),
        enabled:           true,
        created_by:        user?.id,
      });
      toast.success('Automation rule created!');
      onCreated(rule);
      onClose();
    } catch { toast.error('Failed to create rule'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0c0c0e]/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#161619] border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80">
            <h3 className="font-extrabold text-slate-800 dark:text-zinc-200 text-sm uppercase tracking-wider flex items-center gap-2">
              ⚡ New Automation Rule
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 transition cursor-pointer">
              <LuX size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Name */}
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Rule Name *</label>
              <input className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200" placeholder="e.g. Auto-complete when status done"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>

            {/* Trigger */}
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">When (Trigger)</label>
              <div className="relative">
                <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer"
                  value={form.trigger_type}
                  onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                  {TRIGGERS.map(([k, v]) => <option key={k} value={k} className="dark:bg-zinc-900">{v}</option>)}
                </select>
              </div>
            </div>

            {/* Condition */}
            {(form.trigger_type === 'task_status_changed' || form.trigger_type === 'task_completed') && (
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">Condition — To Status</label>
                <div className="relative">
                  <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer" value={toStatus} onChange={e => setToStatus(e.target.value)}>
                    <option value="" className="dark:bg-zinc-900">Any status</option>
                    <option value="Pending" className="dark:bg-zinc-900">Pending</option>
                    <option value="In Progress" className="dark:bg-zinc-900">In Progress</option>
                    <option value="Completed" className="dark:bg-zinc-900">Completed</option>
                  </select>
                </div>
              </div>
            )}
            {form.trigger_type === 'task_priority_changed' && (
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">Condition — To Priority</label>
                <div className="relative">
                  <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer" value={toPriority} onChange={e => setToPrio(e.target.value)}>
                    <option value="" className="dark:bg-zinc-900">Any priority</option>
                    <option value="high" className="dark:bg-zinc-900">High</option>
                    <option value="medium" className="dark:bg-zinc-900">Medium</option>
                    <option value="low" className="dark:bg-zinc-900">Low</option>
                  </select>
                </div>
              </div>
            )}

            {/* Action */}
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Then Do (Action)</label>
              <div className="relative">
                <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer"
                  value={form.action_type}
                  onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
                  {ACTIONS.map(([k, v]) => <option key={k} value={k} className="dark:bg-zinc-900">{v}</option>)}
                </select>
              </div>
            </div>

            {/* Action config */}
            {form.action_type === 'send_notification' && (
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">Notification Message</label>
                <input className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200" placeholder="Automation triggered on this task"
                  value={notifMsg} onChange={e => setNotifMsg(e.target.value)} />
              </div>
            )}
            {form.action_type === 'change_status' && (
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">Set Status To</label>
                <div className="relative">
                  <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer" value={actStatus} onChange={e => setActStatus(e.target.value)}>
                    <option value="" className="dark:bg-zinc-900">Select status</option>
                    <option value="Pending" className="dark:bg-zinc-900">Pending</option>
                    <option value="In Progress" className="dark:bg-zinc-900">In Progress</option>
                    <option value="Completed" className="dark:bg-zinc-900">Completed</option>
                  </select>
                </div>
              </div>
            )}
            {form.action_type === 'change_priority' && (
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">Set Priority To</label>
                <div className="relative">
                  <select className="field-input pr-7 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer" value={actPriority} onChange={e => setActPri(e.target.value)}>
                    <option value="" className="dark:bg-zinc-900">Select priority</option>
                    <option value="high" className="dark:bg-zinc-900">High</option>
                    <option value="medium" className="dark:bg-zinc-900">Medium</option>
                    <option value="low" className="dark:bg-zinc-900">Low</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="card-btn flex-1 cursor-pointer">Cancel</button>
              <button type="submit" disabled={busy}
                className="card-btn-fill flex-1 flex items-center justify-center gap-2 cursor-pointer">
                {busy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuZap size={14} />}
                Create Rule
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const AutomationRules = () => {
  const { workspace } = useContext(WorkspaceContext);
  const [rules,      setRules    ] = useState([]);
  const [logs,       setLogs     ] = useState([]);
  const [loading,    setLoading  ] = useState(true);
  const [tab,        setTab      ] = useState('rules');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [r, l] = await Promise.all([
        getAutomationRules(workspace.id),
        getAutomationLogs(workspace.id),
      ]);
      setRules(r);
      setLogs(l);
    } catch { toast.error('Failed to load automations'); }
    finally { setLoading(false); }
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule) => {
    try {
      await toggleRule(rule.id, !rule.enabled);
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch { toast.error('Failed to update rule'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation rule?')) return;
    try {
      await deleteRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch { toast.error('Failed to delete rule'); }
  };

  const enabledCount = rules.filter(r => r.enabled).length;
  const totalRuns    = rules.reduce((s, r) => s + (r.run_count || 0), 0);

  return (
    <DashboardLayout activeMenu="Automations">
      <div className="my-5 pb-12 animate-fade-in font-sans">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              ⚡ Automation Engine
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · <span className="text-indigo-650 dark:text-indigo-400">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span> · {enabledCount} active
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <RefreshButton id="automation-refresh" onRefresh={load} label="Refresh" size="sm" />
            <button
              onClick={() => setShowCreate(true)}
              className="card-btn-fill flex items-center gap-1.5 text-xs font-bold transition cursor-pointer">
              <LuPlus size={14} /> New Rule
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Rules',  value: rules.length, color: 'bg-amber-500 text-amber-500'   },
            { label: 'Active Rules', value: enabledCount,  color: 'bg-emerald-500 text-emerald-500' },
            { label: 'Total Runs',   value: totalRuns,     color: 'bg-indigo-500 text-indigo-500'  },
          ].map(c => (
            <div key={c.label} className="card !p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: c.color.split(' ')[1] + '15', color: c.color.split(' ')[1] }}>
                <LuZap size={16} />
              </div>
              <div>
                <span className="block text-xl font-extrabold text-slate-800 dark:text-zinc-150 leading-tight">{c.value}</span>
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">{c.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl w-fit mb-6 border border-slate-205 dark:border-zinc-800/80">
          {[['rules', 'Rules'], ['logs', 'Run History']].map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                tab === k ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm' : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}>
              {k === 'logs' && <LuHistory size={11} className="inline mr-1" />}{v}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-amber-500 text-3xl animate-spin" />
          </div>
        ) : tab === 'rules' ? (

          /* ── Rules list ── */
          rules.length === 0 ? (
            <div className="card p-12 text-center">
              <LuZap className="text-slate-350 dark:text-zinc-650 text-5xl mx-auto mb-3" />
              <p className="text-slate-550 dark:text-zinc-400 font-bold uppercase tracking-wider text-xs">No automation rules yet.</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto font-medium">
                Create rules to automatically trigger actions when task events occur.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-2 hover:bg-amber-100 transition cursor-pointer">
                <LuPlus size={13} /> Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id}
                  className={`card !p-5 flex items-start gap-4 transition ${
                    rule.enabled ? '' : 'opacity-60 border-slate-100 dark:border-zinc-900'
                  }`}>
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                    rule.enabled ? 'bg-amber-50 dark:bg-amber-955/15 border-amber-250/20 text-amber-500' : 'bg-slate-50 dark:bg-zinc-900 border-slate-205 dark:border-zinc-800 text-slate-400 dark:text-zinc-500'
                  }`}>
                    <LuZap size={16} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{rule.name}</span>
                      <span className={`text-[9px] font-extrabold border rounded uppercase tracking-wider px-2 py-0.5 ${
                        rule.enabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-250/30'
                          : 'bg-slate-50 dark:bg-zinc-900/40 text-slate-500 dark:text-zinc-450 border-slate-205 dark:border-zinc-800'
                      }`}>
                        {rule.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-450 dark:text-zinc-400 mt-1 font-semibold">{rule.description || ''}</p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="auto-pill px-2.5 py-0.5 rounded border text-[9px] font-extrabold uppercase bg-amber-50/50 border-amber-200/50 text-amber-600 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-amber-400">
                        ⚡ {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                      </span>
                      <span className="text-slate-300 dark:text-zinc-700 text-xs">→</span>
                      <span className="auto-pill px-2.5 py-0.5 rounded border text-[9px] font-extrabold uppercase bg-indigo-50/50 border-indigo-200/50 text-indigo-600 dark:bg-indigo-950/10 dark:border-indigo-900/30 dark:text-indigo-400">
                        🎯 {ACTION_LABELS[rule.action_type] || rule.action_type}
                      </span>
                      {rule.run_count > 0 && (
                        <span className="text-[9px] text-slate-400 dark:text-zinc-550 ml-auto font-bold uppercase tracking-wider">
                          {rule.run_count} runs · last {moment(rule.last_run_at).fromNow()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`transition-colors cursor-pointer ${rule.enabled ? 'text-emerald-500' : 'text-slate-300 dark:text-zinc-700 hover:text-slate-400'}`}
                      title={rule.enabled ? 'Pause rule' : 'Enable rule'}>
                      {rule.enabled
                        ? <LuToggleRight size={24} />
                        : <LuToggleLeft size={24} />}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-slate-350 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-455 transition cursor-pointer"
                      title="Delete rule">
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )

        ) : (

          /* ── Logs list ── */
          logs.length === 0 ? (
            <div className="card p-12 text-center">
              <LuHistory className="text-slate-350 dark:text-zinc-650 text-5xl mx-auto mb-3" />
              <p className="text-slate-455 dark:text-zinc-400 font-bold uppercase tracking-wider text-xs">No automation runs yet.</p>
            </div>
          ) : (
            <div className="card !p-0 overflow-hidden">
              <div className="divide-y divide-slate-105 dark:divide-zinc-800/80">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 transition">
                    <span className={`text-[9px] font-extrabold border rounded uppercase tracking-wider px-2 py-0.5 ${STATUS_CHIP[log.status] || STATUS_CHIP.skipped}`}>
                      {log.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                        {log.automation_rules?.name || 'Rule'}
                      </span>
                      {log.tasks?.title && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-550 ml-2 font-bold uppercase">on: {log.tasks.title}</span>
                      )}
                      {log.detail && (
                        <p className="text-xs text-slate-450 dark:text-zinc-400 mt-1 font-semibold">{log.detail}</p>
                      )}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-550 flex-shrink-0">
                      {moment(log.created_at).fromNow()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {showCreate && (
        <CreateRuleModal
          onClose={() => setShowCreate(false)}
          onCreated={r => { setRules(prev => [r, ...prev]); }}
        />
      )}
    </DashboardLayout>
  );
};

export default AutomationRules;
