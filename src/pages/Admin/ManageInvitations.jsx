import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import {
  createInvitation, getInvitations, revokeInvitation, buildInviteLink,
} from '../../services/invitationService';
import {
  LuUserPlus, LuCopy, LuTrash2, LuLoaderCircle, LuCircleCheck,
  LuCircleAlert, LuClock, LuMail,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ManageInvitations — admin page to invite users to the workspace
// Route: /admin/invitations
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['member', 'viewer', 'admin'];

const ManageInvitations = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [invitations, setInvitations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [email,       setEmail]       = useState('');
  const [role,        setRole]        = useState('member');
  const [sending,     setSending]     = useState(false);
  const [formError,   setFormError]   = useState('');

  const loadInvitations = async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      setInvitations(await getInvitations(workspace.id));
    } catch (err) {
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvitations(); }, [workspace?.id]);

  // ── Send invitation ───────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim()) return setFormError('Email is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Enter a valid email.');

    setSending(true);
    try {
      const inv = await createInvitation(workspace.id, email.trim(), role, user.id);
      toast.success(`Invitation sent to ${email}!`);
      setEmail('');
      setRole('member');
      setInvitations((prev) => [{ ...inv, isPending: true }, ...prev]);
    } catch (err) {
      setFormError(err.message || 'Failed to send invitation.');
    } finally {
      setSending(false);
    }
  };

  // ── Copy invite link ──────────────────────────────────────────────────────
  const handleCopy = async (token) => {
    const link = buildInviteLink(token);
    await navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  // ── Revoke ────────────────────────────────────────────────────────────────
  const handleRevoke = async (id) => {
    try {
      await revokeInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast.success('Invitation revoked.');
    } catch {
      toast.error('Failed to revoke invitation.');
    }
  };

  return (
    <DashboardLayout activeMenu="Invitations">
      <div className="mt-5 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Team Invitations</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Invite teammates to join <strong className="text-gray-600">{workspace?.name}</strong> via email link.
          </p>
        </div>

        {/* ── Invite form ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <LuUserPlus className="text-blue-500" /> Invite a New Member
          </h3>

          <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <LuMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
            >
              {sending ? <LuLoaderCircle className="animate-spin" /> : <LuUserPlus />}
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {formError && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <LuCircleAlert className="text-xs" /> {formError}
            </p>
          )}
        </div>

        {/* ── Invitation list ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Sent Invitations</h3>
            <span className="text-xs text-gray-400">{invitations.length} total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LuLoaderCircle className="text-blue-500 text-2xl animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No invitations sent yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {invitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  onCopy={() => handleCopy(inv.token)}
                  onRevoke={() => handleRevoke(inv.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ManageInvitations;

// ─────────────────────── Row component ───────────────────────────────────────

const InvitationRow = ({ invitation: inv, onCopy, onRevoke }) => {
  const badge = inv.acceptedAt
    ? { label: 'Accepted',  icon: <LuCircleCheck />, cls: 'text-lime-600  bg-lime-50  border-lime-200'   }
    : inv.isExpired
      ? { label: 'Expired',  icon: <LuCircleAlert />, cls: 'text-red-500   bg-red-50   border-red-200'    }
      : { label: 'Pending',  icon: <LuClock />,       cls: 'text-amber-600 bg-amber-50 border-amber-200'  };

  return (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition group">
      {/* Avatar initial */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">{inv.email[0].toUpperCase()}</span>
      </div>

      {/* Email + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{inv.email}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          <span className="capitalize">{inv.role}</span>
          {' · '}
          Invited by {inv.inviterName}
          {' · '}
          {moment(inv.createdAt).fromNow()}
        </p>
      </div>

      {/* Status badge */}
      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
        {badge.icon}
        {badge.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {inv.isPending && !inv.acceptedAt && !inv.isExpired && (
          <button
            onClick={onCopy}
            title="Copy invite link"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
          >
            <LuCopy className="text-sm" />
          </button>
        )}
        {!inv.acceptedAt && (
          <button
            onClick={onRevoke}
            title="Revoke invitation"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <LuTrash2 className="text-sm" />
          </button>
        )}
      </div>
    </div>
  );
};
