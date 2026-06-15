import React, { useEffect, useState, useCallback } from 'react';
import { getAllWorkspaces, overrideWorkspacePlan, deleteWorkspace } from '../../services/superAdminService';
import {
  LuBuilding2, LuUsers, LuClipboardCheck, LuLoaderCircle,
  LuSearch, LuFilter, LuTrash2, LuPencil, LuChevronDown,
  LuCheck,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AllWorkspaces — super admin view of every workspace on the platform
// Route: /super-admin/workspaces
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = ['free', 'pro', 'enterprise'];

const PLAN_BADGE = {
  free:       'text-slate-400 bg-slate-700/60 border-slate-600',
  pro:        'text-blue-400  bg-blue-500/15  border-blue-500/30',
  enterprise: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
};

const AllWorkspaces = () => {
  const [workspaces,   setWorkspaces]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [planFilter,   setPlanFilter]   = useState(null);
  const [editingPlan,  setEditingPlan]  = useState(null); // { wsId, currentPlan }
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setWorkspaces(await getAllWorkspaces(planFilter, search));
    } catch (err) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [planFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handlePlanChange = async (wsId, newPlan) => {
    setSaving(true);
    try {
      await overrideWorkspacePlan(wsId, newPlan);
      setWorkspaces((prev) => prev.map((w) => w.id === wsId ? { ...w, plan: newPlan } : w));
      toast.success(`Plan updated to ${newPlan}`);
      setEditingPlan(null);
    } catch (err) {
      toast.error('Failed to update plan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ws) => {
    if (!window.confirm(`Delete workspace "${ws.name}"? This is irreversible.`)) return;
    try {
      await deleteWorkspace(ws.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
      toast.success('Workspace deleted.');
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white">All Workspaces</h1>
          <p className="text-slate-400 text-sm mt-1">{workspaces.length} total workspaces on the platform</p>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Plan filter */}
        <div className="flex items-center gap-2">
          <LuFilter className="text-slate-400 text-sm" />
          {[null, ...PLANS].map((p) => (
            <button
              key={p ?? 'all'}
              onClick={() => setPlanFilter(p)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition capitalize ${
                planFilter === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {p ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-blue-400 text-2xl animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-16">No workspaces found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th className="px-5 py-3.5">Workspace</th>
                  <th className="px-4 py-3.5">Owner</th>
                  <th className="px-4 py-3.5 text-center">Members</th>
                  <th className="px-4 py-3.5 text-center">Tasks</th>
                  <th className="px-4 py-3.5">Plan</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-slate-800/40 transition group">
                    {/* Workspace name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {ws.logo_url ? (
                          <img src={ws.logo_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{ws.name?.[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white text-sm">{ws.name}</p>
                          <p className="text-[10px] text-slate-500">{ws.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-300 text-xs">{ws.owner_name || '—'}</p>
                      <p className="text-slate-600 text-[10px]">{ws.owner_email}</p>
                    </td>

                    {/* Members */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="flex items-center justify-center gap-1 text-slate-300 text-xs">
                        <LuUsers className="text-slate-500 text-xs" />
                        {ws.member_count}
                      </span>
                    </td>

                    {/* Tasks */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="flex items-center justify-center gap-1 text-slate-300 text-xs">
                        <LuClipboardCheck className="text-slate-500 text-xs" />
                        {ws.task_count}
                      </span>
                    </td>

                    {/* Plan — click to change */}
                    <td className="px-4 py-3.5">
                      {editingPlan?.wsId === ws.id ? (
                        <div className="flex items-center gap-1">
                          {PLANS.map((p) => (
                            <button
                              key={p}
                              onClick={() => handlePlanChange(ws.id, p)}
                              disabled={saving}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-lg border capitalize transition ${
                                ws.plan === p
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-500 hover:text-blue-400'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPlan({ wsId: ws.id })}
                          className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize transition hover:opacity-80 ${PLAN_BADGE[ws.plan]}`}
                        >
                          {ws.plan}
                          <LuPencil className="text-[8px]" />
                        </button>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3.5 text-[11px] text-slate-500">
                      {moment(ws.created_at).format('DD MMM YYYY')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleDelete(ws)}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                        title="Delete workspace"
                      >
                        <LuTrash2 className="text-sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllWorkspaces;
