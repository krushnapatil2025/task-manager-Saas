import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllUsers, 
  setUserSuperAdminStatus, 
  setUserApprovalStatus 
} from '../../services/superAdminService';
import {
  LuUsers, LuSearch, LuLoaderCircle, LuShield, LuUser,
  LuCalendar, LuFilter, LuLock, LuLockOpen, LuUserCheck, LuUserX, LuDownload
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AllUsers — Platform-wide user list & access control management for Super Admins
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  admin:  'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
  member: 'text-slate-400 bg-slate-700/30 border-slate-650',
};

const STATUS_BADGE = {
  pending:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  approved:   'text-green-400 bg-green-500/10 border-green-500/20',
  rejected:   'text-rose-400 bg-rose-500/10 border-rose-500/20',
  restricted: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const AllUsers = () => {
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState(null); // 'admin' | 'member' | 'superadmin' | null
  const [statusFilter,  setStatusFilter]  = useState(null); // 'approved' | 'restricted' | 'pending' | null
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllUsers(search);
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load platform users');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleToggleSuperAdmin = async (user) => {
    const nextSA = !user.is_super_admin;
    if (!window.confirm(`Are you sure you want to ${nextSA ? 'GRANT' : 'REVOKE'} Super Admin privileges for "${user.name}"?`)) return;
    
    setActionLoading(true);
    try {
      await setUserSuperAdminStatus(user.id, nextSA);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_super_admin: nextSA } : u));
      toast.success(`Super Admin status updated.`);
    } catch (err) {
      toast.error('Failed to update privileges: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSuspension = async (user) => {
    const isCurrentlySuspended = user.account_approval_status === 'restricted';
    const targetStatus = isCurrentlySuspended ? 'approved' : 'restricted';
    const actionLabel = isCurrentlySuspended ? 'Restore' : 'Suspend';

    if (!window.confirm(`${actionLabel} user account for "${user.name}"?`)) return;

    setActionLoading(true);
    try {
      await setUserApprovalStatus(user.id, targetStatus);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, account_approval_status: targetStatus } : u));
      toast.success(`User successfully ${isCurrentlySuspended ? 'restored' : 'suspended'}.`);
    } catch (err) {
      toast.error(`Failed to ${actionLabel.toLowerCase()}: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Perform client-side role filtering (role matches, or is_super_admin checks)
  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'superadmin') return u.is_super_admin;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && (u.account_approval_status || 'approved') !== statusFilter) return false;
    return true;
  });

  const stats = {
    total:      users.length,
    admins:     users.filter((u) => u.role === 'admin').length,
    superAdmins: users.filter((u) => u.is_super_admin).length,
    suspended:  users.filter((u) => u.account_approval_status === 'restricted').length,
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) { toast.error('No users to export.'); return; }
    const headers = ['Name', 'Role', 'Is Super Admin', 'Account Status', 'Joined Date'];
    const rows = filteredUsers.map(u => [
      u.name || '',
      u.role || 'member',
      u.is_super_admin ? 'Yes' : 'No',
      u.account_approval_status || 'approved',
      moment(u.created_at).format('YYYY-MM-DD'),
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `platform_users_${moment().format('YYYYMMDD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Users CSV exported!');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuUsers className="text-orange-500" /> Platform Users
          </h1>
          <p className="text-slate-400 text-xs mt-1">Audit permissions, toggle superadmin credentials, and suspend platform access</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-800 transition cursor-pointer flex-shrink-0"
        >
          <LuDownload size={13} /> Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', value: stats.total, color: 'from-blue-500 to-indigo-600', icon: LuUsers },
          { label: 'Workspace Admins', value: stats.admins, color: 'from-purple-500 to-indigo-600', icon: LuUser },
          { label: 'Super Admins', value: stats.superAdmins, color: 'from-orange-500 to-red-600', icon: LuShield },
          { label: 'Suspended', value: stats.suspended, color: 'from-rose-500 to-red-700', icon: LuUserX },
        ].map((s, idx) => (
          <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
              <s.icon className="text-slate-300 text-sm" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-550">{s.label}</p>
              <p className="text-xl font-black text-white mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Role</span>
            {[
              { value: null, label: 'All' },
              { value: 'admin', label: 'Admins' },
              { value: 'superadmin', label: 'Super' }
            ].map((r) => (
              <button
                key={r.value ?? 'all'}
                onClick={() => setRoleFilter(r.value)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition capitalize cursor-pointer ${
                  roleFilter === r.value
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Access</span>
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
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20">
            <LuUsers className="text-slate-700 text-4xl mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No platform users matched your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Role Badge</th>
                  <th className="px-6 py-4">System Flags</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40 transition group">
                    
                    {/* User profile details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <span className="text-white text-xs font-black">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{u.name || 'Anonymous User'}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{u.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${ROLE_BADGE[u.role] || ROLE_BADGE.member}`}>
                        {u.role || 'member'}
                      </span>
                    </td>

                    {/* System Flags */}
                    <td className="px-6 py-4">
                      {u.is_super_admin ? (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full shadow-sm">
                          <LuShield className="text-[10px]" /> SUPER ADMIN
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-semibold">—</span>
                      )}
                    </td>

                    {/* Account Approval/Suspension Status */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${STATUS_BADGE[u.account_approval_status || 'approved']}`}>
                        {u.account_approval_status === 'restricted' ? 'Suspended' : u.account_approval_status || 'Active'}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <LuCalendar className="text-[11px] text-slate-600" />
                        {moment(u.created_at).format('DD MMM YYYY')}
                      </div>
                    </td>

                    {/* Controls */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Grant/Revoke Super Admin */}
                        <button
                          onClick={() => handleToggleSuperAdmin(u)}
                          disabled={actionLoading}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            u.is_super_admin
                              ? 'text-rose-400 bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/15'
                              : 'text-indigo-400 bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/15'
                          }`}
                          title={u.is_super_admin ? 'Revoke Super Admin' : 'Grant Super Admin'}
                        >
                          <LuShield size={14} />
                        </button>

                        {/* Suspend/Restore Account */}
                        <button
                          onClick={() => handleToggleSuspension(u)}
                          disabled={actionLoading}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            u.account_approval_status === 'restricted'
                              ? 'text-green-400 bg-green-500/5 border-green-500/20 hover:bg-green-500/15'
                              : 'text-amber-400 bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/15'
                          }`}
                          title={u.account_approval_status === 'restricted' ? 'Restore Access' : 'Suspend Account'}
                        >
                          {u.account_approval_status === 'restricted' ? <LuLockOpen size={14} /> : <LuLock size={14} />}
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

export default AllUsers;
