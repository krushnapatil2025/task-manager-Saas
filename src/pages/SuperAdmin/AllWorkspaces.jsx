import React, { useEffect, useState, useCallback } from 'react';
import { 
  getAllWorkspaces, 
  overrideWorkspacePlan, 
  deleteWorkspace, 
  setWorkspaceApprovalStatus 
} from '../../services/superAdminService';
import {
  LuBuilding2, LuUsers, LuClipboardCheck, LuLoaderCircle,
  LuSearch, LuFilter, LuTrash2, LuPencil, LuCheck, LuX,
  LuSparkles, LuFolderSync, LuLock, LuLockOpen
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AllWorkspaces — Expanded super admin view of every workspace on the platform
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = ['free', 'pro', 'enterprise'];

const PLAN_BADGE = {
  free:       'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
  pro:        'text-amber-400 bg-amber-500/10 border-amber-500/25',
  enterprise: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
};

const STATUS_BADGE = {
  pending:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  approved:   'text-green-400 bg-green-500/10 border-green-500/20',
  rejected:   'text-rose-400 bg-rose-500/10 border-rose-500/20',
  restricted: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const AllWorkspaces = () => {
  const [workspaces,   setWorkspaces]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [planFilter,   setPlanFilter]   = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [editingPlan,  setEditingPlan]  = useState(null); // { wsId }
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all workspaces once, then filter client-side for consistent stats
      const data = await getAllWorkspaces(null, '', null);
      setWorkspaces(data);
    } catch (err) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePlanChange = async (wsId, newPlan) => {
    setSaving(true);
    try {
      await overrideWorkspacePlan(wsId, newPlan);
      setWorkspaces((prev) => prev.map((w) => w.id === wsId ? { ...w, plan: newPlan } : w));
      toast.success(`Plan updated to ${newPlan.toUpperCase()}`);
      setEditingPlan(null);
    } catch (err) {
      toast.error('Failed to update plan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (ws) => {
    const isCurrentlySuspended = ws.approval_status === 'restricted';
    const targetStatus = isCurrentlySuspended ? 'approved' : 'restricted';
    const actionLabel = isCurrentlySuspended ? 'Restore' : 'Suspend';

    if (!window.confirm(`${actionLabel} workspace "${ws.name}"?`)) return;

    try {
      await setWorkspaceApprovalStatus(ws.id, targetStatus);
      setWorkspaces((prev) => prev.map((w) => w.id === ws.id ? { ...w, approval_status: targetStatus } : w));
      toast.success(`Workspace successfully ${isCurrentlySuspended ? 'restored' : 'suspended'}.`);
    } catch (err) {
      toast.error(`Failed to ${actionLabel.toLowerCase()}: ` + err.message);
    }
  };

  const handleDelete = async (ws) => {
    if (!window.confirm(`PERMANENTLY DELETE workspace "${ws.name}"?\nWARNING: This is completely IRREVERSIBLE and will wipe all associated tasks, comments, files, and memberships!`)) return;
    try {
      await deleteWorkspace(ws.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
      toast.success('Workspace deleted from system.');
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  // Client-side filtering
  const filteredWorkspaces = workspaces.filter((ws) => {
    // 1. Plan filter
    if (planFilter && ws.plan !== planFilter) return false;

    // 2. Status filter (fallback to 'approved' if null/undefined)
    const status = ws.approval_status || 'approved';
    if (statusFilter && status !== statusFilter) return false;

    // 3. Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        ws.name?.toLowerCase().includes(searchLower) ||
        ws.slug?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Stats calculation based on full workspaces array
  const stats = {
    total:      workspaces.length,
    free:       workspaces.filter(w => (w.plan || 'free') === 'free').length,
    pro:        workspaces.filter(w => w.plan === 'pro').length,
    enterprise: workspaces.filter(w => w.plan === 'enterprise').length,
    suspended:  workspaces.filter(w => (w.approval_status || 'approved') === 'restricted').length,
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuBuilding2 className="text-indigo-400" /> Workspace Management
          </h1>
          <p className="text-slate-400 text-xs mt-1">Audit billing tiers, override plans, and control operational statuses platform-wide</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'from-slate-800 to-slate-900', text: 'text-white' },
          { label: 'Free Trial', value: stats.free, color: 'from-indigo-950/40 to-indigo-900/10 border-indigo-500/20', text: 'text-indigo-400' },
          { label: 'Professional', value: stats.pro, color: 'from-amber-950/40 to-amber-900/10 border-amber-500/20', text: 'text-amber-400' },
          { label: 'Enterprise', value: stats.enterprise, color: 'from-emerald-950/40 to-emerald-900/10 border-emerald-500/20', text: 'text-emerald-400' },
          { label: 'Suspended', value: stats.suspended, color: 'from-rose-950/40 to-rose-900/10 border-rose-500/20', text: 'text-rose-400 animate-pulse' },
        ].map((s, idx) => (
          <div key={idx} className={`bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center`}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
            <span className={`text-2xl font-black mt-1 ${s.text}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces by name or slug..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Plan</span>
            {[null, ...PLANS].map((p) => (
              <button
                key={p ?? 'all'}
                onClick={() => setPlanFilter(p)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition capitalize cursor-pointer ${
                  planFilter === p
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {p ?? 'All'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Status</span>
            {[
              { value: null, label: 'All' },
              { value: 'approved', label: 'Active' },
              { value: 'restricted', label: 'Suspended' }
            ].map((s) => (
              <button
                key={s.value ?? 'all'}
                onClick={() => setStatusFilter(s.value)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition capitalize cursor-pointer ${
                  statusFilter === s.value
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-20">
            <LuBuilding2 className="text-slate-700 text-4xl mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No workspaces matched your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4">Workspace</th>
                  <th className="px-6 py-4">Owner Profile</th>
                  <th className="px-4 py-4 text-center">Members</th>
                  <th className="px-4 py-4 text-center">Tasks</th>
                  <th className="px-6 py-4">Plan Level</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredWorkspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-slate-900/40 transition group">
                    
                    {/* Workspace details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {ws.logo_url ? (
                          <img src={ws.logo_url} className="w-9 h-9 rounded-xl object-cover border border-slate-850" alt="" />
                        ) : (
                          <div 
                            style={{ backgroundColor: ws.brand_color || '#818cf8' }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner"
                          >
                            <span className="text-white text-xs font-black">{ws.name?.[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{ws.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">Slug: {ws.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Owner detail */}
                    <td className="px-6 py-4">
                      <p className="text-slate-300 text-xs font-bold">{ws.owner_name || '—'}</p>
                      <p className="text-slate-550 text-[10px]">{ws.owner_email}</p>
                    </td>

                    {/* Members */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 bg-slate-950/40 border border-slate-850 px-2.5 py-1 rounded-lg text-slate-300 text-xs font-semibold">
                        <LuUsers className="text-slate-500 text-xs" />
                        {ws.member_count}
                      </span>
                    </td>

                    {/* Tasks */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 bg-slate-950/40 border border-slate-850 px-2.5 py-1 rounded-lg text-slate-300 text-xs font-semibold">
                        <LuClipboardCheck className="text-slate-500 text-xs" />
                        {ws.task_count}
                      </span>
                    </td>

                    {/* Billing Plan Override */}
                    <td className="px-6 py-4">
                      {editingPlan?.wsId === ws.id ? (
                        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
                          {PLANS.map((p) => (
                            <button
                              key={p}
                              onClick={() => handlePlanChange(ws.id, p)}
                              disabled={saving}
                              className={`text-[9px] font-black px-2.5 py-1 rounded-lg border capitalize transition cursor-pointer ${
                                ws.plan === p
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                  : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button 
                            onClick={() => setEditingPlan(null)}
                            className="p-1 rounded-lg text-slate-500 hover:text-white transition cursor-pointer"
                          >
                            <LuX size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPlan({ wsId: ws.id })}
                          className={`flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full border capitalize transition hover:border-slate-650 cursor-pointer ${PLAN_BADGE[ws.plan || 'free']}`}
                        >
                          {ws.plan || 'Free'}
                          <LuPencil className="text-[8px]" />
                        </button>
                      )}
                    </td>

                    {/* Approval status */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${STATUS_BADGE[ws.approval_status || 'approved']}`}>
                        {ws.approval_status === 'restricted' ? 'Suspended' : ws.approval_status || 'Active'}
                      </span>
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                      {moment(ws.created_at).format('DD MMM YYYY')}
                    </td>

                    {/* Suspension/Deletion Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Suspend/Restore Button */}
                        <button
                          onClick={() => handleStatusToggle(ws)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            ws.approval_status === 'restricted'
                              ? 'text-green-400 bg-green-500/5 border-green-500/20 hover:bg-green-500/15'
                              : 'text-amber-400 bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/15'
                          }`}
                          title={ws.approval_status === 'restricted' ? 'Restore Workspace' : 'Suspend Workspace'}
                        >
                          {ws.approval_status === 'restricted' ? <LuLockOpen size={14} /> : <LuLock size={14} />}
                        </button>

                        {/* Force Delete Button */}
                        <button
                          onClick={() => handleDelete(ws)}
                          className="p-2 text-rose-400 bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/15 rounded-xl transition cursor-pointer"
                          title="Delete Workspace (Cascade)"
                        >
                          <LuTrash2 size={14} />
                        </button>
                      </div>
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
