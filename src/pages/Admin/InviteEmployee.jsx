import React, { useState, useContext } from 'react';
import { supabase } from '../../utils/supabaseClient';
import {
  sendEmployeeInvite,
} from '../../services/invitationService';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import toast from 'react-hot-toast';
import {
  LuX, LuMail, LuUser, LuBriefcase, LuBuilding2,
  LuUsers, LuMessageSquare, LuLoaderCircle, LuSend, LuChevronDown,
} from 'react-icons/lu';

// ── Constants ─────────────────────────────────────────────────────────────────
export const JOB_PROFILES = [
  { value: 'company_admin', label: 'Company Admin',  emoji: '👑', color: '#6366f1', desc: 'Full workspace administrator' },
  { value: 'manager',       label: 'Manager',        emoji: '👔', color: '#8b5cf6', desc: 'Team lead — manages tasks & members' },
  { value: 'employee',      label: 'Employee',       emoji: '👤', color: '#64748b', desc: 'General team member' },
  { value: 'intern',        label: 'Intern',         emoji: '🎓', color: '#10b981', desc: 'Intern with restricted access' },
];

// ─────────────────────────────────────────────────────────────────────────────
// InviteEmployee Modal
// ─────────────────────────────────────────────────────────────────────────────
const InviteEmployee = ({ open, onClose, onSuccess, teams = [] }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const [email,    setEmail]    = useState('');
  const [fullName, setFullName] = useState('');
  const [jobProfile, setJobProfile] = useState('employee');
  const [department, setDepartment] = useState('');
  const [teamId,   setTeamId]   = useState('');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [successData, setSuccessData] = useState(null); // { setupLink, tempPassword, email }

  const selectedJP = JOB_PROFILES.find(j => j.value === jobProfile);

  const reset = () => {
    setEmail(''); setFullName(''); setJobProfile('employee');
    setDepartment(''); setTeamId(''); setMessage(''); setError('');
    setSuccessData(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return setError('Enter a valid email address.');
    }
    if (!jobProfile) return setError('Select a job profile.');

    setLoading(true);
    try {
      const result = await sendEmployeeInvite({
        workspaceId:     workspace.id,
        workspaceName:   workspace.name,
        email:           emailTrimmed,
        fullName:        fullName.trim() || '',
        jobProfile,
        department:      department.trim() || '',
        teamId:          teamId || null,
        teamName:        teams.find(t => t.id === teamId)?.name || '',
        personalMessage: message.trim() || '',
        invitedByName:   user?.name || 'Your Admin',
      });

      setSuccessData({
        email:       emailTrimmed,
        setupLink:   result.setupLink,
        tempPassword: result.tempPassword,
        emailSent:   result.emailSent,
        employeeId:   result.employeeId,
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successData) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#161619] border border-slate-205 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 animate-fade-in font-sans">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg mx-auto mb-3 border border-emerald-100 dark:border-emerald-900/30 font-bold">✓</div>
              <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-base">Invitation Created!</h3>
              <p className="text-slate-450 dark:text-zinc-450 text-xs mt-1.5 font-semibold">
                Share the credentials below with <span className="text-slate-800 dark:text-zinc-100 font-bold">{successData.email}</span>
              </p>
              {!successData.emailSent && (
                <p className="text-amber-705 dark:text-amber-400 text-xs mt-3 bg-amber-50 dark:bg-amber-955/15 border border-amber-200/50 dark:border-amber-900/30 rounded-xl px-3 py-2 font-bold uppercase tracking-wider">
                  ⚠️ Direct email sending pending configuration. Share setup link manually below.
                </p>
              )}
            </div>

            {/* Employee ID */}
            {successData.employeeId && (
              <div className="mb-4">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">Employee ID</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly value={successData.employeeId}
                    className="flex-1 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-indigo-650 dark:text-indigo-400 font-extrabold select-all outline-none"
                    onClick={e => e.target.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(successData.employeeId); toast.success('Employee ID copied!'); }}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Setup link */}
            <div className="mb-4">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">Setup Link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly value={successData.setupLink}
                  className="flex-1 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-zinc-350 font-semibold select-all outline-none"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(successData.setupLink); toast.success('Link copied!'); }}
                  className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Temp password */}
            <div className="mb-6">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">Temporary Password</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly value={successData.tempPassword}
                  className="flex-1 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-amber-750 dark:text-amber-400 font-bold select-all outline-none"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(successData.tempPassword); toast.success('Password copied!'); }}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <p className="text-slate-400 dark:text-zinc-500 text-[10px] mt-1.5 font-medium">Invited user will use this password to sign in and set up their profile.</p>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-650 hover:opacity-90 text-white font-bold rounded-xl transition text-xs cursor-pointer shadow-md shadow-indigo-150/20"
            >
              Close Overlay
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-[#161619] border border-slate-205 dark:border-zinc-800/80 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto animate-fade-in font-sans">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800/80">
            <div>
              <h3 className="text-slate-900 dark:text-zinc-200 font-extrabold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <LuUser className="text-indigo-500"/> Invite Workspace Member
              </h3>
              <p className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase font-bold mt-1 tracking-wider">
                Generate dynamic setup link and login credentials
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-650 transition cursor-pointer"
            >
              <LuX size={16} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

            {error && (
              <div className="text-xs text-rose-600 font-extrabold bg-rose-50 dark:bg-rose-955/15 border border-rose-200/40 p-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Email + Name row */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Work Email *" icon={<LuMail size={12}/>}>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#121215] transition-all"
                  required
                />
              </Field>
              <Field label="Full Name" icon={<LuUser size={12}/>}>
                <input
                  id="invite-name"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#121215] transition-all"
                />
              </Field>
            </div>

            {/* Job Profile */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1 mb-2">
                <LuBriefcase size={12}/> Job Profile Selection *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {JOB_PROFILES.filter(jp => jp.value !== 'company_admin').map(jp => (
                  <button
                    key={jp.value}
                    type="button"
                    onClick={() => setJobProfile(jp.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      jobProfile === jp.value
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md shadow-indigo-150/10'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-25 dark:bg-[#121215] hover:border-slate-350 dark:hover:border-zinc-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl">{jp.emoji}</span>
                    <span className={`text-[10px] font-extrabold leading-tight ${jobProfile === jp.value ? 'text-indigo-650 dark:text-indigo-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                      {jp.label}
                    </span>
                  </button>
                ))}
              </div>
              {selectedJP && (
                <p className="text-slate-400 dark:text-zinc-500 text-[10px] mt-2 ml-1 font-semibold">
                  {selectedJP.emoji} Scope: {selectedJP.desc}
                </p>
              )}
            </div>

            {/* Department + Team row */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Department" icon={<LuBuilding2 size={12}/>}>
                <input
                  id="invite-dept"
                  type="text"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#121215] transition-all"
                />
              </Field>
              <Field label="Assign to Team" icon={<LuUsers size={12}/>}>
                <div className="relative">
                  <select
                    id="invite-team"
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-650 dark:text-zinc-300 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#121215] transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="dark:bg-zinc-900">No team assignment</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id} className="dark:bg-zinc-900">{t.name}</option>
                    ))}
                  </select>
                  <LuChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                </div>
              </Field>
            </div>

            {/* Personal message */}
            <Field label="Personal Message (optional)" icon={<LuMessageSquare size={12}/>}>
              <textarea
                id="invite-msg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Include a welcome note in their invite credentials summary..."
                rows={3}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#121215] transition-all resize-none"
              />
            </Field>

            {/* Preview badge */}
            <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-150/30 dark:border-indigo-900/30 p-3.5">
              <p className="text-indigo-650 dark:text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1">
                <LuMail size={12}/> Email Preview
              </p>
              <p className="text-slate-500 dark:text-zinc-400 text-[11px] font-semibold leading-relaxed">
                <strong className="text-slate-805 dark:text-zinc-200">{email || 'employee@company.com'}</strong> will receive a
                Brevo email from <strong className="text-slate-805 dark:text-zinc-200">{workspace?.name}</strong> with their
                role (<strong className="text-indigo-650 dark:text-indigo-400">{selectedJP?.emoji} {selectedJP?.label}</strong>),
                temporary password, and a setup link valid for 7 days.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose} disabled={loading}
                className="card-btn px-5 py-2.5 cursor-pointer text-xs">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="card-btn-fill flex-1 flex items-center justify-center gap-2 cursor-pointer text-xs font-bold transition">
                {loading ? <LuLoaderCircle className="animate-spin" size={15}/> : <LuSend size={15}/>}
                {loading ? 'Sending invite...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

const Field = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450 dark:text-zinc-500 flex items-center gap-1 mb-1">
      {icon}{label}
    </label>
    {children}
  </div>
);

export default InviteEmployee;
