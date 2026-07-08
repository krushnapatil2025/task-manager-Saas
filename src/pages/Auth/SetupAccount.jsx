import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { getEmployeeInviteByToken, acceptEmployeeInvitation } from '../../services/invitationService';
import { sendOnboardingDMs } from '../../services/chatService';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import SetupExpired from './SetupExpired';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { COUNTRIES } from '../../utils/countries';
import CountrySelector from '../../components/CountrySelector';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle, LuCircleCheck, LuUser,
  LuEye, LuEyeOff, LuChevronRight, LuChevronLeft,
  LuPartyPopper, LuUpload, LuTrash, LuLock
} from 'react-icons/lu';

// ── password strength helper ──────────────────────────────────────────────────
const checkLength = (pw) => pw.length >= 8;
const checkUpper = (pw) => /[A-Z]/.test(pw);
const checkNumberOrSymbol = (pw) => /[0-9]|[^A-Za-z0-9]/.test(pw);

// ── Job profile display metadata ─────────────────────────────────────────────
const JOB_META = {
  company_admin: { label: 'Admin clearance', emoji: '🏢', color: '#3b82f6', code: 'ADM' },
  manager:       { label: 'Manager status',    emoji: '👔', color: '#10b981', code: 'MGR' },
  employee:      { label: 'Employee clearance', emoji: '👤', color: '#6366f1', code: 'EMP' },
  intern:        { label: 'Intern status',     emoji: '🎓', color: '#a855f7', code: 'INT' },
};

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

  // Step variables
  const [tempPw,     setTempPw]     = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showTmp,    setShowTmp]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);

  // Existing account support
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);

  // Profile details
  const [country,    setCountry]    = useState(COUNTRIES[0]); // default India
  const [phone,      setPhone]      = useState('');
  const [bio,        setBio]        = useState('');
  const [empId,      setEmpId]      = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const fileInputRef = useRef(null);

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
        if (inv.employeeId) {
          setEmpId(inv.employeeId);
        }
        setPageState('valid');
      } catch {
        setPageState('invalid');
      }
    })();
  }, [token]);

  // ── Check active session for logged-in user with matching email ───────────
  useEffect(() => {
    if (!invite) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user;
        if (currentUser && currentUser.email?.toLowerCase() === invite.email?.toLowerCase()) {
          setIsAlreadyLoggedIn(true);
          
          // Pre-fill profile from existing profile
          const { data: existingProf } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
          if (existingProf) {
            if (existingProf.phone) {
              const sortedCountries = [...COUNTRIES].sort((a, b) => b.dial_code.length - a.dial_code.length);
              const matched = sortedCountries.find(c => existingProf.phone.startsWith(c.dial_code));
              if (matched) {
                setCountry(matched);
                setPhone(existingProf.phone.slice(matched.dial_code.length));
              } else {
                setPhone(existingProf.phone);
              }
            }
            if (existingProf.bio)   setBio(existingProf.bio);
            if (existingProf.employee_id) setEmpId(existingProf.employee_id);
            if (existingProf.profile_image_url) setAvatarPreview(existingProf.profile_image_url);
          }
        }
      } catch (err) {
        console.warn('Failed to verify session on load:', err);
      }
    })();
  }, [invite]);

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
      if (isExistingAccount) {
        if (!newPw) return setError('Please enter your existing password.'), false;
        return true;
      }
      if (!tempPw)                       return setError('Enter your temporary password.'), false;
      if (invite?.tempPassword && tempPw !== invite.tempPassword)
                                         return setError('Temporary password is incorrect. Please check your invite email.'), false;
      if (!checkLength(newPw))           return setError('New password must be at least 8 characters.'), false;
      if (!checkUpper(newPw))            return setError('Password must contain at least one uppercase letter.'), false;
      if (!checkNumberOrSymbol(newPw))   return setError('Password must contain a number or special character.'), false;
      if (newPw !== confirmPw)           return setError('Passwords do not match.'), false;
      if (newPw === tempPw)              return setError('Choose a different password from your temporary one.'), false;
    }
    if (step === 2) {
      // Avatar is optional for existing accounts since they already have one, but required for new signups
      if (!avatarPreview && !avatarFile) return setError('Please upload a profile photo.'), false;
      if (!phone.trim())                 return setError('Phone number is required.'), false;
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length !== 10)      return setError('Phone number must be exactly 10 digits.'), false;
      if (!empId.trim())                 return setError('Employee ID is required.'), false;
      if (!bio.trim())                   return setError('About/Bio is required.'), false;
      if (bio.trim().length < 10)        return setError('Bio must be at least 10 characters long.'), false;
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 0 && isAlreadyLoggedIn) {
      // Skip password step completely if already logged in as this user
      setStep(2);
      return;
    }

    if (step === 1 && !isExistingAccount && !isAlreadyLoggedIn) {
      if (!validateStep()) return;
      setError('');
      setLoading(true);

      try {
        // Try standard signup to check if email already exists
        const { error: signUpErr } = await supabase.auth.signUp({
          email:    invite.email,
          password: newPw,
        });

        const alreadyRegistered =
          signUpErr?.code === 'email_exists' ||
          signUpErr?.message?.toLowerCase().includes('already registered') ||
          signUpErr?.message?.toLowerCase().includes('already exists') ||
          signUpErr?.message?.toLowerCase().includes('email_exists');

        if (signUpErr && !alreadyRegistered) throw signUpErr;

        if (alreadyRegistered) {
          setIsExistingAccount(true);
          setNewPw(''); // clear input so they can type their actual existing password
          setError('This email is already registered on Strideo. Please enter your existing password.');
          setLoading(false);
          return;
        }

        // If signup was successful, proceed to profile setup
        setStep((s) => s + 1);
      } catch (err) {
        setError(err.message || 'Credentials verification failed.');
      } finally {
        setLoading(false);
      }
    } else {
      if (validateStep()) setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 2 && isAlreadyLoggedIn) {
      setStep(0);
    } else {
      setStep((s) => s - 1);
    }
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 2) {
      handleNext();
      return;
    }
    if (!validateStep()) return;

    setError('');
    setLoading(true);

    try {
      let sessionUser = null;

      if (isAlreadyLoggedIn) {
        // Use active session user
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } else if (isExistingAccount) {
        // Authenticate with existing password
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email:    invite.email,
          password: newPw, // In existing account mode, newPw stores their actual password
        });
        if (signInErr) {
          throw new Error('Incorrect password. Please verify your existing Strideo password.');
        }
        sessionUser = data.user;
      } else {
        // New account signup flow
        try {
          await supabase.rpc('cleanup_failed_signup', { p_token: token });
        } catch (rpcErr) {
          console.warn('cleanup_failed_signup RPC not deployed:', rpcErr.message);
        }

        // Attempt login (sign up was already triggered in handleNext)
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email:    invite.email,
          password: newPw,
        });

        if (signInErr) throw signInErr;
        sessionUser = data.user;
      }

      if (!sessionUser) {
        throw new Error('Could not authenticate session. Please try again.');
      }

      // Handle profile photo upload (if a new file was chosen)
      let avatarUrl = avatarPreview;
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

      const fullPhoneNumber = phone ? `${country.dial_code}${phone}` : null;

      // Upsert profile data
      const profileUpdate = {
        id:              sessionUser.id,
        name:            invite.fullName || invite.email.split('@')[0],
        phone:           fullPhoneNumber,
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

      // Mark the invitation as accepted
      try {
        await acceptEmployeeInvitation(token);
      } catch (invErr) {
        const msg = invErr?.message?.toLowerCase() ?? '';
        const isAlreadyDone =
          msg.includes('already accepted') ||
          msg.includes('already exists') ||
          msg.includes('invalid or has expired');
        if (!isAlreadyDone) throw invErr;
      }

      // Initialize DMs
      try {
        await sendOnboardingDMs(invite.workspaceId, sessionUser.id, invite);
      } catch (chatErr) {
        console.error('Failed to send onboarding chat messages:', chatErr);
      }

      // Trigger Welcome email function
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

      await updateUser();
      await refreshWorkspace();

      setDone(true);
      setStep(3); // Slide up to show the Success screen!
      toast.success('Joined workspace successfully! Welcome aboard 🎉');
      setTimeout(() => navigate('/user/dashboard'), 3500);

    } catch (err) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0d12] dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4 select-none">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-widest">Validating security handshake…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid')  return <SetupExpired reason="expired" />;
  if (pageState === 'accepted') return <SetupExpired reason="accepted" />;

  const jp = JOB_META[invite?.jobProfile] ?? JOB_META.employee;

  // ── Main wizard ───────────────────────────────────────────────────────────
  return (
    <AuthLayout variant="split-card" step={step} title="Setup Account" subtitle={invite ? `Initialize your credentials for ${invite.workspaceName}` : "Setup your account"}>
      <div className="w-full font-sans">
        {/* Floating Custom Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          .onboarding-input {
            width: 100%;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 0.65rem 0.85rem;
            color: #0f172a;
            font-size: 0.825rem;
            font-weight: 500;
            outline: none;
            transition: all 0.2s;
          }
          .dark .onboarding-input {
            background: #1c1d24;
            border-color: #2e303b;
            color: #f8fafc;
          }
          .onboarding-input:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .onboarding-btn-primary {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: #2563eb;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.7rem 1.2rem;
            border-radius: 0.75rem;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
            transition: all 0.2s;
            cursor: pointer;
            border: none;
          }
          .onboarding-btn-primary:hover {
            background: #1d4ed8;
          }
          .onboarding-btn-ghost {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.7rem 1.2rem;
            border-radius: 0.75rem;
            transition: all 0.2s;
            cursor: pointer;
            border: none;
          }
          .dark .onboarding-btn-ghost {
            background: #1c1d24;
            color: #94a3b8;
          }
          .onboarding-btn-ghost:hover {
            background: #e2e8f0;
          }
          .dark .onboarding-btn-ghost:hover {
            background: #2e303b;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}} />

        <form onSubmit={handleSubmit} className="w-full">
          {error && (
            <div className="text-red-500 text-xs text-center bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5 font-bold mb-4">
              ⚠️ {error}
            </div>
          )}

          {/* Vertical Slider Frame Container */}
          <div className="relative overflow-hidden h-[460px] w-full no-scrollbar">
            <div 
              className="absolute top-0 left-0 w-full flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateY(-${step * 460}px)` }}
            >
              
              {/* ════════════════ SLIDE 0: Welcome ════════════════ */}
              <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2">
                <div className="flex flex-col gap-4">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#181920]/60 border border-slate-200/50 dark:border-zinc-800/80">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        CLEARANCE: {jp.code}
                      </span>
                      <span className="text-slate-400 dark:text-zinc-555 text-xs font-semibold">Invite Verified</span>
                    </div>

                    <div className="flex items-center gap-3.5 mb-5 select-none">
                      <div className="w-11 h-11 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <LuUser className="text-blue-500 text-xl" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
                          {invite?.fullName || invite?.email.split('@')[0]}
                        </h3>
                        <p className="text-[10px] text-slate-455 dark:text-zinc-500 font-semibold">{invite?.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 dark:border-zinc-800/60 text-xs">
                      <div>
                        <span className="text-slate-455 dark:text-zinc-500 block mb-0.5 text-[9px] uppercase font-bold tracking-wider">WORKSPACE</span>
                        <span className="text-slate-700 dark:text-zinc-300 font-bold">{invite?.workspaceName}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 dark:text-zinc-500 block mb-0.5 text-[9px] uppercase font-bold tracking-wider">JOB ROLE</span>
                        <span className="text-slate-700 dark:text-zinc-300 font-bold">{jp.emoji} {jp.label}</span>
                      </div>
                    </div>

                    {isAlreadyLoggedIn && (
                      <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-[10px] font-bold">
                        <LuCircleCheck size={12} className="stroke-[3px]" />
                        Active Session: Logged in as {invite.email}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="onboarding-btn-primary"
                >
                  {isAlreadyLoggedIn ? 'Join Workspace' : "Let's Start!"} <LuChevronRight size={14}/>
                </button>
              </div>

              {/* ════════════════ SLIDE 1: Credentials ════════════════ */}
              <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2 no-scrollbar overflow-y-auto">
                {isExistingAccount ? (
                  /* ── Existing Account Verification View ── */
                  <div className="flex flex-col gap-3.5">
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-semibold">
                      🔒 Your email <span className="text-blue-600 dark:text-blue-400 font-bold">{invite.email}</span> is already registered on Strideo. Please enter your existing password to join <span className="font-bold">{invite.workspaceName}</span>.
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-1 select-none">
                        Your Existing Password <span className="text-red-500 font-black ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="setup-existing-pw"
                          type={showNew ? 'text' : 'password'}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Enter your existing Strideo password"
                          className="onboarding-input pr-10"
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowNew(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 cursor-pointer">
                          {showNew ? <LuEyeOff size={14}/> : <LuEye size={14}/>}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setIsExistingAccount(false);
                        setNewPw('');
                        setError('');
                      }} 
                      className="text-indigo-655 dark:text-indigo-400 text-[10px] font-bold uppercase hover:underline mt-2 self-start"
                    >
                      ← Back to normal setup
                    </button>
                  </div>
                ) : (
                  /* ── Normal New Signup View ── */
                  <div className="flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-1 select-none">
                        Temporary Password <span className="text-red-500 font-black ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="setup-temp-pw"
                          type={showTmp ? 'text' : 'password'}
                          value={tempPw}
                          onChange={(e) => setTempPw(e.target.value)}
                          placeholder="Enter the temp password from your email"
                          className="onboarding-input pr-10"
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowTmp(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 cursor-pointer">
                          {showTmp ? <LuEyeOff size={14}/> : <LuEye size={14}/>}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-1 select-none">
                        New Password <span className="text-red-500 font-black ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="setup-new-pw"
                          type={showNew ? 'text' : 'password'}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Enter a secure password"
                          className="onboarding-input pr-10"
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowNew(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 cursor-pointer">
                          {showNew ? <LuEyeOff size={14}/> : <LuEye size={14}/>}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-1 select-none">
                        Confirm Password <span className="text-red-500 font-black ml-0.5">*</span>
                      </label>
                      <input
                        id="setup-confirm-pw"
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="onboarding-input"
                        autoComplete="new-password"
                      />
                    </div>

                    {/* Password Strength list with ticks */}
                    <div className="p-3 bg-slate-50 dark:bg-[#181920]/60 rounded-xl border border-slate-200/50 dark:border-zinc-800/80">
                      <span className="text-[9px] font-mono tracking-widest uppercase text-slate-400 dark:text-zinc-555 block mb-1.5">Password requirements</span>
                      <ul className="space-y-1 text-[10px]">
                        <li className={`flex items-center gap-2 font-semibold ${checkLength(newPw) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-550'}`}>
                          <LuCircleCheck size={11} className={checkLength(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                          At least 8 characters
                        </li>
                        <li className={`flex items-center gap-2 font-semibold ${checkUpper(newPw) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-550'}`}>
                          <LuCircleCheck size={11} className={checkUpper(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                          Contains at least one uppercase letter
                        </li>
                        <li className={`flex items-center gap-2 font-semibold ${checkNumberOrSymbol(newPw) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-555'}`}>
                          <LuCircleCheck size={11} className={checkNumberOrSymbol(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                          Contains a number or special symbol
                        </li>
                        {confirmPw && (
                          <li className={`flex items-center gap-2 font-semibold ${newPw === confirmPw ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                            <LuCircleCheck size={11} className={newPw === confirmPw ? 'stroke-[3px]' : 'opacity-40'} />
                            Passwords match
                          </li>
                        )}
                      </ul>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setIsExistingAccount(true);
                        setNewPw('');
                        setError('');
                      }} 
                      className="text-indigo-655 dark:text-indigo-400 text-[10px] font-bold uppercase hover:underline mt-1 self-start"
                    >
                      Already have an account? Link it here
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={handleBack} className="onboarding-btn-ghost">
                    <LuChevronLeft size={14}/> Back
                  </button>
                  <button type="button" onClick={handleNext} className="onboarding-btn-primary flex-1">
                    Continue <LuChevronRight size={14}/>
                  </button>
                </div>
              </div>

              {/* ════════════════ SLIDE 2: Identity/Profile ════════════════ */}
              <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2 no-scrollbar overflow-y-auto">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-[#181920]/60 border border-slate-200/50 dark:border-zinc-800/80">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <div className="relative w-16 h-16 mb-2.5">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 border-2 border-dashed border-blue-500/30 flex items-center justify-center text-3xl">
                          {jp.emoji}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-550/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold border border-blue-500/20"
                      >
                        <LuUpload size={11} /> Upload Photo
                      </button>
                      {avatarFile && (
                        <button
                          type="button"
                          onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold border border-red-500/20"
                        >
                          <LuTrash size={11} /> Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider select-none">
                      Phone Number <span className="text-red-500 font-black ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <CountrySelector value={country} onChange={setCountry} />
                      <input 
                        type="tel" 
                        maxLength={10}
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210" 
                        className="onboarding-input flex-1 h-[38px]" 
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider select-none">
                      Employee ID <span className="text-red-500 font-black ml-0.5">*</span>
                    </label>
                    <input type="text" value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="E.g. EMP-101" className="onboarding-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider select-none">
                      About / Bio <span className="text-red-500 font-black ml-0.5">*</span>
                    </label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Minimum 10 characters." rows={3} className="onboarding-input resize-none" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={handleBack} disabled={loading} className="onboarding-btn-ghost">
                    <LuChevronLeft size={14}/> Back
                  </button>
                  <button type="submit" disabled={loading} className="onboarding-btn-primary flex-1">
                    {loading ? <LuLoaderCircle className="animate-spin" size={14}/> : <LuPartyPopper size={14}/>}
                    {loading ? 'Processing…' : (isExistingAccount || isAlreadyLoggedIn ? 'Join Workspace' : 'Create Account')}
                  </button>
                </div>
              </div>

              {/* ════════════════ SLIDE 3: Success Screen ════════════════ */}
              <div className="h-[460px] w-full flex flex-col justify-center items-center shrink-0 text-center pb-2 select-none">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950/40 border-4 border-blue-500/20 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full border border-blue-500 animate-ping opacity-30" />
                  <LuCircleCheck className="text-blue-600 dark:text-blue-400 text-4xl" />
                </div>

                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100 mb-2">
                  {isExistingAccount || isAlreadyLoggedIn ? 'Connected successfully!' : 'Account created successfully!'}
                </h3>
                <p className="text-slate-500 dark:text-zinc-450 text-xs font-semibold mb-6 leading-relaxed max-w-[280px]">
                  Welcome aboard! Start your success journey with Strideo!
                </p>

                <div className="w-full max-w-[240px]">
                  <div className="w-full flex items-center justify-center gap-2 text-white bg-blue-650 hover:bg-blue-750 font-bold py-2.5 rounded-xl shadow-lg transition cursor-pointer text-xs uppercase tracking-widest">
                    Initializing matrix…
                  </div>
                </div>
              </div>

            </div>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default SetupAccount;
