import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { supabase } from '../../utils/supabaseClient';
import { validateEmail } from '../../utils/helper';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle, LuBuilding2, LuUser, LuMail, LuPhone,
  LuLock, LuChevronRight, LuChevronLeft, LuCircleCheck,
  LuShield, LuEye, LuEyeOff,
} from 'react-icons/lu';

// ── password strength ─────────────────────────────────────────────────────────
const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  return score; // 0-4
};
const strengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

// ── constants ─────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'Information Technology', 'Healthcare', 'Finance & Banking',
  'Education', 'Retail & E-commerce', 'Manufacturing',
  'Media & Entertainment', 'Logistics', 'Real Estate', 'Other',
];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

const STEPS = ['Account', 'Company', 'Confirm'];

// ── component ─────────────────────────────────────────────────────────────────
const AdminRegister = () => {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(0); // 0, 1, 2
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPw,  setShowPw]  = useState(false);

  // Step 0 — account
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');

  // Step 1 — company
  const [company,  setCompany]  = useState('');
  const [industry, setIndustry] = useState('');
  const [size,     setSize]     = useState('');

  // ── validation per step ───────────────────────────────────────────────────
  const validateStep = () => {
    setError('');
    if (step === 0) {
      if (!name.trim())             return setError('Full name is required.'),   false;
      if (!validateEmail(email))    return setError('Enter a valid email.'),     false;
      if (password.length < 8)      return setError('Password must be at least 8 characters.'), false;
    }
    if (step === 1) {
      if (!company.trim())          return setError('Company name is required.'), false;
      if (!industry)                return setError('Please select an industry.'), false;
      if (!size)                    return setError('Please select company size.'), false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };
  const handleBack = () => { setError(''); setStep((s) => s - 1); };

  // ── final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Hard timeout — if anything stalls > 15 s, bail gracefully
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('Request timed out. Check your connection and try again.');
    }, 15000);

    try {
      // 1. Create auth user (email + password)
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role:        'admin',
            job_profile: 'company_admin',
            invited:     'false',
          },
        },
      });

      if (signUpErr) throw signUpErr;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Sign-up failed — no user ID returned.');

      // 2. Build workspace slug
      const slug = company
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);

      // 3. Call a single SECURITY DEFINER RPC that:
      //    a) upserts the profile (bypasses RLS — user not confirmed yet)
      //    b) creates the workspace
      //    c) adds the user as company_admin member
      const { error: rpcErr } = await supabase.rpc('bootstrap_company_admin', {
        p_user_id:        userId,
        p_name:           name,
        p_phone:          phone || null,
        p_company_name:   company,
        p_company_industry: industry,
        p_company_size:   size,
        p_workspace_name: company,
        p_workspace_slug: `${slug}-${Date.now()}`,
      });

      // If RPC doesn't exist yet, fall back to direct calls
      if (rpcErr && rpcErr.code === 'PGRST202') {
        // Fallback: direct profile upsert + workspace create
        await supabase.from('profiles').upsert({
          id:               userId,
          name,
          phone:            phone || null,
          job_profile:      'company_admin',
          company_name:     company,
          company_industry: industry,
          company_size:     size,
          setup_completed:  true,
          status:           'active',
        }, { onConflict: 'id' });

        await supabase.rpc('create_workspace_with_admin', {
          p_name: company,
          p_slug: `${slug}-${Date.now()}`,
        });
      } else if (rpcErr) {
        throw rpcErr;
      }

      clearTimeout(timeoutId);

      // 4. Check if email confirmation is required
      const needsConfirm = !authData.session;
      if (needsConfirm) {
        toast.success('Account created! Check your email to confirm, then log in.');
      } else {
        toast.success(`Welcome to TaskFlow, ${name.split(' ')[0]}! 🎉`);
      }
      navigate('/login');

    } catch (err) {
      clearTimeout(timeoutId);
      // Friendly messages for common Supabase errors
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('This email is already registered. Try logging in instead.');
      } else if (msg.includes('rate limit')) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const strength = getStrength(password);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="w-full max-w-lg mx-auto">
        {/* ── Progress stepper ── */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                      ? 'bg-white text-indigo-700 shadow-lg shadow-white/20'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {i < step ? <LuCircleCheck size={16} /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i === step ? 'text-white' : 'text-white/40'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-px mt-[-14px] ${i < step ? 'bg-green-500' : 'bg-white/20'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Card ── */}
        <div className="p-8 rounded-2xl bg-white/10 shadow-2xl backdrop-blur-xl border border-white/20 animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
              <LuShield className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">
                {step === 0 && 'Create Admin Account'}
                {step === 1 && 'Company Details'}
                {step === 2 && 'Review & Confirm'}
              </h3>
              <p className="text-xs text-white/50">
                {step === 0 && 'Your personal login credentials'}
                {step === 1 && "Tell us about your organisation"}
                {step === 2 && 'Everything look good?'}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-300 text-xs mb-4 bg-red-500/15 border border-red-400/30 rounded-xl px-3 py-2 text-center">
              {error}
            </div>
          )}

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <Field label="Full Name" icon={<LuUser size={14} />}>
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input-ghost"
                  autoComplete="name"
                />
              </Field>

              <Field label="Work Email" icon={<LuMail size={14} />}>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="input-ghost"
                  autoComplete="email"
                />
              </Field>

              <Field label="Phone (optional)" icon={<LuPhone size={14} />}>
                <input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-ghost"
                />
              </Field>

              <div>
                <Field label="Password" icon={<LuLock size={14} />}>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="input-ghost pr-9"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showPw ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                    </button>
                  </div>
                </Field>
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded-full transition-all ${
                            i <= strength ? strengthColor[strength] : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-white/40">{strengthLabel[strength]}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="btn-primary mt-2 flex items-center justify-center gap-2"
              >
                Next: Company Info <LuChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 1: Company ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field label="Company Name" icon={<LuBuilding2 size={14} />}>
                <input
                  id="reg-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className="input-ghost"
                />
              </Field>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/60 font-medium">Industry</label>
                <select
                  id="reg-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="input-ghost"
                >
                  <option value="" className="bg-gray-900">Select industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind} className="bg-gray-900">{ind}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/60 font-medium">Company Size</label>
                <div className="grid grid-cols-5 gap-2">
                  {COMPANY_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        size === s
                          ? 'bg-white text-indigo-700 border-white shadow-lg'
                          : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={handleBack} className="btn-ghost flex items-center gap-1">
                  <LuChevronLeft size={16} /> Back
                </button>
                <button type="button" onClick={handleNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Review <LuChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/10">
                <SummaryRow label="Name"     value={name} />
                <SummaryRow label="Email"    value={email} />
                <SummaryRow label="Phone"    value={phone || '—'} />
                <SummaryRow label="Company"  value={company} />
                <SummaryRow label="Industry" value={industry} />
                <SummaryRow label="Size"     value={size} />
              </div>

              <div className="rounded-xl bg-indigo-500/10 border border-indigo-400/20 p-3 text-xs text-indigo-200 leading-relaxed">
                <strong className="text-indigo-100">What happens next?</strong><br />
                A workspace is auto-created for <strong>{company}</strong>. You'll be the
                Company Admin. Invite employees from your dashboard — they'll receive a Brevo
                email with a setup link.
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handleBack} disabled={loading} className="btn-ghost flex items-center gap-1">
                  <LuChevronLeft size={16} /> Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? <LuLoaderCircle className="animate-spin" size={16} /> : <LuCircleCheck size={16} />}
                  {loading ? 'Creating account…' : 'Create Company Account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/40 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-300 hover:underline">Sign in</Link>
        </p>
      </div>

      {/* Scoped styles */}
      <style>{`
        .input-ghost {
          width: 100%;
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
        .input-ghost option { background: #1e1b4b; }
        .btn-primary {
          background: linear-gradient(to right, #4f46e5, #7c3aed);
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          padding: 0.6rem 1.25rem;
          border-radius: 0.75rem;
          transition: opacity 0.2s;
          cursor: pointer;
          border: none;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-ghost {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.7);
          font-weight: 600;
          font-size: 0.875rem;
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.2s;
          cursor: pointer;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </AuthLayout>
  );
};

// ── tiny helpers ──────────────────────────────────────────────────────────────
const Field = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-white/60 font-medium flex items-center gap-1">
      {icon} {label}
    </label>
    {children}
  </div>
);

const SummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-xs text-white/40">{label}</span>
    <span className="text-xs text-white font-medium">{value}</span>
  </div>
);

export default AdminRegister;
