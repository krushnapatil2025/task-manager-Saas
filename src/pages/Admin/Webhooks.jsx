import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import {
  createWebhook, getWebhooks, toggleWebhook, deleteWebhook,
  getWebhookDeliveries, WEBHOOK_EVENTS,
} from '../../services/webhookService';
import {
  LuWebhook, LuPlus, LuTrash2, LuLoaderCircle, LuToggleLeft,
  LuToggleRight, LuChevronDown, LuChevronRight,
  LuCircleCheck, LuCircleX,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks — admin page to configure webhook endpoints
// Route: /admin/webhooks
// ─────────────────────────────────────────────────────────────────────────────

const Webhooks = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [hooks,    setHooks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [expanded, setExpanded] = useState(null); // webhook id for delivery log

  // Form
  const [name,   setName]   = useState('');
  const [url,    setUrl]    = useState('');
  const [events, setEvents] = useState(['task.created']);

  const load = async () => {
    if (!workspace?.id) return;
    try { setLoading(true); setHooks(await getWebhooks(workspace.id)); }
    catch { toast.error('Failed to load webhooks'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return toast.error('Name and URL are required.');
    if (!url.startsWith('http'))    return toast.error('URL must start with http:// or https://');
    if (!events.length)             return toast.error('Select at least one event.');

    setSaving(true);
    try {
      const wh = await createWebhook(workspace.id, user.id, { name: name.trim(), url: url.trim(), events });
      setHooks((prev) => [wh, ...prev]);
      setShowForm(false); setName(''); setUrl(''); setEvents(['task.created']);
      toast.success('Webhook created!');
    } catch (err) {
      toast.error(err.message || 'Failed to create webhook.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id, current) => {
    await toggleWebhook(id, !current);
    setHooks((prev) => prev.map((h) => h.id === id ? { ...h, is_active: !current } : h));
    toast.success(`Webhook ${!current ? 'enabled' : 'disabled'}.`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    await deleteWebhook(id);
    setHooks((prev) => prev.filter((h) => h.id !== id));
    toast.success('Webhook deleted.');
  };

  const toggleEvent = (ev) =>
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);

  return (
    <DashboardLayout activeMenu="Webhooks">
      <div className="mt-4 pb-12 max-w-3xl animate-fade-in font-sans">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              🔗 Event Webhooks
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              Subscribe external listeners to real-time events in <strong className="text-indigo-655 dark:text-indigo-400">{workspace?.name}</strong>
            </p>
          </div>
          <button
            onClick={() => setShowForm((o) => !o)}
            className="card-btn-fill flex items-center justify-center gap-1.5 text-xs self-start sm:self-center"
          >
            <LuPlus size={14} /> Add Webhook
          </button>
        </div>

        {/* ── Create form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="card p-6 mb-6">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Register New Webhook</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Friendly Name</label>
                  <input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Slack Sync Bot"
                    className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200" 
                  />
                </div>
                <div>
                  <label className="field-label">Target Endpoint URL</label>
                  <input 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="https://hooks.yourdomain.com/webhooks"
                    className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200" 
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Subscribe to Events</label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <button 
                      key={ev} 
                      type="button" 
                      onClick={() => toggleEvent(ev)}
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        events.includes(ev) 
                          ? 'bg-indigo-650 text-white border-transparent shadow-sm' 
                          : 'bg-slate-100/60 dark:bg-zinc-900/60 text-slate-505 dark:text-zinc-400 border-slate-205 dark:border-zinc-800/80 hover:text-slate-705 dark:hover:text-zinc-200'
                      }`}
                    >{ev}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="card-btn-fill flex items-center justify-center gap-1.5 text-xs py-2 px-5"
                >
                  {saving ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuWebhook size={14} />}
                  {saving ? 'Creating Webhook...' : 'Register Webhook'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="card-btn text-xs px-4"
                >Cancel</button>
              </div>
            </div>
          </form>
        )}

        {/* ── Webhook list ── */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <LuLoaderCircle className="text-indigo-655 text-2xl animate-spin" />
            </div>
          ) : hooks.length === 0 ? (
            <div className="card py-16 text-center text-slate-400 dark:text-zinc-550 font-bold text-xs flex flex-col items-center gap-2 uppercase tracking-wider">
              <LuWebhook size={28} className="opacity-30" />
              No active webhooks configured for this workspace.
            </div>
          ) : (
            hooks.map((h) => (
              <WebhookCard
                key={h.id}
                hook={h}
                isExpanded={expanded === h.id}
                onToggle={() => handleToggle(h.id, h.is_active)}
                onDelete={() => handleDelete(h.id)}
                onExpand={() => setExpanded((e) => e === h.id ? null : h.id)}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Webhooks;

// ─────────────────────── Webhook Card ────────────────────────────────────────

const WebhookCard = ({ hook, isExpanded, onToggle, onDelete, onExpand }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loadingD,   setLoadingD]   = useState(false);

  const handleExpand = async () => {
    onExpand();
    if (!deliveries.length) {
      setLoadingD(true);
      try { setDeliveries(await getWebhookDeliveries(hook.id)); }
      finally { setLoadingD(false); }
    }
  };

  return (
    <div className="card !p-0 overflow-hidden transition-all duration-200">
      <div className="flex items-center gap-4 px-5 py-4">
        
        {/* Status dot */}
        <div className="relative flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${hook.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'}`} />
          {hook.is_active && (
            <div className="absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-855 dark:text-zinc-200">{hook.name}</p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate font-mono mt-0.5 select-all">{hook.url}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hook.events?.map((ev) => (
              <span key={ev} className="text-[9px] font-extrabold text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">{ev}</span>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={onToggle} 
            title={hook.is_active ? 'Disable Webhook' : 'Enable Webhook'} 
            className="text-slate-400 dark:text-slate-555 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors text-xl cursor-pointer p-1"
          >
            {hook.is_active ? <LuToggleRight className="text-indigo-650 dark:text-indigo-500 text-2xl" /> : <LuToggleLeft className="text-2xl" />}
          </button>
          
          <button 
            onClick={onDelete} 
            title="Delete Webhook"
            className="p-1.5 text-slate-400 dark:text-slate-555 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-50 dark:hover:bg-[#161619] rounded-lg transition-all cursor-pointer"
          >
            <LuTrash2 size={15} />
          </button>
          
          <button 
            onClick={handleExpand} 
            title="Toggle delivery history"
            className="p-1.5 text-slate-400 dark:text-slate-555 hover:text-slate-705 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            {isExpanded ? <LuChevronDown size={15} /> : <LuChevronRight size={15} />}
          </button>
        </div>
      </div>

      {/* Delivery Log Section */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-zinc-800/80 px-5 py-4 bg-slate-50/40 dark:bg-[#121215]/30 animate-fade-in">
          <p className="text-[9px] font-extrabold text-slate-450 dark:text-zinc-550 uppercase tracking-widest mb-3">Recent Dispatch History</p>
          
          {loadingD ? (
            <div className="flex justify-center py-4">
              <LuLoaderCircle className="animate-spin text-indigo-650" size={18} />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-[9px] text-slate-405 dark:text-zinc-550 text-center py-3 font-bold uppercase tracking-wider">No dispatches recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-white dark:bg-[#0c0c0e] border border-slate-100 dark:border-zinc-800/85 rounded-xl px-3 py-2.5">
                  {d.success
                    ? <LuCircleCheck className="text-emerald-500 text-sm flex-shrink-0" />
                    : <LuCircleX    className="text-rose-500 text-sm flex-shrink-0" />
                  }
                  <span className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-400 bg-slate-150/50 dark:bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-wider">{d.event}</span>
                  <span className={`text-[10px] font-mono font-bold ${d.success ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-500'}`}>
                    HTTP {d.status_code || 'Error'}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider ml-auto">{moment(d.delivered_at).fromNow()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
