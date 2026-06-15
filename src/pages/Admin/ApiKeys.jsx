import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import {
  createApiKey, getApiKeys, revokeApiKey, deleteApiKey, AVAILABLE_SCOPES,
} from '../../services/apiKeyService';
import {
  LuKey, LuPlus, LuCopy, LuTrash2, LuLoaderCircle,
  LuShieldCheck, LuCircleAlert, LuEye, LuEyeOff,
  LuCircleCheck, LuCircleX, LuClock,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ApiKeys — admin page to generate and manage workspace API keys
// Route: /admin/api-keys
// ─────────────────────────────────────────────────────────────────────────────

const ApiKeys = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [keys,      setKeys]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [newKey,    setNewKey]    = useState(null); // raw key shown once
  const [showForm,  setShowForm]  = useState(false);

  // Form state
  const [name,   setName]   = useState('');
  const [scopes, setScopes] = useState(['tasks:read']);

  const load = async () => {
    if (!workspace?.id) return;
    try { setLoading(true); setKeys(await getApiKeys(workspace.id)); }
    catch { toast.error('Failed to load API keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Key name is required.');
    if (!scopes.length) return toast.error('Select at least one scope.');
    setCreating(true);
    try {
      const { rawKey, record } = await createApiKey(workspace.id, user.id, name.trim(), scopes);
      setNewKey(rawKey);
      setKeys((prev) => [record, ...prev]);
      setShowForm(false);
      setName('');
      setScopes(['tasks:read']);
    } catch (err) {
      toast.error(err.message || 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    await revokeApiKey(id);
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, is_active: false } : k));
    toast.success('API key revoked.');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this API key permanently?')) return;
    await deleteApiKey(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success('API key deleted.');
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const toggleScope = (s) =>
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <DashboardLayout activeMenu="API Keys">
      <div className="mt-5 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <LuKey className="text-blue-500" /> API Keys
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Keys let external tools access <strong className="text-gray-600">{workspace?.name}</strong>'s task data.
            </p>
          </div>
          <button
            onClick={() => setShowForm((o) => !o)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow hover:opacity-90 transition"
          >
            <LuPlus /> New API Key
          </button>
        </div>

        {/* ── One-time raw key reveal ── */}
        {newKey && (
          <div className="mb-5 bg-lime-50 border border-lime-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <LuShieldCheck className="text-lime-600 text-xl flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-lime-800 mb-1">
                  Save your API key now — it won't be shown again!
                </p>
                <div className="flex items-center gap-2 bg-white border border-lime-200 rounded-xl px-4 py-2.5">
                  <code className="text-xs text-gray-700 flex-1 font-mono break-all">{newKey}</code>
                  <button onClick={() => handleCopy(newKey)} className="text-lime-600 hover:text-lime-800 flex-shrink-0">
                    <LuCopy className="text-sm" />
                  </button>
                </div>
                <button onClick={() => setNewKey(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-2">
                  I've saved it. Dismiss ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Create New Key</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                  Key Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CI/CD Bot, Slack Integration"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                  Scopes (permissions)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SCOPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleScope(s.value)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                        scopes.includes(s.value)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {scopes.includes(s.value) && <LuCircleCheck className="text-xs" />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60"
                >
                  {creating ? <LuLoaderCircle className="animate-spin" /> : <LuKey />}
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Key list ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Active Keys</h3>
            <span className="text-xs text-gray-400">{keys.length} total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LuLoaderCircle className="text-blue-500 text-2xl animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">No API keys yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 group transition">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <LuKey className="text-blue-500 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{k.name}</p>
                      {k.is_active
                        ? <span className="text-[10px] font-bold text-lime-600 bg-lime-50 border border-lime-200 px-2 py-0.5 rounded-full">Active</span>
                        : <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Revoked</span>
                      }
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{k.key_prefix}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                      <span>{(k.scopes || []).join(', ')}</span>
                      {k.last_used_at && (
                        <span className="flex items-center gap-1">
                          <LuClock className="text-[10px]" /> Last used {moment(k.last_used_at).fromNow()}
                        </span>
                      )}
                      <span>Created {moment(k.created_at).format('DD MMM YYYY')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        title="Revoke key"
                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition"
                      >
                        <LuCircleX className="text-sm" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(k.id)}
                      title="Delete key"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <LuTrash2 className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage docs */}
        <div className="mt-5 bg-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-widest">Quick Start</p>
          <pre className="text-xs text-green-400 font-mono overflow-x-auto leading-relaxed">{
`# List tasks
curl ${window.location.origin.replace('5173','54321')}/functions/v1/api-tasks \\
  -H "X-API-Key: tf_live_..."

# Create a task
curl -X POST .../api-tasks \\
  -H "X-API-Key: tf_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Ship feature","priority":"high"}'`
          }</pre>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ApiKeys;
