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
  LuToggleRight, LuChevronDown, LuChevronRight, LuCopy,
  LuCircleCheck, LuCircleX, LuCircleAlert,
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
      <div className="mt-5 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <LuWebhook className="text-purple-500" /> Webhooks
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Push events from <strong className="text-gray-600">{workspace?.name}</strong> to external URLs.
            </p>
          </div>
          <button
            onClick={() => setShowForm((o) => !o)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow hover:opacity-90 transition"
          >
            <LuPlus /> Add Webhook
          </button>
        </div>

        {/* ── Create form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">New Webhook</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack Notifications"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">Endpoint URL</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">Events to subscribe</label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                        events.includes(ev) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                      }`}
                    >{ev}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60"
                >
                  {saving ? <LuLoaderCircle className="animate-spin" /> : <LuWebhook />}
                  {saving ? 'Creating...' : 'Create Webhook'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Cancel</button>
              </div>
            </div>
          </form>
        )}

        {/* ── Webhook list ── */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><LuLoaderCircle className="text-blue-500 text-2xl animate-spin" /></div>
          ) : hooks.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
              No webhooks configured yet.
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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hook.is_active ? 'bg-lime-400 animate-pulse' : 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{hook.name}</p>
          <p className="text-xs text-gray-400 truncate font-mono">{hook.url}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hook.events?.map((ev) => (
              <span key={ev} className="text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">{ev}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggle} title={hook.is_active ? 'Disable' : 'Enable'} className="text-gray-400 hover:text-blue-600 transition text-xl">
            {hook.is_active ? <LuToggleRight className="text-blue-500 text-2xl" /> : <LuToggleLeft className="text-2xl" />}
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
            <LuTrash2 className="text-sm" />
          </button>
          <button onClick={handleExpand} className="p-1.5 text-gray-400 hover:text-gray-700 transition">
            {isExpanded ? <LuChevronDown className="text-sm" /> : <LuChevronRight className="text-sm" />}
          </button>
        </div>
      </div>

      {/* Delivery log */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent Deliveries</p>
          {loadingD ? (
            <div className="flex justify-center py-4"><LuLoaderCircle className="animate-spin text-blue-500" /></div>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  {d.success
                    ? <LuCircleCheck className="text-lime-500 text-sm flex-shrink-0" />
                    : <LuCircleX    className="text-red-400 text-sm flex-shrink-0" />
                  }
                  <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{d.event}</span>
                  <span className={`text-[10px] font-mono ${d.success ? 'text-lime-600' : 'text-red-500'}`}>
                    HTTP {d.status_code || '—'}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{moment(d.delivered_at).fromNow()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
