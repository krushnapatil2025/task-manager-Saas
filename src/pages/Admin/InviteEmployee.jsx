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
// Props:
//   open         {boolean}
//   onClose      {() => void}
//   onSuccess    {() => void}
//   teams        {Array<{id, name}>}
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

      // Show success screen with setup link for admin to copy
      setSuccessData({
        email:       emailTrimmed,
        setupLink:   result.setupLink,
        tempPassword: result.tempPassword,
        emailSent:   result.emailSent,
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // ── Success screen — shown after invite is created ─────────────────────────
  if (successData) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1035] border border-white/10 rounded-2xl shadow-2xl p-6 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-3xl mx-auto mb-3">✅</div>
              <h3 className="text-white font-bold text-lg">Invitation Created!</h3>
              <p className="text-white/50 text-sm mt-1">
                Share the setup link below with <span className="text-white font-medium">{successData.email}</span>
              </p>
              {!successData.emailSent && (
                <p className="text-amber-400/80 text-xs mt-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                  ⚠️ Email sending requires the Edge Function to be deployed. Share the link manually.
                </p>
              )}
            </div>

            {/* Setup link */}
            <div className="mb-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5">Setup Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly value={successData.setupLink}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono select-all"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(successData.setupLink); toast.success('Link copied!'); }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Temp password */}
            <div className="mb-6">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5">Temporary Password</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly value={successData.tempPassword}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono font-bold select-all tracking-wider"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(successData.tempPassword); toast.success('Password copied!'); }}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition flex-shrink-0"
                >
                  Copy
                </button>
              </div>
              <p className="text-white/30 text-xs mt-1.5">Employee uses this to first log in. They'll be prompted to change it.</p>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition text-sm"
            >
              Done
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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#1a1035] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h3 className="text-white font-bold text-lg">Invite Employee</h3>
              <p className="text-white/50 text-xs mt-0.5">
                Creates an invitation — share the setup link with the employee
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              <LuX size={16} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

            {error && (
              <div className="text-red-300 text-xs bg-red-500/15 border border-red-400/30 rounded-xl px-3 py-2">
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
                  className="inp"
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
                  className="inp"
                />
              </Field>
            </div>

            {/* Job Profile */}
            <div>
              <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-2">
                <LuBriefcase size={12}/> Job Profile *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {JOB_PROFILES.filter(jp => jp.value !== 'company_admin').map(jp => (
                  <button
                    key={jp.value}
                    type="button"
                    onClick={() => setJobProfile(jp.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                      jobProfile === jp.value
                        ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/20'
                        : 'border-white/10 bg-white/3 hover:border-white/25 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl">{jp.emoji}</span>
                    <span className={`text-[10px] font-semibold leading-tight ${jobProfile === jp.value ? 'text-indigo-300' : 'text-white/60'}`}>
                      {jp.label}
                    </span>
                  </button>
                ))}
              </div>
              {selectedJP && (
                <p className="text-white/40 text-[10px] mt-1.5 ml-1">
                  {selectedJP.emoji} {selectedJP.desc}
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
                  className="inp"
                />
              </Field>
              <Field label="Assign to Team" icon={<LuUsers size={12}/>}>
                <div className="relative">
                  <select
                    id="invite-team"
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    className="inp appearance-none pr-7"
                  >
                    <option value="" className="bg-gray-900">No team</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id} className="bg-gray-900">{t.name}</option>
                    ))}
                  </select>
                  <LuChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"/>
                </div>
              </Field>
            </div>

            {/* Personal message */}
            <Field label="Personal Message (optional)" icon={<LuMessageSquare size={12}/>}>
              <textarea
                id="invite-msg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a welcome note that will appear in their invite email…"
                rows={3}
                className="inp resize-none"
              />
            </Field>

            {/* Preview badge */}
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-400/20 p-3">
              <p className="text-indigo-300 text-xs font-medium mb-1">📧 Email preview</p>
              <p className="text-white/50 text-xs leading-relaxed">
                <strong className="text-white/70">{email || 'employee@company.com'}</strong> will receive a
                Brevo email from <strong className="text-white/70">{workspace?.name}</strong> with their
                role (<strong className="text-indigo-300">{selectedJP?.emoji} {selectedJP?.label}</strong>),
                temporary password, and a setup link valid for 7 days.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose} disabled={loading}
                className="btn-ghost flex-shrink-0 px-5">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <LuLoaderCircle className="animate-spin" size={15}/> : <LuSend size={15}/>}
                {loading ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .inp {
          width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
          border-radius:0.65rem;padding:0.45rem 0.65rem;color:white;font-size:0.8rem;outline:none;
          transition:border-color .2s;
        }
        .inp::placeholder{color:rgba(255,255,255,.28);}
        .inp:focus{border-color:rgba(99,102,241,.6);}
        .inp option{background:#1a1035;}
        .btn-primary{
          background:linear-gradient(to right,#4f46e5,#7c3aed);color:white;font-weight:600;
          font-size:.875rem;padding:.55rem 1.1rem;border-radius:.65rem;transition:opacity .2s;
          cursor:pointer;border:none;
        }
        .btn-primary:hover{opacity:.9;} .btn-primary:disabled{opacity:.55;cursor:not-allowed;}
        .btn-ghost{
          background:rgba(255,255,255,.06);color:rgba(255,255,255,.65);font-weight:600;
          font-size:.875rem;padding:.55rem 1rem;border-radius:.65rem;
          border:1px solid rgba(255,255,255,.1);transition:background .2s;cursor:pointer;
        }
        .btn-ghost:hover{background:rgba(255,255,255,.1);}
      `}</style>
    </>
  );
};

const Field = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-white/60 font-medium flex items-center gap-1">
      {icon}{label}
    </label>
    {children}
  </div>
);

export default InviteEmployee;
