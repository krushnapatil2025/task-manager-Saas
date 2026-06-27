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

const ROLE_OPTIONS = ['employee', 'manager', 'intern', 'company_admin'];

const ManageInvitations = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [invitations, setInvitations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [email,       setEmail]       = useState('');
  const [role,        setRole]        = useState('employee');
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
      setRole('employee');
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
      <div className="mt-5 max-w-3xl animate-fade-in font-sans">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
            👥 Team Invitations
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
            Invite teammates to join <strong className="text-indigo-650 dark:text-indigo-400">{workspace?.name}</strong> via email link.
          </p>
        </div>

        {/* ── Invite form ── */}
        <div className="card mb-6">
          <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-555 uppercase tracking-wider mb-4 flex items-center gap-2">
            <LuUserPlus className="text-indigo-500" size={14} /> Invite a New Member
          </h3>

          <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <LuMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-sm" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="field-input py-2.5 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 cursor-pointer h-auto w-auto min-w-[120px]"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} className="capitalize dark:bg-zinc-900">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={sending}
              className="card-btn-fill flex items-center justify-center gap-2 text-xs font-bold transition disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {sending ? <LuLoaderCircle className="animate-spin" /> : <LuUserPlus size={14} />}
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {formError && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1 font-semibold">
              <LuCircleAlert className="text-xs" /> {formError}
            </p>
          )}
        </div>

        {/* ── Invitation list ── */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-405 dark:text-zinc-555 uppercase tracking-wider">Sent Invitations</h3>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{invitations.length} total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LuLoaderCircle className="text-indigo-500 text-2xl animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-zinc-550 text-xs font-bold uppercase tracking-wider">
              No invitations sent yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-105 dark:divide-zinc-800/80">
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
    ? { label: 'Accepted',  icon: <LuCircleCheck size={11} />, cls: 'text-emerald-705 bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30' }
    : inv.isExpired
      ? { label: 'Expired',  icon: <LuCircleAlert size={11} />, cls: 'text-rose-700 bg-rose-50 border-rose-200/50 dark:bg-rose-955/15 dark:text-rose-455 dark:border-rose-900/30' }
      : { label: 'Pending',  icon: <LuClock size={11} />,       cls: 'text-amber-705 bg-amber-50 border-amber-205 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30' };

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 transition group">
      {/* Avatar initial */}
      <div className="w-8 h-8 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-650 dark:text-indigo-400 text-xs font-extrabold">{inv.email[0].toUpperCase()}</span>
      </div>

      {/* Email + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-805 dark:text-zinc-200 truncate">{inv.email}</p>
        <p className="text-[9px] text-slate-400 dark:text-zinc-550 mt-1 font-bold uppercase tracking-wider">
          <span className="text-indigo-650 dark:text-indigo-400">{inv.role}</span>
          {' · '}
          Inviter: {inv.inviterName}
          {' · '}
          {moment(inv.createdAt).fromNow()}
        </p>
      </div>

      {/* Status badge */}
      <span className={`flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-0.5 rounded border uppercase tracking-wider ${badge.cls}`}>
        {badge.icon}
        {badge.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {inv.isPending && !inv.acceptedAt && !inv.isExpired && (
          <button
            onClick={onCopy}
            title="Copy invite link"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <LuCopy size={13} />
          </button>
        )}
        {!inv.acceptedAt && (
          <button
            onClick={onRevoke}
            title="Revoke invitation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-650 hover:bg-rose-50/50 dark:hover:bg-[#161619] transition cursor-pointer"
          >
            <LuTrash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
