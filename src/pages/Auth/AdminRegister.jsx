import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLAyout';
import SEO from '../../components/SEO';
import { supabase } from '../../utils/supabaseClient';
import { validateEmail } from '../../utils/helper';
import { BRAND_COLORS, DEFAULT_BRAND, applyCSSVariables } from '../../context/BrandContext';
import { uploadFileToGoogleDrive } from '../../services/chatService';
import { sendRegistrationReceivedEmail } from '../../services/companyApprovalEmailService';
import { COUNTRIES } from '../../utils/countries';
import CountrySelector from '../../components/CountrySelector';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle, LuBuilding2, LuUser, LuMail, LuPhone,
  LuLock, LuChevronRight, LuChevronLeft, LuCircleCheck,
  LuShield, LuEye, LuEyeOff, LuPalette,
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

const STEPS = ['Account', 'Company', 'Branding', 'Confirm'];

// ── component ─────────────────────────────────────────────────────────────────
const AdminRegister = () => {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(0); // 0, 1, 2, 3
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPw,  setShowPw]  = useState(false);

  useEffect(() => {
    applyCSSVariables(DEFAULT_BRAND);
  }, []);

  // Step 0 — account
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [country,  setCountry]  = useState(COUNTRIES[0]); // default India
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');

  // Step 1 — company
  const [company,  setCompany]  = useState('');
  const [industry, setIndustry] = useState('');
  const [size,     setSize]     = useState('');

  // Step 2 — branding
  const [selectedColor, setSelectedColor] = useState(BRAND_COLORS[0]); // default Indigo
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Logo upload handlers
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Logo must be under 1 MB');
      return;
    }
    setLogoFile(file);
    setLogoUploading(true);
    setError('');

    try {
      const res = await uploadFileToGoogleDrive(file);
      if (res && res.url) {
        const driveUrl = res.url.split('||')[1] || res.url;
        setLogoUrl(driveUrl);
        toast.success('Logo uploaded to Google Drive!');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload to Google Drive, using local fallback.');
      setLogoUrl(URL.createObjectURL(file));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleClearLogo = () => {
    setLogoFile(null);
    setLogoUrl('');
  };

  // ── validation per step ───────────────────────────────────────────────────
  const validateStep = () => {
    setError('');
    if (step === 0) {
      if (!name.trim())             return setError('Full name is required.'),   false;
      if (!validateEmail(email))    return setError('Enter a valid email.'),     false;
      if (!phone.trim())            return setError('Phone number is required.'), false;
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length !== 10) return setError('Phone number must be exactly 10 digits.'), false;
      if (password.length < 8)      return setError('Password must be at least 8 characters.'), false;
    }
    if (step === 1) {
      if (!company.trim())          return setError('Company name is required.'), false;
      if (!industry)                return setError('Please select an industry.'), false;
      if (!size)                    return setError('Please select company size.'), false;
    }
    if (step === 2) {
      if (!selectedColor)           return setError('Please choose a brand color preset.'), false;
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

      const fullPhoneNumber = phone ? `${country.dial_code}${phone}` : null;

      // 3. Call bootstrap_company_admin RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('bootstrap_company_admin', {
        p_user_id:        userId,
        p_name:           name,
        p_phone:          fullPhoneNumber,
        p_company_name:   company,
        p_company_industry: industry,
        p_company_size:   size,
        p_workspace_name: company,
        p_workspace_slug: `${slug}-${Date.now()}`,
      });

      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || 'Failed to bootstrap company account.');
      }

      let workspaceId = rpcData?.workspace_id;

      // Fallback in case RPC bootstrap_company_admin is styled differently or has different columns
      if (rpcErr && rpcErr.code === 'PGRST202') {
        await supabase.from('profiles').upsert({
          id:               userId,
          name,
          phone:            fullPhoneNumber,
          job_profile:      'company_admin',
          company_name:     company,
          company_industry: industry,
          company_size:     size,
          setup_completed:  true,
          status:           'active',
          account_approval_status: 'pending',
        }, { onConflict: 'id' });

        const { data: wsData, error: createWsErr } = await supabase.rpc('create_workspace_with_admin', {
          p_name: company,
          p_slug: `${slug}-${Date.now()}`,
        });
        if (createWsErr) throw createWsErr;
        workspaceId = wsData;
      } else if (rpcErr) {
        throw rpcErr;
      }

      // 4. Set Selected Brand Theme on the Workspace
      if (workspaceId && selectedColor) {
        await supabase
          .from('workspaces')
          .update({
            brand_color:       selectedColor.hex,
            brand_color_light: selectedColor.light,
            brand_color_text:  selectedColor.text,
            brand_color_name:  selectedColor.name,
            company_name:      company,
            logo_url:          logoUrl || null,
          })
          .eq('id', workspaceId);
      }

      clearTimeout(timeoutId);

      // 5. Send "Registration Received" confirmation email
      sendRegistrationReceivedEmail({
        toEmail:     email,
        toName:      name,
        companyName: company,
        adminName:   name,
        industry,
        size,
        appUrl:      window.location.origin,
      }).catch((err) => console.warn('Registration email send failed (non-fatal):', err));

      // 6. Check if email confirmation is required
      const needsConfirm = !authData.session;
      if (needsConfirm) {
        toast.success('Account created! Check your email to confirm, then log in.');
      } else {
        toast.success(`Welcome to ${company}! 🎉`);
      }
      navigate('/registration-pending');

    } catch (err) {
      clearTimeout(timeoutId);
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

  return (
    <AuthLayout title="Create Workspace" subtitle="Set up your enterprise tenant shell">
      <SEO title="Register Workspace" canonical="/admin/register" />
      <div className="w-full">
        {/* ── Progress stepper ── */}
        <div className="flex items-center justify-center gap-1.5 mb-6 select-none">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all duration-200 ${
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                      ? 'bg-indigo-650 text-white shadow-md shadow-indigo-100'
                      : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                  }`}
                >
                  {i < step ? <LuCircleCheck size={14} /> : i + 1}
                </div>
                <span className={`text-[9px] font-bold ${i === step ? 'text-slate-800' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px mt-[-14px] ${i < step ? 'bg-green-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="text-red-600 text-xs mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center font-medium">
            {error}
          </div>
        )}

        {/* ── Step 0: Account ── */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label="Full Name *" icon={<LuUser size={13} />}>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="form-input mt-0"
                autoComplete="name"
              />
            </Field>

            <Field label="Work Email *" icon={<LuMail size={13} />}>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="form-input mt-0"
                autoComplete="email"
              />
            </Field>

             <Field label="Phone Number *" icon={<LuPhone size={13} />}>
              <div className="flex items-center gap-2 mt-1">
                <CountrySelector value={country} onChange={setCountry} />
                <input
                  id="reg-phone"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  className="form-input flex-1 !mt-0 h-[38px]"
                />
              </div>
            </Field>

            <div>
              <Field label="Password *" icon={<LuLock size={13} />}>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="form-input mt-0 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
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
                          i <= strength ? strengthColor[strength] : 'bg-slate-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">{strengthLabel[strength]}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition"
            >
              Next: Company Info <LuChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Step 1: Company ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field label="Company Name *" icon={<LuBuilding2 size={13} />}>
              <input
                id="reg-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="form-input mt-0"
              />
            </Field>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-semibold">
                Industry <span className="text-red-500 font-black">*</span>
              </label>
              <select
                id="reg-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="form-input mt-0 bg-white"
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-semibold">
                Company Size <span className="text-red-500 font-black">*</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {COMPANY_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all duration-155 cursor-pointer ${
                      size === s
                        ? 'bg-indigo-650 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 text-slate-650 border-slate-200 hover:border-slate-350 hover:bg-slate-100/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-605 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition flex items-center justify-center gap-1"
              >
                <LuChevronLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1"
              >
                Choose Brand theme <LuChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Branding Settings ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Field label="Choose Workspace Brand Color *" icon={<LuPalette size={13} />}>
              <div className="grid grid-cols-5 gap-3 mt-1.5">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`relative w-8 h-8 rounded-full border-2 transition-all cursor-pointer mx-auto ${
                      selectedColor.name === c.name
                        ? 'border-slate-700 scale-110 shadow-md ring-2 ring-indigo-500/10'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor.name === c.name && (
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs select-none">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Field>

            {/* Company Logo Upload */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-semibold">Company Logo (Optional)</label>
              <div className="flex items-center gap-4 bg-slate-50/55 border border-slate-100 p-3 rounded-2xl">
                <div className="relative w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                  {logoUploading ? (
                    <LuLoaderCircle className="animate-spin text-indigo-650" size={18} />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="text-lg font-black text-slate-350" style={{ color: selectedColor.hex }}>
                      {company ? company[0].toUpperCase() : 'T'}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border border-slate-205 font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition inline-block">
                      Choose Logo
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoUpload} 
                        disabled={logoUploading}
                      />
                    </label>
                    {logoUrl && (
                      <button 
                        type="button"
                        onClick={handleClearLogo}
                        className="flex items-center gap-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] px-2 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Supported formats: PNG, JPG, SVG. Max 1MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Live Card Preview */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col gap-2.5 select-none mt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Live Brand Preview</span>
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-6.5 h-6.5 rounded-lg object-contain border border-slate-200/40 shadow-sm bg-white p-0.5"
                  />
                ) : (
                  <span 
                    style={{ backgroundColor: selectedColor.hex }}
                    className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm"
                  >
                    {company ? company[0].toUpperCase() : 'A'}
                  </span>
                )}
                <span className="text-xs font-black text-slate-850">{company || 'My Company'}</span>
              </div>
              <div className="flex gap-2 mt-0.5">
                <button
                  type="button"
                  style={{ backgroundColor: selectedColor.hex }}
                  className="text-[9px] font-bold text-white px-3 py-1.5 rounded-lg shadow-sm"
                >
                  Primary Action
                </button>
                <span
                  style={{ color: selectedColor.text, backgroundColor: selectedColor.light }}
                  className="text-[9px] font-bold px-3 py-1.5 rounded-lg border border-transparent"
                >
                  {selectedColor.name} Theme
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-650 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition flex items-center justify-center gap-1"
              >
                <LuChevronLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1"
              >
                Review details <LuChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-150/60 overflow-hidden">
              <SummaryRow label="Name"     value={name} />
              <SummaryRow label="Email"    value={email} />
              <SummaryRow label="Phone"    value={phone ? `${country.dial_code} ${phone}` : '—'} />
              <SummaryRow label="Company"  value={company} />
              <SummaryRow label="Industry" value={industry} />
              <SummaryRow label="Size"     value={size} />
              <SummaryRow 
                label="Theme"     
                value={
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: selectedColor.hex }}></span>
                    <span>{selectedColor.name}</span>
                  </div>
                } 
              />
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-100/50 p-4 text-xs text-indigo-850 leading-relaxed font-semibold">
              <strong className="text-indigo-950 font-black">What happens next?</strong><br />
              A workspace will be automatically created with your preferred {selectedColor.name} theme. 
              As the administrator, you can invite your team from the dashboard.
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={handleBack} 
                disabled={loading} 
                className="flex-1 py-2.5 text-xs font-semibold text-slate-650 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition flex items-center justify-center gap-1"
              >
                <LuChevronLeft size={14} /> Back
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-[2] bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10"
              >
                {loading ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuCircleCheck size={14} />}
                {loading ? 'Creating account…' : 'Create Company Workspace'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 mt-6 font-bold">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-650 hover:underline font-extrabold">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

// ── tiny helpers ──────────────────────────────────────────────────────────────
const Field = ({ label, icon, children }) => {
  const isRequired = label.endsWith(' *');
  const cleanLabel = isRequired ? label.slice(0, -2) : label;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 select-none">
        <span className="text-slate-400">{icon}</span>
        {cleanLabel} {isRequired && <span className="text-red-500 font-black ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
};

const SummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5 bg-white">
    <span className="text-xs text-slate-455 font-bold">{label}</span>
    <span className="text-xs text-slate-800 font-extrabold">{value}</span>
  </div>
);

export default AdminRegister;
