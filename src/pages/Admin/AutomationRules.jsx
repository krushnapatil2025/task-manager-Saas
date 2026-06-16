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
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  failed:  'bg-red-50    text-red-500    border-red-200',
  skipped: 'bg-slate-50  text-slate-500  border-slate-200',
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card automation-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <LuZap size={18} className="text-amber-500" /> New Automation Rule
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><LuX size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="modal-label">Rule Name *</label>
            <input className="modal-input" placeholder="e.g. Auto-complete when status done"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          {/* Trigger */}
          <div>
            <label className="modal-label">When (Trigger)</label>
            <select className="modal-input"
              value={form.trigger_type}
              onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
              {TRIGGERS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Condition */}
          {(form.trigger_type === 'task_status_changed' || form.trigger_type === 'task_completed') && (
            <div>
              <label className="modal-label">Condition — To Status</label>
              <select className="modal-input" value={toStatus} onChange={e => setToStatus(e.target.value)}>
                <option value="">Any status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}
          {form.trigger_type === 'task_priority_changed' && (
            <div>
              <label className="modal-label">Condition — To Priority</label>
              <select className="modal-input" value={toPriority} onChange={e => setToPrio(e.target.value)}>
                <option value="">Any priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}

          {/* Action */}
          <div>
            <label className="modal-label">Then Do (Action)</label>
            <select className="modal-input"
              value={form.action_type}
              onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
              {ACTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Action config */}
          {form.action_type === 'send_notification' && (
            <div>
              <label className="modal-label">Notification Message</label>
              <input className="modal-input" placeholder="Automation triggered on this task"
                value={notifMsg} onChange={e => setNotifMsg(e.target.value)} />
            </div>
          )}
          {form.action_type === 'change_status' && (
            <div>
              <label className="modal-label">Set Status To</label>
              <select className="modal-input" value={actStatus} onChange={e => setActStatus(e.target.value)}>
                <option value="">Select status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}
          {form.action_type === 'change_priority' && (
            <div>
              <label className="modal-label">Set Priority To</label>
              <select className="modal-input" value={actPriority} onChange={e => setActPri(e.target.value)}>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="card-btn flex-1">Cancel</button>
            <button type="submit" disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm rounded-xl py-2.5 transition hover:opacity-90 shadow-sm">
              {busy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuZap size={14} />}
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
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
      <div className="my-5 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <LuZap className="text-amber-500" size={22} /> Automation Engine
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {workspace?.name} · {rules.length} rules · {enabledCount} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton id="automation-refresh" onRefresh={load} label="Refresh" size="sm" />
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl px-4 py-2 hover:opacity-90 shadow-sm">
              <LuPlus size={14} /> New Rule
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Rules',  value: rules.length, color: 'bg-amber-500'   },
            { label: 'Active Rules', value: enabledCount,  color: 'bg-emerald-500' },
            { label: 'Total Runs',   value: totalRuns,     color: 'bg-indigo-500'  },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 ${c.color} rounded-xl flex items-center justify-center`}>
                <LuZap className="text-white" size={16} />
              </div>
              <div>
                <span className="block text-xl font-extrabold text-slate-800">{c.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100/60 p-1 rounded-xl w-fit mb-6">
          {[['rules', 'Rules'], ['logs', 'Run History']].map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
                tab === k ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-12 text-center">
              <LuZap className="text-slate-300 text-5xl mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No automation rules yet.</p>
              <p className="text-sm text-slate-400 mt-1">
                Create rules to automatically trigger actions when task events occur.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 hover:bg-amber-100 transition">
                <LuPlus size={13} /> Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id}
                  className={`bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4 transition ${
                    rule.enabled ? 'border-slate-200/50' : 'border-slate-100 opacity-60'
                  }`}>
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    rule.enabled ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100'
                  }`}>
                    <LuZap size={16} className={rule.enabled ? 'text-amber-500' : 'text-slate-400'} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{rule.name}</span>
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {rule.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{rule.description || ''}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="auto-pill auto-pill--trigger">
                        ⚡ {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                      </span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="auto-pill auto-pill--action">
                        🎯 {ACTION_LABELS[rule.action_type] || rule.action_type}
                      </span>
                      {rule.run_count > 0 && (
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {rule.run_count} runs · last {moment(rule.last_run_at).fromNow()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`transition-colors ${rule.enabled ? 'text-emerald-500' : 'text-slate-300'}`}
                      title={rule.enabled ? 'Pause rule' : 'Enable rule'}>
                      {rule.enabled
                        ? <LuToggleRight size={24} />
                        : <LuToggleLeft size={24} />}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-slate-300 hover:text-red-500 transition"
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
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-12 text-center">
              <LuHistory className="text-slate-300 text-5xl mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No automation runs yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/40 transition">
                    <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${STATUS_CHIP[log.status] || STATUS_CHIP.skipped}`}>
                      {log.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-700">
                        {log.automation_rules?.name || 'Rule'}
                      </span>
                      {log.tasks?.title && (
                        <span className="text-xs text-slate-400 ml-2">on: {log.tasks.title}</span>
                      )}
                      {log.detail && (
                        <p className="text-xs text-slate-400 mt-0.5">{log.detail}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
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
