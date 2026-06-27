import React, { useEffect, useState, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import InviteEmployee, { JOB_PROFILES } from './InviteEmployee';
import AccessControlPanel from '../../components/AccessControlPanel';
import {
  getEmployeeInvitations,
  revokeEmployeeInvitation,
  resendEmployeeInvite,
  buildSetupLink,
} from '../../services/invitationService';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import { supabase } from '../../utils/supabaseClient';
import toast from 'react-hot-toast';
import {
  LuUserPlus, LuUsers, LuMail, LuRefreshCw, LuCircleX,
  LuCopy, LuShield, LuSearch, LuLoaderCircle, LuFileSpreadsheet,
  LuCircleCheck, LuClock, LuUserX, LuChevronDown, LuShieldCheck,
} from 'react-icons/lu';
import ExcelJS from 'exceljs';

// ── helpers ───────────────────────────────────────────────────────────────────
const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

const statusBadge = (status, isPending, isExpired) => {
  if (status === 'accepted') return { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' };
  if (status === 'revoked')  return { label: 'Revoked',  cls: 'bg-slate-55 text-slate-600 border-slate-200 dark:bg-[#161619]/40 dark:text-[#a1a1aa] dark:border-zinc-800' };
  if (isExpired)             return { label: 'Expired',  cls: 'bg-rose-50 text-rose-700 border-rose-205 dark:bg-rose-955/15 dark:text-rose-455 dark:border-rose-900/30' };
  if (isPending)             return { label: 'Pending',  cls: 'bg-amber-50 text-amber-705 border-amber-200 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30' };
  return                            { label: status,     cls: 'bg-slate-55 text-slate-600 border-slate-205 dark:bg-[#161619]/40 dark:text-[#a1a1aa] dark:border-zinc-800' };
};

const TABS = ['All Members', 'Pending Invitations', 'All Invitations', 'Access Control'];

// ─────────────────────────────────────────────────────────────────────────────
const ManageUsers = () => {
  const { workspace, onlineUsers = {} } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [tab,            setTab]           = useState(0);
  const [members,        setMembers]        = useState([]);
  const [invitations,    setInvitations]    = useState([]);
  const [teams,          setTeams]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState('');
  const [roleFilter,     setRoleFilter]     = useState('');
  const [showInvite,     setShowInvite]     = useState(false);
  const [actionLoading,  setActionLoading]  = useState({});
  const [selectedMember, setSelectedMember] = useState(null); // for access panel

  // ── data loaders ──────────────────────────────────────────────────────────
  const loadMembers = async () => {
    if (!workspace?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_workspace_members_full', {
        p_workspace_id: workspace.id,
      });
      if (!error && Array.isArray(data)) {
        setMembers(data);
        return;
      }
    } catch {
      // fall through
    }

    const { data, error: fallbackErr } = await supabase
      .from('workspace_members')
      .select(`
        role, joined_at,
        profiles(id, name, profile_image_url, job_profile, department, status, employee_id)
      `)
      .eq('workspace_id', workspace.id);

    if (fallbackErr) {
      console.error('[ManageUsers] loadMembers error:', fallbackErr.message);
      return;
    }

    const mapped = (data || []).map(m => ({
      user_id:           m.profiles?.id,
      name:              m.profiles?.name,
      email:             null,
      job_profile:       m.profiles?.job_profile || m.role,
      department:        m.profiles?.department,
      status:            m.profiles?.status || 'active',
      profile_image_url: m.profiles?.profile_image_url,
      employee_id:       m.profiles?.employee_id,
      role:              m.role,
      joined_at:         m.joined_at,
      team_names:        [],
    }));

    mapped.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    setMembers(mapped);
  };

  const loadInvitations = async () => {
    if (!workspace?.id) return;
    try {
      const data = await getEmployeeInvitations(workspace.id);
      setInvitations(data);
    } catch (err) {
      toast.error('Failed to load invitations');
    }
  };

  const loadTeams = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .order('name');
    setTeams(data || []);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMembers(), loadInvitations(), loadTeams()]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [workspace?.id]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleRevoke = async (id) => {
    setActionLoading(a => ({ ...a, [id]: true }));
    try {
      await revokeEmployeeInvitation(id);
      toast.success('Invitation revoked.');
      loadInvitations();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(a => ({ ...a, [id]: false })); }
  };

  const handleResend = async (id) => {
    setActionLoading(a => ({ ...a, [id]: true }));
    try {
      await resendEmployeeInvite(id);
      toast.success('Invitation resent with a fresh link!');
      loadInvitations();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(a => ({ ...a, [id]: false })); }
  };

  const handleCopyLink = (token) => {
    navigator.clipboard.writeText(buildSetupLink(token));
    toast.success('Setup link copied!');
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('workspace_id', workspace.id)
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('Role updated.');
      loadMembers();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm('Deactivate this member? They will lose workspace access.')) return;
    try {
      await supabase.from('profiles').update({ status: 'inactive' }).eq('id', userId);
      await supabase.from('workspace_members').delete()
        .eq('workspace_id', workspace.id).eq('user_id', userId);
      toast.success('Member deactivated.');
      loadMembers();
    } catch (err) { toast.error(err.message); }
  };

  const handleExport = async () => {
    const wb    = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Team Members');
    sheet.columns = [
      { header: 'Name',       key: 'name',       width: 24 },
      { header: 'Job Profile',key: 'job_profile', width: 18 },
      { header: 'Department', key: 'department',  width: 18 },
      { header: 'Status',     key: 'status',      width: 12 },
      { header: 'Joined',     key: 'joined_at',   width: 20 },
    ];
    members.forEach(m => sheet.addRow({
      name:       m.name,
      job_profile: JP_MAP[m.job_profile]?.label || m.job_profile,
      department: m.department || '',
      status:     m.status,
      joined_at:  m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '',
    }));
    const buf  = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    link.download = `${workspace?.name}_members.xlsx`;
    link.click();
    toast.success('Report downloaded!');
  };

  // ── filtered data ─────────────────────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name?.toLowerCase().includes(q) || m.department?.toLowerCase().includes(q);
    const matchRole   = !roleFilter || m.job_profile === roleFilter || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const pendingInvites = invitations.filter(i => i.isPending);
  const shownInvites   = tab === 1 ? pendingInvites : invitations;
  const filteredInvites = shownInvites.filter(i => {
    const q = search.toLowerCase();
    return !q || i.email?.toLowerCase().includes(q) || i.fullName?.toLowerCase().includes(q);
  });

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout activeMenu="Team Members">
      <div className="mt-5 mb-10 font-sans">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">👤 User & Role Management</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} ·{' '}
              <span className="font-extrabold text-indigo-650 dark:text-indigo-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              {pendingInvites.length > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold">
                  · {pendingInvites.length} pending
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="card-btn flex items-center gap-1.5 text-xs cursor-pointer">
              <LuFileSpreadsheet size={14}/> Export
            </button>
            <button onClick={() => setShowInvite(true)} className="card-btn-fill flex items-center gap-1.5 text-xs cursor-pointer">
              <LuUserPlus size={14}/> Invite Employee
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl mb-5 w-fit border border-slate-205 dark:border-zinc-800/80">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => { setTab(i); setSearch(''); setRoleFilter(''); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === i
                  ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}
            >
              {t}
              {t === 'Pending Invitations' && pendingInvites.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {pendingInvites.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <LuSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500"/>
            <input
              type="text"
              placeholder={tab === 0 ? 'Search by name or department…' : 'Search by email or name…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
            />
          </div>
          {tab === 0 && (
            <div className="relative">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="field-input pl-3 pr-8 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 appearance-none cursor-pointer min-w-[130px]"
              >
                <option value="">All Roles</option>
                {JOB_PROFILES.map(j => (
                  <option key={j.value} value={j.value}>{j.emoji} {j.label}</option>
                ))}
              </select>
              <LuChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          )}
          <button onClick={loadAll} className="card-btn flex items-center gap-1.5 text-xs px-3 cursor-pointer">
            <LuRefreshCw size={13}/> Refresh
          </button>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={28}/>
          </div>
        ) : (
          <>
            {/* ══════════ TAB 0 — All Members ══════════ */}
            {tab === 0 && (
              <div className="card overflow-x-auto !p-0">
                <table className="premium-table min-w-full">
                  <thead>
                    <tr>
                      <th className="dark:text-zinc-500">Member</th>
                      <th className="dark:text-zinc-500">Job Profile</th>
                      <th className="dark:text-zinc-500">Department</th>
                      <th className="dark:text-zinc-500">Teams</th>
                      <th className="dark:text-zinc-500">Status</th>
                      <th className="dark:text-zinc-500">Role</th>
                      <th className="text-right dark:text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                          <LuUsers size={32} className="mx-auto mb-2 opacity-30"/>
                          No members found.
                        </td>
                      </tr>
                    ) : filteredMembers.map(m => {
                      const jp = JP_MAP[m.job_profile] || JP_MAP[m.role] || JP_MAP.employee;
                      const isMe = m.user_id === user?.id;
                      return (
                        <UserRow
                          key={m.user_id}
                          m={m}
                          user={user}
                          jp={jp}
                          isMe={isMe}
                          handleChangeRole={handleChangeRole}
                          setSelectedMember={setSelectedMember}
                          handleDeactivate={handleDeactivate}
                          JOB_PROFILES={JOB_PROFILES}
                          onlineUsers={onlineUsers}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══════════ TAB 1 & 2 — Invitations ══════════ */}
            {(tab === 1 || tab === 2) && (
              <div className="card overflow-x-auto !p-0">
                <table className="premium-table min-w-full">
                  <thead>
                    <tr>
                      <th className="dark:text-zinc-500">Invitee</th>
                      <th className="dark:text-zinc-500">Job Profile</th>
                      <th className="dark:text-zinc-500">Department / Team</th>
                      <th className="dark:text-zinc-500">Status</th>
                      <th className="dark:text-zinc-500">Sent</th>
                      <th className="dark:text-zinc-500">Expires</th>
                      <th className="text-right dark:text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                          <LuMail size={32} className="mx-auto mb-2 opacity-30"/>
                          {tab === 1 ? 'No pending invitations.' : 'No invitations found.'}
                        </td>
                      </tr>
                    ) : filteredInvites.map(inv => {
                      const jp     = JP_MAP[inv.jobProfile] || JP_MAP.employee;
                      const badge  = statusBadge(inv.status, inv.isPending, inv.isExpired);
                      const busy   = actionLoading[inv.id];
                      return (
                        <InviteRow
                          key={inv.id}
                          inv={inv}
                          jp={jp}
                          badge={badge}
                          busy={busy}
                          handleResend={handleResend}
                          handleCopyLink={handleCopyLink}
                          handleRevoke={handleRevoke}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* ══════════ TAB 3 — Access Control ══════════ */}
            {tab === 3 && (
              <div>
                <div className="mb-5 p-4 bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-150/30 dark:border-indigo-900/30 rounded-xl flex items-start gap-3">
                  <LuShield size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Per-User Access Control</p>
                    <p className="text-xs text-indigo-650 dark:text-indigo-305 mt-1 font-semibold">
                      Click <strong>🛡 Manage Access</strong> on any member to open a panel with
                      toggle switches for every permission. Overrides layer on top of the
                      role-based defaults without changing the member's job profile.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <LuLoaderCircle className="animate-spin text-indigo-500" size={28}/>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members
                      .filter(m => {
                        const q = search.toLowerCase();
                        return !q || m.name?.toLowerCase().includes(q) || m.department?.toLowerCase().includes(q);
                      })
                      .map(m => {
                        const jp   = JP_MAP[m.job_profile] || JP_MAP[m.role] || JP_MAP.employee;
                        const isMe = m.user_id === user?.id;
                        return (
                          <div key={m.user_id}
                            className="card flex flex-col gap-3.5 !p-5">
                            {/* Member info */}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: (jp?.color || '#64748b') + '20' }}>
                                {m.profile_image_url
                                  ? <img src={m.profile_image_url} alt={m.name} className="w-10 h-10 rounded-lg object-cover"/>
                                  : jp?.emoji || '👤'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-extrabold text-slate-800 dark:text-zinc-200 text-xs truncate">
                                  {m.name}
                                  {isMe && <span className="ml-1 text-[9px] text-indigo-605 dark:text-indigo-400 font-bold uppercase">(you)</span>}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wider"
                                  style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
                                  {jp?.emoji} {jp?.label}
                                </span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider border ${
                                m.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-705 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                  : m.status === 'pending_setup'
                                  ? 'bg-amber-50 text-amber-705 border-amber-100 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30'
                                  : 'bg-slate-50 text-slate-600 border-slate-205 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700'
                              }`}>
                                {m.status === 'active' ? '● Active' : m.status === 'pending_setup' ? '◌ Setup Pending' : '○ Inactive'}
                              </span>
                              {m.department && (
                                <span className="text-slate-400 dark:text-zinc-500 font-bold text-[9px] truncate ml-2 uppercase tracking-wider">{m.department}</span>
                              )}
                            </div>

                            {/* CTA */}
                            <button
                              onClick={() => setSelectedMember(m)}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold
                                bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition shadow-[0_1px_2px_rgba(79,70,229,0.15)]"
                            >
                              <LuShieldCheck size={13}/>
                              Manage Access Permissions
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Modal */}
      <InviteEmployee
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={() => { loadInvitations(); setTab(1); }}
        teams={teams}
      />

      {/* Per-User Access Control Panel */}
      {selectedMember && (
        <AccessControlPanel
          member={selectedMember}
          workspaceId={workspace?.id}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </DashboardLayout>
  );
};

const ActionBtn = ({ title, onClick, loading, icon, cls }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={loading}
    className={`p-1.5 rounded-lg transition cursor-pointer ${cls} ${loading ? 'opacity-40 cursor-wait' : ''}`}
  >
    {loading ? <LuLoaderCircle size={13} className="animate-spin"/> : icon}
  </button>
);

const UserRow = React.memo(({ m, user, jp, isMe, handleChangeRole, setSelectedMember, handleDeactivate, JOB_PROFILES, onlineUsers = {} }) => {
  const userStatus = onlineUsers[m.user_id];
  return (
    <tr className="dark:border-zinc-800/80 hover:dark:bg-zinc-900/10">
      {/* Avatar + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            {m.profile_image_url ? (
              <img src={m.profile_image_url} alt={m.name}
                className={`w-8 h-8 rounded-lg object-cover ${
                  userStatus === 'active'
                    ? 'ring-2 ring-emerald-500 ring-offset-2'
                    : userStatus === 'idle'
                    ? 'ring-2 ring-amber-500 ring-offset-2'
                    : ''
                }`}/>
            ) : (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${
                userStatus === 'active'
                  ? 'ring-2 ring-emerald-500 ring-offset-2'
                  : userStatus === 'idle'
                  ? 'ring-2 ring-amber-500 ring-offset-2'
                  : ''
              }`}
                style={{ background: jp?.color + '22' }}>
                {jp?.emoji || '👤'}
              </div>
            )}
            {userStatus && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#151518] ${
                userStatus === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            )}
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-zinc-200 leading-tight text-xs">
              {m.name} {isMe && <span className="text-[9px] text-indigo-605 dark:text-indigo-400 font-extrabold uppercase">(you)</span>}
            </p>
            {m.email && <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">{m.email}</p>}
          </div>
        </div>
      </td>
      {/* Job profile */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider"
          style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
          {jp?.emoji} {jp?.label || m.job_profile}
        </span>
      </td>
      {/* Department */}
      <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
        {m.department || <span className="text-slate-300 dark:text-zinc-700">—</span>}
      </td>
      {/* Teams */}
      <td className="px-4 py-3">
        {m.team_names?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {m.team_names.map(t => (
              <span key={t} className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50/50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100/30 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">
                {t}
              </span>
            ))}
          </div>
        ) : <span className="text-slate-350 dark:text-zinc-700 text-xs font-bold">—</span>}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
          m.status === 'active'
            ? 'bg-emerald-50 text-emerald-750 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
            : m.status === 'pending_setup'
            ? 'bg-amber-50 text-amber-750 border-amber-100 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30'
            : 'bg-slate-50 text-slate-600 border-slate-205 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700'
        }`}>
          {m.status === 'active' ? '● Active' : m.status === 'pending_setup' ? '◌ Pending' : '○ Inactive'}
        </span>
      </td>
      {/* Role select */}
      <td className="px-4 py-3">
        {isMe ? (
          <span className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">Admin</span>
        ) : (
          <div className="relative inline-block">
            <select
              value={m.role}
              onChange={e => handleChangeRole(m.user_id, e.target.value)}
              className="field-input px-2.5 pr-6 py-1 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 cursor-pointer text-xs h-auto w-auto min-w-[110px] appearance-none"
            >
              {JOB_PROFILES.map(j => (
                <option key={j.value} value={j.value} className="dark:bg-zinc-900">{j.emoji} {j.label}</option>
              ))}
              <option value="viewer" className="dark:bg-zinc-900">👁 Viewer</option>
            </select>
            <LuChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
        )}
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {/* Manage Access button — opens per-user permission panel */}
          <button
            onClick={() => setSelectedMember(m)}
            title="Manage Access Permissions"
            className="text-indigo-500 hover:text-indigo-755 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 p-1.5 rounded-lg transition cursor-pointer"
          >
            <LuShieldCheck size={15}/>
          </button>
          {!isMe && (
            <button
              onClick={() => handleDeactivate(m.user_id)}
              title="Deactivate member"
              className="text-red-400 hover:text-red-655 hover:bg-red-50/50 dark:hover:bg-rose-955/20 p-1.5 rounded-lg transition cursor-pointer"
            >
              <LuUserX size={15}/>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
UserRow.displayName = 'UserRow';

const InviteRow = React.memo(({ inv, jp, badge, busy, handleResend, handleCopyLink, handleRevoke }) => {
  return (
    <tr className="dark:border-zinc-800/80 hover:dark:bg-zinc-900/10">
      {/* Invitee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: (jp?.color || '#64748b') + '22' }}>
            {jp?.emoji}
          </div>
          <div>
            {inv.fullName && (
              <p className="font-bold text-slate-800 dark:text-zinc-200 leading-tight text-xs">{inv.fullName}</p>
            )}
            <p className="text-slate-400 dark:text-zinc-500 text-[10px] font-semibold">{inv.email}</p>
            <p className="text-slate-400 dark:text-zinc-550 text-[9px] font-bold uppercase tracking-wider">Invited by {inv.inviterName}</p>
          </div>
        </div>
      </td>
      {/* Job profile */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
          {jp?.emoji} {jp?.label}
        </span>
      </td>
      {/* Dept / Team */}
      <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
        {inv.department && <p>{inv.department}</p>}
        {inv.teamName && <p className="text-indigo-500 dark:text-indigo-400">👥 {inv.teamName}</p>}
        {!inv.department && !inv.teamName && <span className="text-slate-350 dark:text-zinc-700">—</span>}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-[9px] font-extrabold px-2 py-0.5 border uppercase tracking-wider rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </td>
      {/* Sent */}
      <td className="px-4 py-3 text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
        {new Date(inv.createdAt).toLocaleDateString()}
      </td>
      {/* Expires */}
      <td className="px-4 py-3 text-xs">
        {inv.isAccepted ? (
          <span className="text-emerald-500 flex items-center gap-1 font-bold text-xs">
            <LuCircleCheck size={12}/> Done
          </span>
        ) : (
          <span className={inv.isExpired ? 'text-red-400 font-bold' : 'text-slate-400 dark:text-zinc-500 font-bold text-[10px] uppercase tracking-wider'}>
            {new Date(inv.expiresAt).toLocaleDateString()}
          </span>
        )}
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {inv.isPending && (
            <>
              <ActionBtn
                title="Resend email"
                onClick={() => handleResend(inv.id)}
                loading={busy}
                icon={<LuRefreshCw size={13}/>}
                cls="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
              />
              <ActionBtn
                title="Copy setup link"
                onClick={() => handleCopyLink(inv.id)}
                icon={<LuCopy size={13}/>}
                cls="text-slate-400 dark:text-zinc-500 hover:bg-slate-100/50 dark:hover:bg-zinc-800/30"
              />
              <ActionBtn
                title="Revoke invitation"
                onClick={() => handleRevoke(inv.id)}
                loading={busy}
                icon={<LuCircleX size={13}/>}
                cls="text-red-400 dark:text-rose-455 hover:bg-red-50/50 dark:hover:bg-rose-955/20"
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
});
InviteRow.displayName = 'InviteRow';

export default ManageUsers;
