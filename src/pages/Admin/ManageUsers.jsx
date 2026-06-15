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
  if (status === 'accepted') return { label: 'Accepted', cls: 'bg-green-500/15 text-green-300 border-green-400/30' };
  if (status === 'revoked')  return { label: 'Revoked',  cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  if (isExpired)             return { label: 'Expired',  cls: 'bg-red-500/15 text-red-300 border-red-400/30' };
  if (isPending)             return { label: 'Pending',  cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-400/30' };
  return                            { label: status,     cls: 'bg-white/10 text-white/50 border-white/10' };
};

const TABS = ['All Members', 'Pending Invitations', 'All Invitations', 'Access Control'];

// ─────────────────────────────────────────────────────────────────────────────
const ManageUsers = () => {
  const { workspace } = useContext(WorkspaceContext);
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

    // ── Try the enriched RPC first ─────────────────────────────────────────
    // Falls through silently if the function hasn't been deployed to Supabase yet.
    // Run supabase/fix_get_workspace_members_full.sql to deploy it permanently.
    try {
      const { data, error } = await supabase.rpc('get_workspace_members_full', {
        p_workspace_id: workspace.id,
      });
      if (!error && Array.isArray(data)) {
        setMembers(data);
        return;
      }
      // error.code 'PGRST202' = RPC not found → fall through silently
    } catch {
      // fall through
    }

    // ── Fallback: direct PostgREST join (always works without the RPC) ─────
    // NOTE:
    //  • 'email' is in auth.users, NOT profiles → excluded from select
    //  • .order() on a related table is not supported by PostgREST → sort client-side
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
      email:             null,   // not available without RPC (auth.users join)
      job_profile:       m.profiles?.job_profile || m.role,
      department:        m.profiles?.department,
      status:            m.profiles?.status || 'active',
      profile_image_url: m.profiles?.profile_image_url,
      employee_id:       m.profiles?.employee_id,
      role:              m.role,
      joined_at:         m.joined_at,
      team_names:        [],
    }));

    // Sort client-side by name (PostgREST can't order by a joined table column)
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
      <div className="mt-5 mb-10">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">User & Role Management</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {workspace?.name} ·{' '}
              <span className="font-medium text-gray-600">{members.length} members</span>
              {pendingInvites.length > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">
                  · {pendingInvites.length} pending invite{pendingInvites.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn-outline flex items-center gap-1.5 text-sm">
              <LuFileSpreadsheet size={15}/> Export
            </button>
            <button onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <LuUserPlus size={15}/> Invite Employee
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => { setTab(i); setSearch(''); setRoleFilter(''); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                tab === i
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
              {t === 'Pending Invitations' && pendingInvites.length > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingInvites.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder={tab === 0 ? 'Search by name or department…' : 'Search by email or name…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>
          {tab === 0 && (
            <div className="relative">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 bg-white appearance-none"
              >
                <option value="">All Roles</option>
                {JOB_PROFILES.map(j => (
                  <option key={j.value} value={j.value}>{j.emoji} {j.label}</option>
                ))}
              </select>
              <LuChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
          )}
          <button onClick={loadAll} className="btn-outline flex items-center gap-1.5 text-sm px-3">
            <LuRefreshCw size={14}/> Refresh
          </button>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <LuLoaderCircle className="animate-spin text-blue-500" size={28}/>
          </div>
        ) : (
          <>
            {/* ══════════ TAB 0 — All Members ══════════ */}
            {tab === 0 && (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Member</th>
                      <th className="text-left px-4 py-3">Job Profile</th>
                      <th className="text-left px-4 py-3">Department</th>
                      <th className="text-left px-4 py-3">Teams</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          <LuUsers size={32} className="mx-auto mb-2 opacity-30"/>
                          No members found.
                        </td>
                      </tr>
                    ) : filteredMembers.map(m => {
                      const jp = JP_MAP[m.job_profile] || JP_MAP[m.role] || JP_MAP.employee;
                      const isMe = m.user_id === user?.id;
                      return (
                        <tr key={m.user_id} className="hover:bg-gray-50 transition-colors">
                          {/* Avatar + name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {m.profile_image_url ? (
                                <img src={m.profile_image_url} alt={m.name}
                                  className="w-8 h-8 rounded-lg object-cover"/>
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                                  style={{ background: jp?.color + '22' }}>
                                  {jp?.emoji || '👤'}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-800 leading-tight">
                                  {m.name} {isMe && <span className="text-[10px] text-blue-500 font-normal">(you)</span>}
                                </p>
                                {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                              </div>
                            </div>
                          </td>
                          {/* Job profile */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
                              {jp?.emoji} {jp?.label || m.job_profile}
                            </span>
                          </td>
                          {/* Department */}
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {m.department || <span className="text-gray-300">—</span>}
                          </td>
                          {/* Teams */}
                          <td className="px-4 py-3">
                            {m.team_names?.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {m.team_names.map(t => (
                                  <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              m.status === 'active'
                                ? 'bg-green-50 text-green-600 border-green-200'
                                : m.status === 'pending_setup'
                                ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                            }`}>
                              {m.status === 'active' ? '● Active' : m.status === 'pending_setup' ? '◌ Setup Pending' : '○ Inactive'}
                            </span>
                          </td>
                          {/* Role select */}
                          <td className="px-4 py-3">
                            {isMe ? (
                              <span className="text-xs text-gray-400">Admin</span>
                            ) : (
                              <select
                                value={m.role}
                                onChange={e => handleChangeRole(m.user_id, e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-200 bg-white cursor-pointer"
                              >
                                {JOB_PROFILES.map(j => (
                                  <option key={j.value} value={j.value}>{j.emoji} {j.label}</option>
                                ))}
                                <option value="viewer">👁 Viewer</option>
                              </select>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Manage Access button — opens per-user permission panel */}
                              <button
                                onClick={() => setSelectedMember(m)}
                                title="Manage Access Permissions"
                                className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition"
                              >
                                <LuShieldCheck size={15}/>
                              </button>
                              {!isMe && (
                                <button
                                  onClick={() => handleDeactivate(m.user_id)}
                                  title="Deactivate member"
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                                >
                                  <LuUserX size={15}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══════════ TAB 1 & 2 — Invitations ══════════ */}
            {(tab === 1 || tab === 2) && (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Invitee</th>
                      <th className="text-left px-4 py-3">Job Profile</th>
                      <th className="text-left px-4 py-3">Department / Team</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Sent</th>
                      <th className="text-left px-4 py-3">Expires</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredInvites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          <LuMail size={32} className="mx-auto mb-2 opacity-30"/>
                          {tab === 1 ? 'No pending invitations.' : 'No invitations found.'}
                        </td>
                      </tr>
                    ) : filteredInvites.map(inv => {
                      const jp     = JP_MAP[inv.jobProfile] || JP_MAP.employee;
                      const badge  = statusBadge(inv.status, inv.isPending, inv.isExpired);
                      const busy   = actionLoading[inv.id];
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          {/* Invitee */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                style={{ background: (jp?.color || '#64748b') + '22' }}>
                                {jp?.emoji}
                              </div>
                              <div>
                                {inv.fullName && (
                                  <p className="font-semibold text-gray-800 leading-tight text-xs">{inv.fullName}</p>
                                )}
                                <p className="text-gray-500 text-xs">{inv.email}</p>
                                <p className="text-gray-400 text-[10px]">Invited by {inv.inviterName}</p>
                              </div>
                            </div>
                          </td>
                          {/* Job profile */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
                              {jp?.emoji} {jp?.label}
                            </span>
                          </td>
                          {/* Dept / Team */}
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {inv.department && <p>{inv.department}</p>}
                            {inv.teamName   && <p className="text-indigo-500">👥 {inv.teamName}</p>}
                            {!inv.department && !inv.teamName && <span className="text-gray-300">—</span>}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          {/* Sent */}
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          {/* Expires */}
                          <td className="px-4 py-3 text-xs">
                            {inv.isAccepted ? (
                              <span className="text-green-500 flex items-center gap-1">
                                <LuCircleCheck size={12}/> Done
                              </span>
                            ) : (
                              <span className={inv.isExpired ? 'text-red-400' : 'text-gray-400'}>
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
                                    cls="text-blue-500 hover:bg-blue-50"
                                  />
                                  <ActionBtn
                                    title="Copy setup link"
                                    onClick={() => handleCopyLink(inv.id)}
                                    icon={<LuCopy size={13}/>}
                                    cls="text-gray-400 hover:bg-gray-100"
                                  />
                                  <ActionBtn
                                    title="Revoke invitation"
                                    onClick={() => handleRevoke(inv.id)}
                                    loading={busy}
                                    icon={<LuCircleX size={13}/>}
                                    cls="text-red-400 hover:bg-red-50"
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* ══════════ TAB 3 — Access Control ══════════ */}
            {tab === 3 && (
              <div>
                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                  <LuShield size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-700">Per-User Access Control</p>
                    <p className="text-xs text-indigo-500 mt-0.5">
                      Click <strong>🛡 Manage Access</strong> on any member to open a panel with
                      toggle switches for every permission. Overrides layer on top of the
                      role-based defaults without changing the member's job profile.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <LuLoaderCircle className="animate-spin text-blue-500" size={28}/>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
                            {/* Member info */}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: (jp?.color || '#64748b') + '20' }}>
                                {m.profile_image_url
                                  ? <img src={m.profile_image_url} alt={m.name} className="w-10 h-10 rounded-xl object-cover"/>
                                  : jp?.emoji || '👤'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-sm truncate">
                                  {m.name}
                                  {isMe && <span className="ml-1 text-[10px] text-blue-500">(you)</span>}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                                  style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
                                  {jp?.emoji} {jp?.label}
                                </span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-medium border ${
                                m.status === 'active'
                                  ? 'bg-green-50 text-green-600 border-green-200'
                                  : m.status === 'pending_setup'
                                  ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                                  : 'bg-gray-100 text-gray-400 border-gray-200'
                              }`}>
                                {m.status === 'active' ? '● Active' : m.status === 'pending_setup' ? '◌ Setup Pending' : '○ Inactive'}
                              </span>
                              {m.department && (
                                <span className="text-gray-400 truncate ml-2">{m.department}</span>
                              )}
                            </div>

                            {/* CTA */}
                            <button
                              onClick={() => setSelectedMember(m)}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
                                bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 transition"
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

      <style>{`
        .btn-primary{
          background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:600;
          padding:.45rem 1rem;border-radius:.65rem;border:none;cursor:pointer;transition:opacity .2s;
        }
        .btn-primary:hover{opacity:.9;}
        .btn-outline{
          background:white;color:#374151;font-weight:600;padding:.45rem 1rem;
          border-radius:.65rem;border:1px solid #e5e7eb;cursor:pointer;transition:background .15s;
        }
        .btn-outline:hover{background:#f9fafb;}
      `}</style>
    </DashboardLayout>
  );
};

const ActionBtn = ({ title, onClick, loading, icon, cls }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={loading}
    className={`p-1.5 rounded-lg transition ${cls} ${loading ? 'opacity-40 cursor-wait' : ''}`}
  >
    {loading ? <LuLoaderCircle size={13} className="animate-spin"/> : icon}
  </button>
);

export default ManageUsers;
