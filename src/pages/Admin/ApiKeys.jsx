import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import {
  createApiKey, getApiKeys, revokeApiKey, deleteApiKey, AVAILABLE_SCOPES,
} from '../../services/apiKeyService';
import {
  LuKey, LuPlus, LuCopy, LuTrash2, LuLoaderCircle,
  LuShieldCheck, LuCircleCheck, LuCircleX, LuClock,
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
      <div className="mt-4 pb-12 max-w-3xl animate-fade-in font-sans">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              🔑 Workspace API Access
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-555 mt-1.5 font-bold uppercase tracking-wider">
              Authorize external client integrations for <strong className="text-indigo-655 dark:text-indigo-400">{workspace?.name}</strong>
            </p>
          </div>
          <button
            onClick={() => setShowForm((o) => !o)}
            className="card-btn-fill flex items-center justify-center gap-1.5 text-xs self-start sm:self-center cursor-pointer"
          >
            <LuPlus size={14} /> New API Key
          </button>
        </div>

        {/* ── One-time raw key reveal ── */}
        {newKey && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <LuShieldCheck className="text-emerald-600 dark:text-emerald-450 text-xl flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-355 mb-1.5 uppercase tracking-wide">
                  Save your API key now — it won't be shown again!
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-[#121215] border border-emerald-200/50 dark:border-emerald-900/40 rounded-xl px-4 py-3">
                  <code className="text-xs text-slate-750 dark:text-zinc-200 flex-1 font-mono break-all select-all">{newKey}</code>
                  <button onClick={() => handleCopy(newKey)} className="text-emerald-605 dark:text-emerald-400 hover:text-emerald-700 transition cursor-pointer">
                    <LuCopy size={15} />
                  </button>
                </div>
                <button onClick={() => setNewKey(null)} className="text-[10px] font-bold text-slate-450 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-slate-300 mt-2.5 uppercase tracking-wider block cursor-pointer">
                  I have copied this key. Dismiss ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="card p-6 mb-6">
            <h3 className="text-xs font-extrabold text-slate-805 dark:text-zinc-200 uppercase tracking-wider mb-4">Create New Access Key</h3>
            <div className="space-y-5">
              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">
                  Friendly Label Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub Actions, Reporting Bot"
                  className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
                />
              </div>

              <div>
                <label className="field-label text-slate-500 dark:text-zinc-400">
                  Authorized Scopes
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SCOPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleScope(s.value)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        scopes.includes(s.value)
                          ? 'bg-indigo-650 text-white border-transparent shadow-sm'
                          : 'bg-slate-100/60 dark:bg-zinc-900/60 text-slate-505 dark:text-zinc-400 border-slate-205 dark:border-zinc-800/80 hover:text-slate-700 dark:hover:text-zinc-200'
                      }`}
                    >
                      {scopes.includes(s.value) && <LuCircleCheck size={12} />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="card-btn-fill flex items-center justify-center gap-1.5 text-xs py-2 px-5 cursor-pointer"
                >
                  {creating ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuKey size={14} />}
                  {creating ? 'Creating...' : 'Generate Key'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="card-btn text-xs px-4 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Key List ── */}
        <div className="card !p-0 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-105 dark:border-zinc-800/80 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-405 dark:text-zinc-555 uppercase tracking-wider">Active Workspace Keys</h3>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">{keys.length} keys total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LuLoaderCircle className="text-indigo-650 text-2xl animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-zinc-550 font-bold text-xs flex flex-col items-center gap-2 uppercase tracking-wider">
              <LuKey size={28} className="opacity-30" />
              No integrations active. Generate an API Key to begin.
            </div>
          ) : (
            <div className="divide-y divide-slate-105 dark:divide-zinc-800/80">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-25/40 dark:hover:bg-zinc-900/10 group transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <LuKey className="text-indigo-655 dark:text-indigo-400 text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-805 dark:text-zinc-200">{k.name}</p>
                      {k.is_active
                        ? <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                        : <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/15 border border-rose-100 dark:border-rose-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Revoked</span>
                      }
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 font-mono select-all">{k.key_prefix}</p>
                    <div className="flex items-center gap-2.5 mt-1.5 text-[9px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wide">
                      <span className="text-indigo-650 dark:text-indigo-400">{(k.scopes || []).join(' · ')}</span>
                      <span className="text-slate-350 dark:text-zinc-700">|</span>
                      {k.last_used_at ? (
                        <span className="flex items-center gap-1">
                          <LuClock size={10} /> Active {moment(k.last_used_at).fromNow()}
                        </span>
                      ) : (
                        <span>Never Used</span>
                      )}
                      <span className="text-slate-350 dark:text-zinc-700">|</span>
                      <span>Created {moment(k.created_at).format('DD MMM YYYY')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        title="Revoke key"
                        className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-450 hover:bg-amber-50 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                      >
                        <LuCircleX size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(k.id)}
                      title="Delete key"
                      className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                    >
                      <LuTrash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Docs Card */}
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <p className="text-[9px] font-extrabold text-slate-450 dark:text-zinc-500 mb-3.5 uppercase tracking-widest">REST CLI Access Quickstart</p>
          <pre className="text-xs text-emerald-400 dark:text-emerald-400/90 font-mono overflow-x-auto leading-relaxed select-all">{
`# List active tasks
curl ${window.location.origin.replace('5173','54321')}/functions/v1/api-tasks \\
  -H "X-API-Key: tf_live_..."

# Create a project task
curl -X POST ${window.location.origin.replace('5173','54321')}/functions/v1/api-tasks \\
  -H "X-API-Key: tf_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Ship dashboard updates","priority":"high"}'`
          }</pre>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ApiKeys;
