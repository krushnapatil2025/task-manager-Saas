import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { getEmployeeInviteByToken, acceptEmployeeInvitation } from '../../services/invitationService';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import SetupExpired from './SetupExpired';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle, LuCircleCheck, LuShield, LuUser, LuLock,
  LuPhone, LuBriefcase, LuEye, LuEyeOff, LuChevronRight, LuChevronLeft,
  LuCamera, LuPartyPopper,
} from 'react-icons/lu';

// ── password strength ─────────────────────────────────────────────────────────
const getStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8)             s++;
  if (/[A-Z]/.test(pw))          s++;
  if (/[0-9]/.test(pw))          s++;
  if (/[^A-Za-z0-9]/.test(pw))   s++;
  return s;
};
const strengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

// ── Job profile display ───────────────────────────────────────────────────────
const JOB_META = {
  company_admin: { label: 'Company Admin',   emoji: '🏢', color: '#6366f1' },
  manager:       { label: 'Manager',         emoji: '👔', color: '#8b5cf6' },
  employee:      { label: 'Employee',        emoji: '👤', color: '#64748b' },
  intern:        { label: 'Intern',         emoji: '🎓', color: '#10b981' },
};

const STEPS = ['Welcome', 'Password', 'Profile'];

// ─────────────────────────────────────────────────────────────────────────────
const SetupAccount = () => {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { updateUser }  = useContext(UserContext);
  const { refreshWorkspace } = useContext(WorkspaceContext);
  const token           = searchParams.get('token');

  // Page state
  const [pageState, setPageState]   = useState('loading'); // loading | valid | invalid | accepted
  const [invite,    setInvite]      = useState(null);

  // Wizard state
  const [step,       setStep]       = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);

  // Step 1 — already pre-filled from invite
  // Step 2 — password
  const [tempPw,     setTempPw]     = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showTmp,    setShowTmp]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);

  // Step 3 — profile extras
  const [phone,      setPhone]      = useState('');
  const [bio,        setBio]        = useState('');
  const [empId,      setEmpId]      = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // ── Load & validate invitation on mount ───────────────────────────────────
  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    (async () => {
      try {
        const inv = await getEmployeeInviteByToken(token);
        if (!inv)             { setPageState('invalid');  return; }
        if (inv.isAccepted)   { setPageState('accepted'); return; }
        if (inv.isExpired)    { setPageState('invalid');  return; }

        setInvite(inv);
        setPageState('valid');
      } catch {
        setPageState('invalid');
      }
    })();
  }, [token]);

  // ── Avatar preview ────────────────────────────────────────────────────────
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Step validators ───────────────────────────────────────────────────────
  const validateStep = () => {
    setError('');
    if (step === 1) {
      if (!tempPw)                       return setError('Enter your temporary password.'), false;
      if (invite?.tempPassword && tempPw !== invite.tempPassword)
                                         return setError('Temporary password is incorrect. Please check your invite email.'), false;
      if (newPw.length < 8)              return setError('New password must be at least 8 characters.'), false;
      if (newPw !== confirmPw)           return setError('Passwords do not match.'), false;
      if (newPw === tempPw)              return setError('Choose a different password from your temporary one.'), false;
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) setStep((s) => s + 1); };
  const handleBack = () => { setError(''); setStep((s) => s - 1); };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 2) {
      if (validateStep()) setStep((s) => s + 1);
      return;
    }
    setError('');
    setLoading(true);

    try {
      // ── 0. Clean up any failed/half-completed signup for this email ─────
      // This handles cases where the user exists in auth.users but never
      // successfully joined the workspace (e.g. they closed the browser
      // during a previous attempt, or the invitation was resent).
      try {
        await supabase.rpc('cleanup_failed_signup', { p_token: token });
      } catch (rpcErr) {
        // Fall through silently if the RPC function hasn't been deployed yet.
        console.warn('cleanup_failed_signup RPC not deployed:', rpcErr.message);
      }

      // ── 1. Create auth account ───────────────────────────────────────────
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email:    invite.email,
        password: newPw,
        options: {
          data: {
            name:        invite.fullName || '',
            job_profile: invite.jobProfile,
          },
        },
      });

      // Detect if the email is already registered.
      // We check for specific error codes or message patterns.
      // We do NOT check generic 422 or 400 status codes, because those are also returned
      // for password strength or formatting validation errors (e.g. weak_password).
      const alreadyRegistered =
        signUpErr?.code === 'email_exists' ||
        signUpErr?.message?.toLowerCase().includes('already registered') ||
        signUpErr?.message?.toLowerCase().includes('already exists') ||
        signUpErr?.message?.toLowerCase().includes('email_exists');

      if (signUpErr && !alreadyRegistered) throw signUpErr;

      // ── 2. Sign in to obtain a live session ─────────────────────────────
      let signInData = null;
      let signInErr = null;

      // Try signing in with the chosen new password
      const res = await supabase.auth.signInWithPassword({
        email:    invite.email,
        password: newPw,
      });
      signInData = res.data;
      signInErr = res.error;

      // If it failed with invalid credentials and the account is already registered,
      // it is highly likely the account was pre-created in auth.users using the temporary password.
      // Let's try signing in with the temporary password.
      if (signInErr && alreadyRegistered && tempPw) {
        const tempRes = await supabase.auth.signInWithPassword({
          email:    invite.email,
          password: tempPw,
        });

        if (!tempRes.error) {
          // Success! Now update their password to the chosen new password.
          const { error: updatePwErr } = await supabase.auth.updateUser({
            password: newPw,
          });
          if (updatePwErr) {
            signInErr = updatePwErr;
          } else {
            signInData = tempRes.data;
            signInErr = null;
          }
        }
      }

      if (signInErr) {
        if (alreadyRegistered) {
          // The account exists but neither the new password nor the temporary password matched.
          throw new Error(
            `Your account is already registered. If you have already set it up, please log in ` +
            `on the login page. (Details: ${signInErr.message})`
          );
        }
        throw new Error('Account created but sign-in failed: ' + signInErr.message);
      }

      const sessionUser = signInData?.user ?? signUpData?.user;
      if (!sessionUser) {
        throw new Error('Could not create account. Please contact your company admin.');
      }

      // ── 3. Upload avatar (optional) ──────────────────────────────────────
      let avatarUrl = null;
      if (avatarFile && sessionUser.id) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${sessionUser.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('task-files')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('task-files').getPublicUrl(path);
          avatarUrl = urlData?.publicUrl || null;
        }
      }

      // ── 4. Update profile row (using upsert in case trigger failed to insert) ─
      const profileUpdate = {
        id:              sessionUser.id,
        name:            invite.fullName || invite.email.split('@')[0],
        phone:           phone || null,
        bio:             bio   || null,
        employee_id:     empId || null,
        setup_completed: true,
        status:          'active',
        job_profile:     invite.jobProfile,
      };
      if (avatarUrl) profileUpdate.profile_image_url = avatarUrl;

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(profileUpdate, { onConflict: 'id' });

      if (profileErr) throw profileErr;

      // ── 5. Accept invitation (idempotent — safe to call on retry) ────────
      try {
        await acceptEmployeeInvitation(token);
      } catch (invErr) {
        // If the invitation was already accepted in a previous attempt, that's fine.
        // The RPC is idempotent after running fix_accept_invitation_idempotent.sql.
        // If it still throws, surface it only if it's not an "already accepted" case.
        const msg = invErr?.message?.toLowerCase() ?? '';
        const isAlreadyDone =
          msg.includes('already accepted') ||
          msg.includes('already exists') ||
          msg.includes('invalid or has expired');  // re-run of already-accepted invite
        if (!isAlreadyDone) throw invErr;
      }

      // ── 6. Welcome email (fire-and-forget) ───────────────────────────────
      supabase.functions.invoke('send-welcome-email', {
        body: {
          email:         invite.email,
          fullName:      invite.fullName || '',
          workspaceName: invite.workspaceName,
          jobProfile:    invite.jobProfile,
          department:    invite.department || '',
          teamName:      invite.teamName   || '',
        },
      }).catch(() => {});

      // ── 7. Refresh contexts ──────────────────────────────────────────────
      await updateUser();
      await refreshWorkspace();

      setDone(true);
      toast.success('Account set up successfully! Welcome aboard 🎉');
      setTimeout(() => navigate('/user/dashboard'), 2500);

    } catch (err) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(newPw);

  // ── Render states ─────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/70 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Validating your invitation…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid')  return <SetupExpired reason="expired" />;
  if (pageState === 'accepted') return <SetupExpired reason="accepted" />;

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/70 to-slate-950 px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome aboard!</h2>
          <p className="text-white/60 text-sm mb-6">
            Your account is ready. Taking you to your dashboard…
          </p>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const jp = JOB_META[invite?.jobProfile] ?? JOB_META.employee;

  // ── Main wizard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/70 to-slate-950 px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <LuShield className="text-purple-400" size={18} />
            <span className="text-purple-300 font-bold text-sm tracking-wide uppercase">TaskFlow</span>
          </div>
          <p className="text-white/40 text-xs">Account Setup Wizard</p>
        </div>

        {/* ── Step progress ── */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step  ? 'bg-green-500 text-white' :
                  i === step ? 'bg-white text-indigo-700 shadow-lg shadow-white/20' :
                               'bg-white/10 text-white/40'
                }`}>
                  {i < step ? <LuCircleCheck size={15}/> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i === step ? 'text-white' : 'text-white/40'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-14 h-px mt-[-14px] transition-all ${i < step ? 'bg-green-500' : 'bg-white/15'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Card ── */}
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-8">

          {/* Error */}
          {error && (
            <div className="text-red-300 text-xs mb-4 bg-red-500/15 border border-red-400/30 rounded-xl px-3 py-2 text-center">
              {error}
            </div>
          )}

          {/* ════════════════ STEP 0 — Welcome ════════════════ */}
          {step === 0 && (
            <div>
              {/* Company welcome banner */}
              <div className="rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-400/30 p-5 mb-6 text-center">
                <div className="text-4xl mb-2">👋</div>
                <h2 className="text-xl font-bold text-white mb-1">
                  Welcome to <span className="text-purple-300">{invite?.workspaceName}</span>!
                </h2>
                <p className="text-white/60 text-sm">
                  You've been invited to join the team. Let's set up your account in 3 quick steps.
                </p>
              </div>

              {/* Role card */}
              <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10 mb-6 overflow-hidden">
                <InfoRow label="Email"       value={invite?.email} />
                <InfoRow label="Role"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>{jp.emoji}</span>
                      <span style={{ color: jp.color }} className="font-semibold">{jp.label}</span>
                    </span>
                  }
                />
                {invite?.department && <InfoRow label="Department" value={invite.department} />}
                {invite?.teamName   && <InfoRow label="Team"       value={`👥 ${invite.teamName}`} />}
              </div>

              <p className="text-white/50 text-xs text-center mb-6">
                Your email address is pre-set and cannot be changed. You'll set your own secure password in the next step.
              </p>

              <button
                type="button"
                onClick={handleNext}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Let's Go <LuChevronRight size={16}/>
              </button>
            </div>
          )}

          {/* ════════════════ STEP 1 — Password ════════════════ */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center">
                  <LuLock className="text-indigo-300" size={18}/>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Set Your Password</h3>
                  <p className="text-white/50 text-xs">Use your temporary password to verify, then choose a new one</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Temp password */}
                <div>
                  <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-1">
                    <LuLock size={12}/> Temporary Password
                    <span className="text-white/30 font-normal ml-1">(from your invite email)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="setup-temp-pw"
                      type={showTmp ? 'text' : 'password'}
                      value={tempPw}
                      onChange={(e) => setTempPw(e.target.value)}
                      placeholder="Enter temp password from email"
                      className="input-ghost pr-9 w-full"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowTmp(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                      {showTmp ? <LuEyeOff size={15}/> : <LuEye size={15}/>}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10"/>
                  <span className="text-white/30 text-xs">then create yours</span>
                  <div className="flex-1 h-px bg-white/10"/>
                </div>

                {/* New password */}
                <div>
                  <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-1">
                    <LuShield size={12}/> New Password
                  </label>
                  <div className="relative">
                    <input
                      id="setup-new-pw"
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="input-ghost pr-9 w-full"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                      {showNew ? <LuEyeOff size={15}/> : <LuEye size={15}/>}
                    </button>
                  </div>
                  {newPw && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                            i <= strength ? strengthColor[strength] : 'bg-white/10'}`}/>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/40">{strengthLabel[strength]}</p>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-1">
                    <LuCircleCheck size={12}/> Confirm Password
                  </label>
                  <input
                    id="setup-confirm-pw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`input-ghost w-full ${confirmPw && newPw !== confirmPw ? 'border-red-400/60' : confirmPw && newPw === confirmPw ? 'border-green-400/60' : ''}`}
                    autoComplete="new-password"
                  />
                  {confirmPw && newPw === confirmPw && (
                    <p className="text-green-400 text-[10px] mt-1 flex items-center gap-1">
                      <LuCircleCheck size={10}/> Passwords match
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} className="btn-ghost flex items-center gap-1">
                  <LuChevronLeft size={16}/> Back
                </button>
                <button type="button" onClick={handleNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Next <LuChevronRight size={16}/>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ STEP 2 — Profile ════════════════ */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center">
                  <LuUser className="text-purple-300" size={18}/>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Complete Your Profile</h3>
                  <p className="text-white/50 text-xs">Optional — you can update these later</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-purple-500/50"/>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl">
                        {jp.emoji}
                      </div>
                    )}
                    <label htmlFor="avatar-upload"
                      className="absolute -bottom-2 -right-2 w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-500 transition shadow-lg">
                      <LuCamera size={13} className="text-white"/>
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/>
                  </div>
                  <p className="text-white/40 text-xs">Click the camera to upload a profile photo</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-1">
                    <LuPhone size={12}/> Phone Number <span className="text-white/30 font-normal">(optional)</span>
                  </label>
                  <input
                    id="setup-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="input-ghost w-full"
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label className="text-xs text-white/60 font-medium flex items-center gap-1 mb-1">
                    <LuBriefcase size={12}/> Employee ID <span className="text-white/30 font-normal">(optional)</span>
                  </label>
                  <input
                    id="setup-empid"
                    type="text"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    placeholder="EMP-001"
                    className="input-ghost w-full"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs text-white/60 font-medium mb-1 block">
                    About / Bio <span className="text-white/30 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="setup-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A short intro about yourself…"
                    rows={3}
                    className="input-ghost w-full resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} disabled={loading} className="btn-ghost flex items-center gap-1">
                  <LuChevronLeft size={16}/> Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? <LuLoaderCircle className="animate-spin" size={16}/> : <LuPartyPopper size={16}/>}
                  {loading ? 'Setting up…' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Help */}
        <p className="text-center text-white/30 text-xs mt-4">
          Having trouble?{' '}
          <a href="mailto:support@taskflow.app" className="text-indigo-400 hover:underline">
            Contact support
          </a>
        </p>
      </div>

      {/* Scoped styles */}
      <style>{`
        .input-ghost {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-ghost::placeholder { color: rgba(255,255,255,0.3); }
        .input-ghost:focus { border-color: rgba(147,197,253,0.6); }
        .btn-primary {
          background: linear-gradient(to right, #4f46e5, #7c3aed);
          color: white; font-weight: 600; font-size: 0.875rem;
          padding: 0.6rem 1.25rem; border-radius: 0.75rem;
          transition: opacity 0.2s; cursor: pointer; border: none;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-ghost {
          background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7);
          font-weight: 600; font-size: 0.875rem; padding: 0.6rem 1rem;
          border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.2s; cursor: pointer;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-xs text-white/40">{label}</span>
    <span className="text-xs text-white font-medium">{value}</span>
  </div>
);

export default SetupAccount;
