import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsers } from '../../services/superAdminService';
import {
  LuUsers, LuSearch, LuLoaderCircle, LuShield, LuUser,
  LuCalendar,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AllUsers — platform-wide user list for Super Admins
// Route: /super-admin/users
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  admin:  'text-blue-400  bg-blue-500/15  border-blue-500/30',
  member: 'text-slate-400 bg-slate-700/40 border-slate-600',
};

const AllUsers = () => {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await getAllUsers(search));
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total:      users.length,
    admins:     users.filter((u) => u.role === 'admin').length,
    superAdmins: users.filter((u) => u.is_super_admin).length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white">All Users</h1>
          <p className="text-slate-400 text-sm mt-1">
            {stats.total} users · {stats.admins} admins · {stats.superAdmins} super admins
          </p>
        </div>
      </div>

      {/* Stat mini-cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total',       value: stats.total,       color: 'from-blue-500 to-blue-700',    icon: LuUsers  },
          { label: 'Admins',      value: stats.admins,      color: 'from-purple-500 to-purple-700', icon: LuUser   },
          { label: 'Super Admins', value: stats.superAdmins, color: 'from-red-500 to-orange-500',  icon: LuShield },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <s.icon className="text-white text-sm" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-[11px] text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* User table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LuLoaderCircle className="text-blue-400 text-2xl animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Flags</th>
                  <th className="px-4 py-3.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    {/* Avatar + name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{u.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{u.name || '—'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{u.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize ${ROLE_BADGE[u.role] || ROLE_BADGE.member}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Flags */}
                    <td className="px-4 py-3.5">
                      {u.is_super_admin && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full w-fit">
                          <LuShield className="text-[10px]" /> SUPER ADMIN
                        </span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <LuCalendar className="text-[10px]" />
                        {moment(u.created_at).format('DD MMM YYYY')}
                      </span>
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
